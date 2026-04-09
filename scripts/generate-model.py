"""
Generate a small ONNX anomaly detection model for EndpointDoctor.

This creates a simple neural network that classifies endpoint health:
  Input:  12 features (cpu, memory, disk, network, crashes, thermal)
  Output: 3 probabilities (normal, warning, critical)

The model uses hand-crafted weights that encode domain knowledge,
making it a "compiled expert system" in neural network form.
Run: python3 scripts/generate-model.py
Output: public/models/anomaly_detector.onnx (~5KB)
"""

import numpy as np
import struct
import os

def make_onnx_model():
    """Build a minimal ONNX protobuf by hand (no onnx/torch dependency)."""
    
    # We'll build the ONNX protobuf manually to avoid heavy dependencies.
    # Architecture: Linear(12→16) → ReLU → Linear(16→3) → Softmax
    
    # Expert-crafted weights for layer 1 (12 inputs → 16 hidden)
    # Each row detects a specific pattern
    np.random.seed(42)
    
    # W1: 16x12 - each of 16 neurons detects a pattern
    W1 = np.zeros((16, 12), dtype=np.float32)
    
    # Neuron 0-2: CPU issue detectors
    W1[0] = [2.0, 1.5, 0.5, 0, 0, 0, 0, 0, 0, 0, 0, 0.5]  # high CPU
    W1[1] = [1.0, 2.0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1.0]     # sustained CPU + thermal
    W1[2] = [0.5, 0.5, 2.0, 0, 0, 0, 0, 0, 0, 0, 0, 2.0]   # thermal focus
    
    # Neuron 3-5: Memory issue detectors
    W1[3] = [0, 0, 0, 2.0, 1.5, 0.5, 0, 0, 0, 0, 0, 0]     # high memory
    W1[4] = [0, 0, 0, 1.0, 2.0, 1.0, 0, 0, 0, 0, 0, 0]     # memory pressure
    W1[5] = [0, 0, 0, 0.5, 0.5, 2.0, 0, 0, 0, 0, 0, 0]     # swap heavy
    
    # Neuron 6-7: Disk issue detectors
    W1[6] = [0, 0, 0, 0, 0, 0, 2.5, 0, 0, 0, 0.5, 0]       # disk full
    W1[7] = [0, 0, 0, 0, 0, 0, 1.5, 0, 0, 0, 1.0, 0]       # disk + crashes
    
    # Neuron 8-10: Network issue detectors
    W1[8]  = [0, 0, 0, 0, 0, 0, 0, 2.0, 1.0, 0.5, 0, 0]    # DNS fail
    W1[9]  = [0, 0, 0, 0, 0, 0, 0, 0.5, 2.0, 1.0, 0, 0]    # gateway fail
    W1[10] = [0, 0, 0, 0, 0, 0, 0, 1.0, 1.0, 2.0, 0, 0]    # internet fail
    
    # Neuron 11-12: Crash/stability detectors
    W1[11] = [0.3, 0.3, 0, 0.3, 0, 0, 0.3, 0, 0, 0, 2.0, 0]  # crash pattern
    W1[12] = [0.5, 0.5, 0.5, 0.5, 0, 0, 0.5, 0, 0, 0, 1.0, 0.5]  # multi-issue
    
    # Neuron 13-15: Overall health indicators
    W1[13] = [-1.0]*12  # inverse — fires when everything is low (healthy)
    W1[14] = [0.3]*12   # general stress detector
    W1[15] = [0.5, 0.5, 0.8, 0.5, 0.8, 0.3, 0.5, 0.8, 0.8, 0.8, 0.5, 0.8]  # critical combo
    
    B1 = np.array([-0.5]*13 + [1.5, -1.0, -2.0], dtype=np.float32)
    
    # W2: 3x16 - map hidden to [normal, warning, critical]
    W2 = np.zeros((3, 16), dtype=np.float32)
    # Normal: high when healthy neuron fires, low when issue neurons fire
    W2[0] = [-0.5, -0.5, -0.3, -0.5, -0.5, -0.3, -0.5, -0.3, -0.5, -0.5, -0.5, -0.3, -0.5, 2.0, -0.5, -1.0]
    # Warning: moderate issue signals
    W2[1] = [0.5, 0.3, 0.3, 0.5, 0.3, 0.3, 0.5, 0.3, 0.3, 0.3, 0.3, 0.5, 0.3, -0.5, 1.0, 0.3]
    # Critical: strong issue signals + multi-issue
    W2[2] = [1.0, 0.8, 0.8, 1.0, 0.8, 0.5, 1.0, 0.5, 1.0, 0.8, 0.8, 0.5, 1.5, -1.0, 0.5, 2.0]
    
    B2 = np.array([1.0, -0.3, -1.5], dtype=np.float32)
    
    return W1, B1, W2, B2


