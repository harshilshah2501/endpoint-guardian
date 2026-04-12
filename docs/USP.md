# USP and Product Differentiators

This document summarizes what makes EndpointDoctor distinct, with concrete size and AI capability facts.

## 1. Small On-Device AI Footprint

Core local transformer set (current files in public/models):
- anomaly_clf.onnx: 412,928 bytes (about 403 KB)
- causal_ranker.onnx: 157,851 bytes (about 154 KB)
- remediation_selector.onnx: 148,614 bytes (about 145 KB)

Core 3-model total:
- 719,393 bytes (about 702 KB, roughly 0.69 MB)

All ONNX files currently present in models folder:
- total 720,952 bytes (about 712 KB)
- includes tiny anomaly_detector.onnx prototype (1,559 bytes)

Why this matters:
- significantly smaller than common endpoint AI stacks
- fast cold-start and low memory pressure
- practical for offline desktop usage

## 2. Offline-First by Design

- Full baseline diagnostics run locally with deterministic rules.
- Local ONNX inference runs in browser/desktop runtime via ONNX Runtime Web WASM.
- No dependency on external API keys for core diagnosis.
- Optional cloud deep analysis is additive and has automatic local fallback.

USP angle:
- consistent behavior in air-gapped or low-connectivity environments.

## 3. Hybrid Intelligence Stack (Rules + Transformers + Optional Cloud)

Layer 1: deterministic rules engine
- reliable baseline coverage for operationally common endpoint faults

Layer 2: local specialized transformers
- anomaly classification
- causal ranking in deep mode
- remediation ranking in deep mode

Layer 3: optional cloud deep explanation
- richer language synthesis where connectivity/policy allows

USP angle:
- combines explainability and reliability (rules) with adaptive ranking (ML).

## 4. Causal and Action Intelligence, Not Just Alerting

Most endpoint tools stop at threshold alerts. EndpointDoctor adds:
- causal edge extraction between signals in deep mode
- ML-ranked remediation candidates with confidence and suggested safety tier
- explicit post-verification steps per remediation

USP angle:
- designed for decision support and action sequencing, not only detection.

## 5. Safety-Tiered Remediation Model

Each remediation is tagged by execution risk:
- diagnostic: read-only checks
- basic: user confirmation required
- advanced: bounded auto-safe operations

USP angle:
- enables progressive automation while preserving operator control.

## 6. Desktop Agent + UI Cohesion

- Tray background monitor with health transition notifications
- Same diagnosis concepts in interactive dashboard and background checks
- Live telemetry bridge through Electron IPC

USP angle:
- practical day-2 operations experience, not only dashboard analytics.

## 7. Latency and UX Profile

Target runtime profile from current implementation/docs:
- Quick mode: around 100 ms class
- Deep local mode: around 300 to 500 ms class

USP angle:
- responsive triage loop suitable for repeated scan-remediate-verify workflows.

## 8. Concrete Value Proposition Statement

EndpointDoctor delivers enterprise-style endpoint diagnosis using a sub-1 MB local AI footprint, with offline-first operation, explainable rules baseline, deep-mode causal/action intelligence, and safety-tiered remediation guidance in one integrated desktop workflow.

