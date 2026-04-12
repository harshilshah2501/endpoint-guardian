# System Deep Dive: How EndpointDoctor Works

This document describes the full pipeline from raw telemetry to actionable remediations.

## 1. Data Model

Each run is driven by one `EndpointSnapshot` containing:
- host and OS metadata
- CPU usage and temperature
- memory and swap state
- disk capacity/free state
- top processes
- network reachability checks
- service states
- crash history
- update metadata
- startup metrics
- battery and thermal status

Source type can be scenario-generated, custom JSON, or live desktop telemetry.

## 2. Runtime Flow

1. Snapshot acquisition:
- Web: scenario generator or pasted JSON.
- Desktop: IPC to Electron main process telemetry collector.

2. Diagnosis orchestration (`useDiagnosis`):
- User selects Quick or Deep.
- Deep first tries optional cloud function.
- If cloud unavailable, falls back locally.

3. Local diagnosis (`runLocalInference`):
- Phase A: deterministic rules always execute.
- Phase B: anomaly classifier executes in Quick and Deep.
- Phase C (Deep only): causal ranker and remediation selector execute.

4. Result assembly:
- Merge rule diagnoses with optional transformer outputs.
- Derive summary, overall health, priority action.
- Render cards, signal evidence, and remediation tiers.

## 3. Deterministic Rules Engine

The rules engine is the reliability baseline and executes regardless of model availability.

### Detector families
- high CPU
- high memory
- low disk
- network/DNS failures
- crash storms
- thermal/battery degradation
- slow startup
- service stop/loop
- update staleness
- disk-intensive process pattern

### Rule output schema
Each diagnosis returns:
- `issue_class`
- severity (`critical`/`warning`/`info`)
- confidence
- human-readable explanation
- explicit contributing signals (`value` vs `threshold`)
- tiered remediations
- post-verification check

## 4. Feature Extraction For Models

The ONNX pipeline converts snapshot data into a normalized 12-feature vector:

1. `cpu_1m`
2. `cpu_5m`
3. `cpu_temp`
4. `mem_used_pct`
5. `mem_pressure`
6. `swap_usage`
7. `disk_used_pct`
8. `dns_fail`
9. `gateway_fail`
10. `internet_fail`
11. `crash_rate`
12. `thermal_throttle`

This vector is shaped to `[1, 12, 1]` for model inference.

## 5. ONNX Model Manager Behavior

### Loading strategy
- `anomaly_clf` eagerly loaded at init.
- `causal_ranker` and `remediation_selector` lazy-loaded when deep mode runs.
- idle unload timeout used for deep models to keep memory footprint low.

### Execution backend
- ONNX Runtime Web (WASM execution provider).
- single-threaded configuration for predictable local runtime.

## 6. Health and Severity Composition

- Rules produce one or more diagnoses with severity.
- Overall health policy:
  - if any critical issue exists -> `critical`
  - else if any warning/info issue exists -> `degraded`
  - else -> `healthy`

Transformer outputs can enrich or escalate severity (for example anomaly class upgrade paths).

## 7. Desktop Telemetry Internals

Desktop mode collects from Node/system APIs:
- CPU sampled over time window
- process list by platform-specific commands
- memory and swap metrics
- disk capacity/free
- DNS/gateway/internet connectivity checks
- optional CPU temperature where available

Background tray monitor performs lightweight health checks periodically and emits notifications on health state transitions.

## 8. Reliability and Safety Design

- Rules-first architecture prevents total failure if models cannot load.
- Deep mode is additive; never required for baseline diagnostics.
- Action tiers encode risk boundaries.
- Post-verification is explicit to close the loop after remediation.