def float_to_bytes(arr):
    return arr.tobytes()


def write_varint(value):
    result = bytearray()
    while value > 0x7f:
        result.append((value & 0x7f) | 0x80)
        value >>= 7
    result.append(value & 0x7f)
    return bytes(result)


def write_field(field_num, wire_type, data):
    tag = (field_num << 3) | wire_type
    result = write_varint(tag)
    if wire_type == 2:  # length-delimited
        result += write_varint(len(data))
        result += data
    elif wire_type == 0:  # varint
        result += write_varint(data)
    return result


def write_string(field_num, s):
    return write_field(field_num, 2, s.encode('utf-8'))


def write_int(field_num, v):
    return write_field(field_num, 0, v)


def write_tensor(name, dims, data_type, float_data):
    """Create an ONNX TensorProto."""
    result = b""
    for d in dims:
        result += write_int(1, d)  # dims
    result += write_int(2, data_type)  # data_type (1=FLOAT)
    result += write_string(8, name)  # name
    result += write_field(4, 2, float_data)  # raw_data
    return result


def write_value_info(name, elem_type, shape):
    """Create a ValueInfoProto."""
    # Build TensorShapeProto
    shape_proto = b""
    for dim in shape:
        dim_proto = write_int(1, dim)  # dim_value
        shape_proto += write_field(1, 2, dim_proto)
    
    # TypeProto.Tensor
    tensor_type = write_int(1, elem_type) + write_field(2, 2, shape_proto)
    # TypeProto
    type_proto = write_field(1, 2, tensor_type)
    # ValueInfoProto
    return write_string(1, name) + write_field(2, 2, type_proto)


def write_node(op_type, inputs, outputs, name=""):
    """Create a NodeProto."""
    result = b""
    for inp in inputs:
        result += write_string(1, inp)
    for out in outputs:
        result += write_string(2, out)
    result += write_string(3, name)
    result += write_string(4, op_type)
    return result


def write_attribute_int(name, value):
    result = write_string(1, name)
    result += write_int(2, value)  # i
    result += write_int(20, 2)  # type = INT
    return result


