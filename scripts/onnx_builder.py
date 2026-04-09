"""
Shared ONNX protobuf builder — constructs ONNX models from scratch without
requiring the onnx or torch packages. Builds raw protobuf bytes.
"""

import numpy as np


def _write_varint(value):
    result = bytearray()
    while value > 0x7f:
        result.append((value & 0x7f) | 0x80)
        value >>= 7
    result.append(value & 0x7f)
    return bytes(result)


def _write_svarint(value):
    """Signed varint using zigzag encoding."""
    zigzag = (value << 1) ^ (value >> 63)
    return _write_varint(zigzag & 0xFFFFFFFFFFFFFFFF)


def _write_field(field_num, wire_type, data):
    tag = (field_num << 3) | wire_type
    result = _write_varint(tag)
    if wire_type == 2:
        result += _write_varint(len(data))
        result += data
    elif wire_type == 0:
        result += _write_varint(data)
    return result


def _write_string(field_num, s):
    return _write_field(field_num, 2, s.encode("utf-8"))


def _write_int(field_num, v):
    return _write_field(field_num, 0, v)


def _write_tensor(name, dims, data_type, raw_data):
    result = b""
    for d in dims:
        result += _write_int(1, d)
    result += _write_int(2, data_type)  # 1=FLOAT, 7=INT64
    result += _write_string(8, name)
    result += _write_field(4, 2, raw_data)
    return result


def _write_value_info(name, elem_type, shape):
    shape_proto = b""
    for dim in shape:
        dim_proto = _write_int(1, dim)
        shape_proto += _write_field(1, 2, dim_proto)

    tensor_type = _write_int(1, elem_type) + _write_field(2, 2, shape_proto)
    type_proto = _write_field(1, 2, tensor_type)
    return _write_string(1, name) + _write_field(2, 2, type_proto)


def _write_node(op_type, inputs, outputs, name="", attributes=None):
    result = b""
    for inp in inputs:
        result += _write_string(1, inp)
    for out in outputs:
        result += _write_string(2, out)
    result += _write_string(3, name)
    result += _write_string(4, op_type)
    if attributes:
        for attr_bytes in attributes:
            result += _write_field(5, 2, attr_bytes)
    return result


def _make_int_attr(name, value):
    result = _write_string(1, name)
    result += _write_int(2, value)
    result += _write_int(20, 2)  # type = INT
    return result


def _make_ints_attr(name, values):
    result = _write_string(1, name)
    for v in values:
        result += _write_int(7, v)
    result += _write_int(20, 7)  # type = INTS
    return result


class OnnxGraphBuilder:
    def __init__(self):
        self._nodes = []
        self._initializers = []
        self._inputs = []
        self._outputs = []

    def add_input(self, name, shape, elem_type=1):
        self._inputs.append((name, elem_type, shape))

    def add_output(self, name, shape, elem_type=1):
        self._outputs.append((name, elem_type, shape))

    def add_initializer(self, name, data):
        if isinstance(data, np.ndarray):
            if data.dtype == np.float32:
                dt = 1
            elif data.dtype == np.int64:
                dt = 7
            else:
                data = data.astype(np.float32)
                dt = 1
            self._initializers.append((name, list(data.shape), dt, data.tobytes()))
        else:
            raise ValueError(f"Expected numpy array, got {type(data)}")

    def add_node(self, op_type, inputs, outputs, name=None, **kwargs):
        if name is None:
            name = f"{op_type.lower()}_{len(self._nodes)}"
        attrs = []
        for k, v in kwargs.items():
            if isinstance(v, int):
                attrs.append(_make_int_attr(k, v))
            elif isinstance(v, (list, tuple)) and all(isinstance(x, int) for x in v):
                attrs.append(_make_ints_attr(k, v))
        self._nodes.append(_write_node(op_type, inputs, outputs, name, attrs if attrs else None))

    def build(self, name="model", producer="EndpointDoctor", opset=13):
        graph = b""
        for node_bytes in self._nodes:
            graph += _write_field(1, 2, node_bytes)
        graph += _write_string(2, name)

        for inp_name, inp_type, inp_shape in self._inputs:
            graph += _write_field(11, 2, _write_value_info(inp_name, inp_type, inp_shape))

        for out_name, out_type, out_shape in self._outputs:
            graph += _write_field(12, 2, _write_value_info(out_name, out_type, out_shape))

        for init_name, init_dims, init_dt, init_data in self._initializers:
            graph += _write_field(5, 2, _write_tensor(init_name, init_dims, init_dt, init_data))

        opset_proto = _write_string(1, "") + _write_int(2, opset)

        model = b""
        model += _write_int(1, 7)  # ir_version
        model += _write_field(8, 2, opset_proto)
        model += _write_string(2, producer)
        model += _write_field(7, 2, graph)

        return model
