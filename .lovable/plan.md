

## Plan: Specialized Micro-Transformer Architecture for System Diagnostics

### What We're Building

Replace the hand-crafted 261-parameter ONNX model with **three purpose-built micro-transformers** that run entirely offline via ONNX Runtime WASM. No LLMs, no cloud dependency for diagnostics.

### Architecture

```text
Telemetry Snapshot (12+ features)
        │
        ▼
┌──────────────────────┐
│  Feature Encoder     │  Shared embedding layer (~0.5MB)
│  Normalize + Project │  Maps raw metrics → 64-dim vectors
└──────┬───────────────┘
       │
       ├──────────────────────────┐
       ▼                          ▼
┌─────────────────┐    ┌──────────────────────┐
│ Anomaly Clf     │    │ Causal Attention     │
│ 2-layer encoder │    │ Cross-signal ranker  │
│ → health class  │    │ → root cause chain   │
│ (~2MB)          │    │ (~3MB)               │
└────────┬────────┘    └──────────┬───────────┘
         │                        │
         └────────┬───────────────┘
                  ▼
         ┌────────────────┐
         │ Remediation    │
         │ Selector       │
         │ → action plan  │
         │ (~1MB)         │
         └────────────────┘
```

**Total model footprint: ~6MB**
**RAM during inference: ~50-100MB**
**Inference latency: <500ms on CPU**

### Model Details

**Model 1 — Anomaly Classifier (replaces current ONNX model)**
- Architecture: 2-layer transformer encoder, 64-dim, 4 heads
- Input: 12 telemetry features as a token sequence (each metric = one token)
- Output: 4-class softmax (healthy / degraded / warning / critical) + per-feature anomaly scores
- Why transformer: Self-attention learns which feature *combinations* matter (CPU+thermal, disk+crashes)

**Model 2 — Causal Attention Ranker**
- Architecture: 2-layer cross-attention, 64-dim
- Input: Feature embeddings from Model 1
- Output: Causal adjacency matrix — which signal drives which
- Key: Attention weights ARE the causal graph. No post-hoc explanation needed.
- Example output: `thermal_throttle ← high_cpu (0.87), app_crash ← low_disk (0.72)`

**Model 3 — Remediation Selector**
- Architecture: 1-layer transformer + classification head
- Input: Issue class embeddings + system context
- Output: Ranked remediation actions with confidence scores
- Trained on: "which action resolved this pattern" historical data

### Implementation Steps

1. **Create model generation scripts** (`scripts/generate-anomaly-clf.py`, `scripts/generate-causal-ranker.py`, `scripts/generate-remediation-selector.py`)
   - Build each model using PyTorch/numpy, export to ONNX
   - Hand-craft initial weights encoding domain expertise (same approach as current model, but with attention layers)
   - Output to `public/models/`

2. **Update ONNX model manager** (`src/engine/onnx-model-manager.ts`)
   - Support loading multiple named models with lazy-loading
   - Add model registry: `anomaly_clf`, `causal_ranker`, `remediation_selector`
   - Load models on-demand, unload after 60s idle

3. **Create specialized inference pipelines** (`src/engine/`)
   - `anomaly-classifier.ts` — Feature encoding + anomaly classification
   - `causal-ranker.ts` — Cross-signal causal analysis using attention outputs
   - `remediation-selector.ts` — Context-aware action ranking

4. **Update local-inference.ts**
   - Wire three models into the existing `runLocalInference()` pipeline
   - Quick mode: anomaly classifier only (~100ms)
   - Deep mode: all three models in sequence (~300-500ms)
   - Graceful fallback: if models fail to load, use current rules engine

5. **Update DiagnosisView.tsx**
   - Show causal chain visualization (which signal → which issue)
   - Display attention-derived confidence for each diagnosis
   - Show "Transformer-Powered" badge instead of "AI-Powered"

6. **Keep cloud AI as optional premium tier**
   - `diagnose-deep` edge function remains for users who want LLM-grade natural language explanations
   - Local transformers handle all diagnostic reasoning offline

### Technical Notes

- All models run through existing ONNX Runtime WASM infrastructure — no new runtime dependencies
- The current 261-parameter model in `public/models/anomaly_detector.onnx` gets replaced by the anomaly classifier
- Training data: initially hand-crafted weights (domain expertise), with a path to real training once telemetry data is collected
- The `scripts/generate-model.py` pattern already exists — we extend it for transformer architectures

### Footprint Comparison

```text
Current:    ~155MB (Electron) + 1.5KB (model) = ~155MB
Proposed:   ~155MB (Electron) + 6MB (models)  = ~161MB
With Tauri: ~15MB  (Tauri)    + 6MB (models)  = ~21MB
```