def build_onnx_model(W1, B1, W2, B2):
    """Build complete ONNX model protobuf."""
    
    # Initializers (weights)
    init_w1 = write_tensor("W1", [16, 12], 1, float_to_bytes(W1.flatten()))
    init_b1 = write_tensor("B1", [16], 1, float_to_bytes(B1))
    init_w2 = write_tensor("W2", [3, 16], 1, float_to_bytes(W2.flatten()))
    init_b2 = write_tensor("B2", [3], 1, float_to_bytes(B2))
    
    # Graph inputs/outputs
    input_vi = write_value_info("input", 1, [1, 12])
    output_vi = write_value_info("output", 1, [1, 3])
    
    # Nodes: input -> MatMul(W1^T) -> Add(B1) -> Relu -> MatMul(W2^T) -> Add(B2) -> Softmax -> output
    node1 = write_node("Transpose", ["W1"], ["W1_T"], "transpose_w1")
    # Add attribute: perm = [1, 0]
    attr_perm = write_string(1, "perm")  # name
    attr_perm += write_int(7, 1)  # ints
    attr_perm += write_int(7, 0)  # ints
    attr_perm += write_int(20, 7)  # type = INTS
    node1 += write_field(5, 2, attr_perm)
    
    node2 = write_node("MatMul", ["input", "W1_T"], ["matmul1_out"], "matmul1")
    node3 = write_node("Add", ["matmul1_out", "B1"], ["add1_out"], "add1")
    node4 = write_node("Relu", ["add1_out"], ["relu_out"], "relu1")
    
    node5 = write_node("Transpose", ["W2"], ["W2_T"], "transpose_w2")
    node5 += write_field(5, 2, attr_perm)
    
    node6 = write_node("MatMul", ["relu_out", "W2_T"], ["matmul2_out"], "matmul2")
    node7 = write_node("Add", ["matmul2_out", "B2"], ["add2_out"], "add2")
    
    # Softmax with axis attribute
    node8_base = write_node("Softmax", ["add2_out"], ["output"], "softmax1")
    attr_axis = write_string(1, "axis")
    attr_axis += write_int(2, 1)  # i = 1 (but we need to handle this properly)
    attr_axis += write_int(20, 2)  # type = INT
    node8 = node8_base + write_field(5, 2, attr_axis)
    
    # Build GraphProto
    graph = b""
    for node in [node1, node2, node3, node4, node5, node6, node7, node8]:
        graph += write_field(1, 2, node)  # node
    graph += write_string(2, "anomaly_detector")  # name
    graph += write_field(11, 2, input_vi)  # input
    graph += write_field(12, 2, output_vi)  # output
    for init in [init_w1, init_b1, init_w2, init_b2]:
        graph += write_field(5, 2, init)  # initializer
    
    # Build OperatorSetIdProto
    opset = write_string(1, "") + write_int(2, 13)  # domain="" version=13
    
    # Build ModelProto
    model = b""
    model += write_int(1, 7)  # ir_version
    model += write_field(8, 2, opset)  # opset_import
    model += write_string(2, "EndpointDoctor")  # producer_name
    model += write_string(5, "1.0.0")  # model_version as doc_string
    model += write_field(7, 2, graph)  # graph
    
    return model


def main():
    W1, B1, W2, B2 = make_onnx_model()
    model_bytes = build_onnx_model(W1, B1, W2, B2)
    
    os.makedirs("public/models", exist_ok=True)
    output_path = "public/models/anomaly_detector.onnx"
    with open(output_path, "wb") as f:
        f.write(model_bytes)
    
    size_kb = len(model_bytes) / 1024
    print(f"✅ Model saved to {output_path} ({size_kb:.1f} KB)")
    print(f"   Architecture: Linear(12→16) → ReLU → Linear(16→3) → Softmax")
    print(f"   Weights: {W1.size + B1.size + W2.size + B2.size} parameters")
    
    # Quick test: simulate features
    features = np.array([0.9, 0.85, 0.8, 0.3, 0.0, 0.01, 0.55, 0, 0, 0, 0, 0], dtype=np.float32)
    
    # Forward pass manually to verify
    h = np.maximum(0, features @ W1.T + B1)
    logits = h @ W2.T + B2
    exp_logits = np.exp(logits - np.max(logits))
    probs = exp_logits / exp_logits.sum()
    print(f"   Test (high CPU): normal={probs[0]:.3f} warning={probs[1]:.3f} critical={probs[2]:.3f}")
    
    features2 = np.array([0.2, 0.15, 0.4, 0.2, 0.0, 0.01, 0.3, 0, 0, 0, 0, 0], dtype=np.float32)
    h2 = np.maximum(0, features2 @ W1.T + B1)
    logits2 = h2 @ W2.T + B2
    exp_logits2 = np.exp(logits2 - np.max(logits2))
    probs2 = exp_logits2 / exp_logits2.sum()
    print(f"   Test (healthy):  normal={probs2[0]:.3f} warning={probs2[1]:.3f} critical={probs2[2]:.3f}")


if __name__ == "__main__":
    main()
