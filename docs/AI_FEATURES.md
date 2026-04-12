# AI and Transformer Features: What They Are and How They Work

This document details the specialized AI-enabled capabilities in EndpointDoctor.

## 1. Transformer-Powered Anomaly Classification

### Model
- `anomaly_clf.onnx`

### Inputs
- normalized 12-feature endpoint vector (`[1, 12, 1]`).

### Outputs
- `class_probs` over 4 health classes: `healthy`, `degraded`, `warning`, `critical`.
- `anomaly_scores`: per-feature anomaly intensity.

### How it is used
- Runs in both Quick and Deep mode.
- Adds confidence-aware health interpretation.
- Can escalate the summary/health when strong critical anomaly signatures are present.

### Operator value
- Catches non-trivial multivariate patterns that pure thresholds can miss.
- Provides feature-wise anomaly hints for faster root-cause navigation.

## 2. Causal Chain Ranking (Deep Mode)

### Model
- `causal_ranker.onnx`

### Inputs
- same normalized 12-feature vector.

### Outputs
- `causal_matrix` (feature-to-feature influence strengths).
- `attention_weights` (internal attention signals).
- extracted top causal edges (`source -> target` with strength).

### How it is used
- Deep mode computes candidate causal edges above score thresholds.
- UI shows strongest chains (for example `cpu_5m -> thermal_throttle`).
- Summary text is enriched with top causal chains.

### Operator value
- Helps distinguish symptom vs likely driver.
- Improves remediation ordering for multi-issue incidents.

## 3. ML-Ranked Remediation Selection (Deep Mode)

### Model
- `remediation_selector.onnx`

### Inputs
- same normalized 12-feature vector.

### Outputs
- `action_scores` over predefined remediation actions.
- per-action `tier_probs` for `diagnostic/basic/advanced` tier suggestions.
- sorted ranked action list.

### How it is used
- Candidate actions below minimum confidence are filtered.
- Remaining actions are ranked and tagged with predicted tier.
- Displayed as ML-ranked suggestions alongside rule remediations.

### Operator value
- Prioritizes probable high-impact next steps.
- Adds confidence signal to action ordering decisions.

## 4. Optional Cloud Deep Analysis

### Path
- Supabase function `diagnose-deep` (if available).

### Behavior
- Invoked first for Deep mode.
- If unavailable or failing, system falls back to local deep transformers automatically.

### Operator value
- Natural-language enriched analysis in connected environments.
- No hard dependency; offline-first guarantee remains intact.

## 5. AI Safety and Guardrail Model

EndpointDoctor uses a layered guardrail design rather than unconstrained autonomous execution.

- deterministic rules always run and remain authoritative baseline
- AI output is additive decision support
- remediation tiers enforce risk boundaries
- post-verification checks are attached to actions
- deep features are optional and degradable without breaking triage

## 6. Current Limits (Important)

- AI works on current snapshot features, not long-term history windows by default.
- Causal edges are ranking heuristics, not formal causal proofs.
- Remediation ranking improves prioritization but should still be reviewed by operator context.

## 7. What Is Specialized Here

The specialization is not generic chat; it is endpoint-diagnostics-specific intelligence:
- domain-shaped feature extraction
- targeted tiny ONNX models for local inference
- causal edge surfacing for operations
- safety-tiered remediation ranking
- strict offline-first fallback behavior

