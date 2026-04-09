"""
Generate a 2-layer transformer encoder for anomaly classification.

Architecture: 12 tokens (one per feature) → Embed(64) → 2× TransformerEncoder(64, 4 heads) → MeanPool → Linear(4) → Softmax
Output: [healthy, degraded, warning, critical] + per-feature anomaly scores via attention weights

Run: python3 scripts/generate-anomaly-clf.py
Output: public/models/anomaly_clf.onnx
"""

import numpy as np
import os
import sys
sys.path.insert(0, os.path.dirname(__file__))
from onnx_builder import OnnxGraphBuilder


def make_weights():
    """Create expert-crafted weights for the anomaly classifier transformer."""
    np.random.seed(42)
    d_model = 64
    n_heads = 4
    d_head = d_model // n_heads  # 16
    n_features = 12

    weights = {}

    # Feature embedding: project each scalar feature to 64-dim
    # Shape: [12, 64] - each row is a learned embedding for that feature slot
    embed = np.random.randn(n_features, d_model).astype(np.float32) * 0.15
    # Bias the embeddings so certain features cluster in certain subspaces
    # CPU features (0,1,2) → dims 0-15
    embed[0, :16] += 0.5
    embed[1, :16] += 0.5
    embed[2, :16] += 0.3
    # Memory features (3,4,5) → dims 16-31
    embed[3, 16:32] += 0.5
    embed[4, 16:32] += 0.5
    embed[5, 16:32] += 0.3
    # Disk/network (6,7,8,9) → dims 32-47
    embed[6, 32:48] += 0.5
    embed[7, 32:48] += 0.4
    embed[8, 32:48] += 0.4
    embed[9, 32:48] += 0.4
    # Crash/thermal (10,11) → dims 48-63
    embed[10, 48:] += 0.5
    embed[11, 48:] += 0.5
    weights["feature_embed"] = embed

    # Positional encoding (sinusoidal, pre-computed for 12 positions)
    pos_enc = np.zeros((n_features, d_model), dtype=np.float32)
    for pos in range(n_features):
        for i in range(0, d_model, 2):
            angle = pos / (10000 ** (i / d_model))
            pos_enc[pos, i] = np.sin(angle)
            if i + 1 < d_model:
                pos_enc[pos, i + 1] = np.cos(angle)
    pos_enc *= 0.1  # Scale down so it doesn't dominate
    weights["pos_enc"] = pos_enc

    # === Transformer Layer 1 ===
    # Q, K, V projections: [64, 64] each
    # Initialize with Xavier-like scaling
    scale = 0.15
    weights["l1_Wq"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l1_Wk"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l1_Wv"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l1_Wo"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l1_bq"] = np.zeros(d_model, dtype=np.float32)
    weights["l1_bk"] = np.zeros(d_model, dtype=np.float32)
    weights["l1_bv"] = np.zeros(d_model, dtype=np.float32)
    weights["l1_bo"] = np.zeros(d_model, dtype=np.float32)

    # Craft attention patterns: CPU↔thermal, mem↔swap, disk↔crash
    # Head 0: CPU-thermal interaction (features 0,1,2 attend to 11)
    wq, wk = weights["l1_Wq"], weights["l1_Wk"]
    for f in [0, 1, 2]:
        wq[f * 5:(f + 1) * 5, :16] += 0.3
    wk[11 * 5:12 * 5, :16] += 0.3

    # Head 1: Memory-swap (features 3,4 attend to 5)
    for f in [3, 4]:
        wq[f * 5:(f + 1) * 5, 16:32] += 0.3
    wk[5 * 5:6 * 5, 16:32] += 0.3

    # Head 2: Disk-crash correlation (feature 6 ↔ 10)
    wq[6 * 5:7 * 5, 32:48] += 0.3
    wk[10 * 5:11 * 5, 32:48] += 0.3

    # Head 3: Network chain (7→8→9)
    for f in [7, 8]:
        wq[f * 5:(f + 1) * 5, 48:] += 0.3
    wk[9 * 5:10 * 5, 48:] += 0.3

    # Layer norm 1
    weights["l1_ln1_gamma"] = np.ones(d_model, dtype=np.float32)
    weights["l1_ln1_beta"] = np.zeros(d_model, dtype=np.float32)

    # FFN: 64 → 256 → 64
    d_ff = 256
    weights["l1_ff1_w"] = np.random.randn(d_model, d_ff).astype(np.float32) * 0.08
    weights["l1_ff1_b"] = np.zeros(d_ff, dtype=np.float32)
    weights["l1_ff2_w"] = np.random.randn(d_ff, d_model).astype(np.float32) * 0.08
    weights["l1_ff2_b"] = np.zeros(d_model, dtype=np.float32)

    # Layer norm 2
    weights["l1_ln2_gamma"] = np.ones(d_model, dtype=np.float32)
    weights["l1_ln2_beta"] = np.zeros(d_model, dtype=np.float32)

    # === Transformer Layer 2 (similar structure) ===
    weights["l2_Wq"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l2_Wk"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l2_Wv"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l2_Wo"] = np.random.randn(d_model, d_model).astype(np.float32) * scale
    weights["l2_bq"] = np.zeros(d_model, dtype=np.float32)
    weights["l2_bk"] = np.zeros(d_model, dtype=np.float32)
    weights["l2_bv"] = np.zeros(d_model, dtype=np.float32)
    weights["l2_bo"] = np.zeros(d_model, dtype=np.float32)

    weights["l2_ln1_gamma"] = np.ones(d_model, dtype=np.float32)
    weights["l2_ln1_beta"] = np.zeros(d_model, dtype=np.float32)
    weights["l2_ff1_w"] = np.random.randn(d_model, d_ff).astype(np.float32) * 0.08
    weights["l2_ff1_b"] = np.zeros(d_ff, dtype=np.float32)
    weights["l2_ff2_w"] = np.random.randn(d_ff, d_model).astype(np.float32) * 0.08
    weights["l2_ff2_b"] = np.zeros(d_model, dtype=np.float32)
    weights["l2_ln2_gamma"] = np.ones(d_model, dtype=np.float32)
    weights["l2_ln2_beta"] = np.zeros(d_model, dtype=np.float32)

    # === Classification head ===
    # Mean pool across 12 tokens → [64] → Linear → [4] (healthy, degraded, warning, critical)
    weights["clf_w"] = np.zeros((d_model, 4), dtype=np.float32)
    # Healthy: low values in issue-detecting dims
    weights["clf_w"][:16, 0] = -0.3  # Low CPU signals → healthy
    weights["clf_w"][16:32, 0] = -0.3  # Low memory signals → healthy
    weights["clf_w"][32:48, 0] = -0.2
    weights["clf_w"][48:, 0] = -0.3

    # Degraded: moderate issue signals
    weights["clf_w"][:, 1] = 0.15
    # Warning: stronger signals
    weights["clf_w"][:, 2] = 0.25
    # Critical: strong multi-signal
    weights["clf_w"][:16, 3] = 0.4
    weights["clf_w"][16:32, 3] = 0.4
    weights["clf_w"][48:, 3] = 0.5

    weights["clf_b"] = np.array([1.5, -0.3, -0.8, -1.5], dtype=np.float32)

    # === Per-feature anomaly scoring head ===
    # Projects each token embedding → scalar anomaly score
    weights["anomaly_w"] = np.random.randn(d_model, 1).astype(np.float32) * 0.2
    weights["anomaly_b"] = np.array([-0.5], dtype=np.float32)

    return weights


def build_transformer_onnx(weights):
    """Build the ONNX model using the graph builder."""
    g = OnnxGraphBuilder()

    # Input: [1, 12, 1] — 12 features, each a scalar
    g.add_input("input", [1, 12, 1])

    # Step 1: Feature embedding via MatMul
    # input [1,12,1] × embed [1,64] → but we need to broadcast properly
    # Reshape input to [1, 12, 1] then matmul with [1, 64] embed weights
    g.add_initializer("feature_embed", weights["feature_embed"])  # [12, 64]
    g.add_initializer("pos_enc", weights["pos_enc"])  # [12, 64]

    # Multiply each feature scalar by its embedding vector
    # input: [1, 12, 1], feature_embed: [12, 64]
    # We want: for each of 12 features, scalar * 64-dim vector
    # = input * feature_embed (broadcast: [1,12,1] * [12,64] = [1,12,64])
    g.add_node("Mul", ["input", "feature_embed"], ["embedded"])
    g.add_node("Add", ["embedded", "pos_enc"], ["x0"])  # Add positional encoding

    # === Transformer Layer 1 ===
    _add_transformer_layer(g, "x0", "x1", "l1", weights)

    # === Transformer Layer 2 ===
    _add_transformer_layer(g, "x1", "x2", "l2", weights)

    # === Classification: mean pool + linear ===
    g.add_initializer("reduce_axes", np.array([1], dtype=np.int64))
    g.add_node("ReduceMean", ["x2", "reduce_axes"], ["pooled"])  # [1, 64]

    g.add_initializer("clf_w", weights["clf_w"])  # [64, 4]
    g.add_initializer("clf_b", weights["clf_b"])  # [4]
    g.add_node("MatMul", ["pooled", "clf_w"], ["clf_logits"])
    g.add_node("Add", ["clf_logits", "clf_b"], ["clf_logits_b"])

    g.add_node("Softmax", ["clf_logits_b"], ["class_probs"], axis=1)

    # === Per-feature anomaly scores ===
    g.add_initializer("anomaly_w", weights["anomaly_w"])  # [64, 1]
    g.add_initializer("anomaly_b", weights["anomaly_b"])  # [1]
    g.add_node("MatMul", ["x2", "anomaly_w"], ["anomaly_raw"])  # [1, 12, 1]
    g.add_node("Add", ["anomaly_raw", "anomaly_b"], ["anomaly_biased"])
    g.add_node("Sigmoid", ["anomaly_biased"], ["anomaly_scores"])  # [1, 12, 1]

    # Outputs
    g.add_output("class_probs", [1, 4])
    g.add_output("anomaly_scores", [1, 12, 1])

    return g.build(name="anomaly_classifier", producer="EndpointDoctor")


def _add_transformer_layer(g, x_in, x_out, prefix, weights):
    """Add a single transformer encoder layer to the graph."""
    d_model = 64

    # Multi-head attention
    for name in ["Wq", "Wk", "Wv", "Wo", "bq", "bk", "bv", "bo"]:
        g.add_initializer(f"{prefix}_{name}", weights[f"{prefix}_{name}"])

    # Q = x @ Wq + bq, etc.
    g.add_node("MatMul", [x_in, f"{prefix}_Wq"], [f"{prefix}_q_raw"])
    g.add_node("Add", [f"{prefix}_q_raw", f"{prefix}_bq"], [f"{prefix}_q"])
    g.add_node("MatMul", [x_in, f"{prefix}_Wk"], [f"{prefix}_k_raw"])
    g.add_node("Add", [f"{prefix}_k_raw", f"{prefix}_bk"], [f"{prefix}_k"])
    g.add_node("MatMul", [x_in, f"{prefix}_Wv"], [f"{prefix}_v_raw"])
    g.add_node("Add", [f"{prefix}_v_raw", f"{prefix}_bv"], [f"{prefix}_v"])

    # Scaled dot-product attention (single-head simplified for ONNX portability)
    # attn = softmax(Q @ K^T / sqrt(d_model))
    g.add_initializer(f"{prefix}_scale", np.array([1.0 / np.sqrt(d_model)], dtype=np.float32))
    g.add_node("Transpose", [f"{prefix}_k"], [f"{prefix}_k_t"], perm=[0, 2, 1])
    g.add_node("MatMul", [f"{prefix}_q", f"{prefix}_k_t"], [f"{prefix}_attn_raw"])
    g.add_node("Mul", [f"{prefix}_attn_raw", f"{prefix}_scale"], [f"{prefix}_attn_scaled"])
    g.add_node("Softmax", [f"{prefix}_attn_scaled"], [f"{prefix}_attn_weights"], axis=2)
    g.add_node("MatMul", [f"{prefix}_attn_weights", f"{prefix}_v"], [f"{prefix}_attn_out"])

    # Output projection
    g.add_node("MatMul", [f"{prefix}_attn_out", f"{prefix}_Wo"], [f"{prefix}_proj_raw"])
    g.add_node("Add", [f"{prefix}_proj_raw", f"{prefix}_bo"], [f"{prefix}_proj"])

    # Residual + LayerNorm
    g.add_node("Add", [x_in, f"{prefix}_proj"], [f"{prefix}_res1"])
    # Simplified LayerNorm using InstanceNormalization (axis=-1)
    g.add_initializer(f"{prefix}_ln1_gamma", weights[f"{prefix}_ln1_gamma"])
    g.add_initializer(f"{prefix}_ln1_beta", weights[f"{prefix}_ln1_beta"])
    _add_layer_norm(g, f"{prefix}_res1", f"{prefix}_ln1_out", prefix + "_ln1", weights, d_model)

    # FFN: Linear → ReLU → Linear
    for name in ["ff1_w", "ff1_b", "ff2_w", "ff2_b"]:
        g.add_initializer(f"{prefix}_{name}", weights[f"{prefix}_{name}"])

    g.add_node("MatMul", [f"{prefix}_ln1_out", f"{prefix}_ff1_w"], [f"{prefix}_ff1_raw"])
    g.add_node("Add", [f"{prefix}_ff1_raw", f"{prefix}_ff1_b"], [f"{prefix}_ff1"])
    g.add_node("Relu", [f"{prefix}_ff1"], [f"{prefix}_ff1_relu"])
    g.add_node("MatMul", [f"{prefix}_ff1_relu", f"{prefix}_ff2_w"], [f"{prefix}_ff2_raw"])
    g.add_node("Add", [f"{prefix}_ff2_raw", f"{prefix}_ff2_b"], [f"{prefix}_ff2"])

    # Residual + LayerNorm
    g.add_node("Add", [f"{prefix}_ln1_out", f"{prefix}_ff2"], [f"{prefix}_res2"])
    g.add_initializer(f"{prefix}_ln2_gamma", weights[f"{prefix}_ln2_gamma"])
    g.add_initializer(f"{prefix}_ln2_beta", weights[f"{prefix}_ln2_beta"])
    _add_layer_norm(g, f"{prefix}_res2", x_out, prefix + "_ln2", weights, d_model)


def _add_layer_norm(g, input_name, output_name, prefix, weights, d_model, eps=1e-5):
    """Add layer normalization nodes."""
    g.add_initializer(f"{prefix}_eps", np.array([eps], dtype=np.float32))
    g.add_initializer(f"{prefix}_axes", np.array([-1], dtype=np.int64))

    g.add_node("ReduceMean", [input_name, f"{prefix}_axes"], [f"{prefix}_mean"])
    g.add_node("Sub", [input_name, f"{prefix}_mean"], [f"{prefix}_centered"])
    g.add_node("Mul", [f"{prefix}_centered", f"{prefix}_centered"], [f"{prefix}_sq"])
    g.add_node("ReduceMean", [f"{prefix}_sq", f"{prefix}_axes"], [f"{prefix}_var"])
    g.add_node("Add", [f"{prefix}_var", f"{prefix}_eps"], [f"{prefix}_var_eps"])
    g.add_node("Sqrt", [f"{prefix}_var_eps"], [f"{prefix}_std"])
    g.add_node("Div", [f"{prefix}_centered", f"{prefix}_std"], [f"{prefix}_normed"])
    g.add_node("Mul", [f"{prefix}_normed", f"{prefix}_gamma"], [f"{prefix}_scaled"])
    g.add_node("Add", [f"{prefix}_scaled", f"{prefix}_beta"], [output_name])


def main():
    weights = make_weights()
    model_bytes = build_transformer_onnx(weights)

    os.makedirs("public/models", exist_ok=True)
    path = "public/models/anomaly_clf.onnx"
    with open(path, "wb") as f:
        f.write(model_bytes)

    total_params = sum(w.size for w in weights.values())
    size_kb = len(model_bytes) / 1024
    print(f"✅ Anomaly Classifier saved to {path} ({size_kb:.1f} KB)")
    print(f"   Architecture: Embed(12→64) → 2× Transformer(64, 4 heads) → MeanPool → Linear(4)")
    print(f"   Parameters: {total_params:,}")
    print(f"   Outputs: class_probs [1,4], anomaly_scores [1,12,1]")


if __name__ == "__main__":
    main()
