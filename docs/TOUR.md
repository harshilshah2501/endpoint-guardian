# Comprehensive Product Tour

This is the practical, end-to-end guide for using EndpointDoctor in real workflows.

## 1. Choose Runtime Mode

### Web mode
- Start with `npm run dev`.
- Uses scenario snapshots and optional custom JSON.
- Best for product evaluation and deterministic demos.

### Desktop mode (Electron)
- Build and launch with `npm run build` then `npx electron .`.
- Adds live host telemetry, background monitoring, tray status, and notifications.
- Best for real endpoint triage on the local machine.

## 2. Understand the Main UI Areas

### Diagnostics tab
- Select data source (scenario, custom snapshot JSON, or live scan in desktop).
- Run `Quick Diagnosis` or `Deep Analysis`.
- Read the result cards and remediation tiers.

### Issue Catalog tab
- Reference library for each issue class and its logic/remediations.

### Safety tab
- Explains action tiers:
	- `diagnostic`: read-only investigation.
	- `basic`: potentially impactful actions requiring user confirmation.
	- `advanced`: auto-safe actions with guardrails.

### Roadmap tab
- Product direction and future capabilities.

## 3. Pick Input Snapshot Type

### Scenario snapshots
- Built-in controlled scenarios such as high CPU, memory crisis, DNS failure, and thermal crisis.
- Fastest path to learning result interpretation.

### Custom JSON
- Paste a full `EndpointSnapshot` payload and apply.
- Useful for external telemetry ingestion and reproducible tests.

### Live Scan (desktop only)
- Collects host-level CPU, memory, disk, process, and network checks.
- Ideal for active troubleshooting.

## 4. Run the Right Analysis Mode

### Quick Diagnosis
- Runs deterministic rules engine plus anomaly classifier.
- Designed for low-latency triage.
- Use this first in almost all workflows.

### Deep Analysis
- First attempts optional cloud deep analysis (`diagnose-deep` function).
- If unavailable, automatically falls back to local deep transformer pipeline.
- Adds causal chain output and ML-ranked remediations when models are loaded.

## 5. Interpret Results in Correct Order

1. Overall health and summary (`healthy`, `degraded`, `critical`).
2. Priority action to execute first.
3. Per-issue cards (severity, confidence, explanation).
4. Contributing signals (measured value vs threshold).
5. Remediation actions by safety tier.
6. Post-verification checks.
7. Optional transformer panels:
   - anomaly class probabilities
   - per-feature anomaly scores
   - causal edges and strengths
   - ML-ranked action list

## 6. Recommended First 10 Minutes

1. Run `Healthy Endpoint` with Quick Diagnosis.
2. Run `High CPU` with Quick Diagnosis.
3. Run the same `High CPU` snapshot with Deep Analysis.
4. Compare what deep mode adds over quick mode.
5. Run `Multi-Issue Cascade` and inspect cross-signal behavior.
6. Open Safety tab and map actions to trust boundaries.

## 7. Real Machine Triage Workflow (Desktop)

1. Click `Live Scan`.
2. Run Quick Diagnosis.
3. Execute top `diagnostic` action(s) first.
4. Re-scan and compare.
5. If still unresolved, run Deep Analysis.
6. Move to `basic` then `advanced` actions only as needed.
7. Re-scan after each action to validate impact.

## 8. Fallback and Reliability Behavior

- Rules engine is always available and always executed.
- ONNX models are loaded opportunistically; partial model availability is supported.
- Deep cloud analysis is optional; local fallback is automatic.
- If no model can load, diagnostics still work in rules-only mode.

