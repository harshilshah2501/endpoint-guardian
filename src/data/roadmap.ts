export interface RoadmapPhase {
  id: number;
  name: string;
  subtitle: string;
  weeks: string;
  scope: string[];
  successCriteria: string[];
  risks: string[];
  dependencies: string[];
  notYet: string[];
  color: string;
}

export const phases: RoadmapPhase[] = [
  {
    id: 1,
    name: "Deterministic MVP",
    subtitle: "Narrow but strong capability",
    weeks: "Weeks 1–6",
    scope: [
      "Agent core with scheduler and orchestrator",
      "4 collectors: CPU, memory, disk space, network",
      "Deterministic decision engine with rule trees",
      "4 safe remediation recipes: kill process, clear cache/trash, flush DNS, renew DHCP",
      "Pre-check / action / post-check / audit pipeline",
      "SQLite storage for snapshots and audit log",
      "CLI interface only",
      "macOS first",
    ],
    successCriteria: [
      "Diagnose high CPU, high memory, low disk, DNS failure on macOS",
      "Safely execute 4 remediation actions with audit trail",
      "< 15MB RAM at idle, < 2% CPU at idle",
      "All diagnoses are deterministic and testable with fixtures",
    ],
    risks: [
      "macOS API access (some signals need entitlements or SIP exceptions)",
      "Collector reliability (parsing CLI output is fragile)",
    ],
    dependencies: ["Rust toolchain", "rusqlite", "tokio (async runtime)"],
    notYet: ["Windows support", "UI", "ML models", "Enterprise features", "Installer"],
    color: "primary",
  },
  {
    id: 2,
    name: "Historical Intelligence + Windows",
    subtitle: "Trend-based and recurrence-aware",
    weeks: "Weeks 7–14",
    scope: [
      "Add remaining 6 issue detectors (all rules-based)",
      "Add Windows collectors (parallel to macOS)",
      "Historical snapshot storage + trend queries",
      "Recurrence detection ('this issue happened 3 times this week')",
      "Trend-based alerts ('disk space declining, will be full in 5 days')",
      "Basic Tauri tray app with status icon + notification",
      "Cross-platform CI (GitHub Actions)",
    ],
    successCriteria: [
      "All 10 issues diagnosable on both macOS and Windows",
      "Historical trend queries working (7-day, 30-day)",
      "Tauri app shows system status and recent diagnoses",
      "Cross-platform collector parity tests passing",
    ],
    risks: [
      "Windows collector complexity (WMI, COM, perf counters are painful in Rust)",
      "Tauri build pipeline for both platforms",
      "Feature parity drift between macOS and Windows",
    ],
    dependencies: ["Phase 1 complete", "windows-rs crate", "Tauri v2"],
    notYet: ["ML models", "Enterprise policy", "Fleet management", "MDM integration"],
    color: "accent",
  },
  {
    id: 3,
    name: "Specialized Model Augmentation",
    subtitle: "ML only where it materially helps",
    weeks: "Weeks 15–22",
    scope: [
      "Train crash log text classifier (Python, export to ONNX)",
      "Integrate ONNX Runtime for lazy model loading",
      "Add process behavior anomaly detection (isolation forest)",
      "Add battery degradation trend prediction (linear regression)",
      "Model budget enforcement (max 1 model loaded, 20MB RAM cap)",
      "A/B comparison: model-augmented vs rules-only",
    ],
    successCriteria: [
      "Crash classifier achieves > 85% accuracy on test set",
      "Model load < 500ms, inference < 100ms",
      "Idle RAM stays < 25MB even with model infrastructure",
      "Measurable improvement in crash diagnosis vs rules-only",
    ],
    risks: [
      "Training data scarcity (crash logs are varied and noisy)",
      "Model may not outperform good heuristics",
      "ONNX Runtime adds ~20MB to binary size",
    ],
    dependencies: ["Phase 2 complete", "Labeled crash log dataset", "Python training pipeline"],
    notYet: ["Large transformers", "General NLP", "Cloud model serving"],
    color: "warning",
  },
  {
    id: 4,
    name: "Enterprise Hardening",
    subtitle: "Policy, packaging, audit, fleet-readiness",
    weeks: "Weeks 23–32",
    scope: [
      "Policy engine: admin-deployable action policies via MDM",
      "Installer packages: .dmg/.pkg (macOS), .msi (Windows)",
      "Code signing and notarization",
      "Telemetry opt-in: anonymized issue frequency reporting",
      "Fleet summary webhook (POST to IT dashboard)",
      "Audit log export (CSV, JSON)",
      "Auto-update mechanism",
      "Security audit and penetration testing",
    ],
    successCriteria: [
      "Deployable via MDM (Jamf, Intune)",
      "Configurable policy without agent rebuild",
      "Signed and notarized for both platforms",
      "Passes security review",
    ],
    risks: [
      "Code signing costs and Apple notarization delays",
      "MDM integration testing requires real MDM infrastructure",
      "Enterprise customers will demand features not in scope",
    ],
    dependencies: ["Phase 3 complete", "Code signing certificates", "MDM test environments"],
    notYet: ["General AI chatbot", "Cloud-dependent features", "Third-party integrations"],
    color: "destructive",
  },
];

export const footprintBudget = [
  { metric: "Idle CPU", target: "< 1%", hardLimit: "3%" },
  { metric: "Idle RAM", target: "10–15 MB", hardLimit: "20 MB" },
  { metric: "Burst diagnostic CPU", target: "< 15% for < 5s", hardLimit: "30% for < 10s" },
  { metric: "Model memory (loaded)", target: "< 15 MB", hardLimit: "20 MB" },
  { metric: "Model load latency", target: "< 200 ms", hardLimit: "500 ms" },
  { metric: "Inference latency", target: "< 50 ms", hardLimit: "100 ms" },
  { metric: "Agent startup time", target: "< 2s", hardLimit: "5s" },
  { metric: "Binary size (no models)", target: "< 15 MB", hardLimit: "25 MB" },
  { metric: "Binary size (with models)", target: "< 30 MB", hardLimit: "50 MB" },
  { metric: "SQLite DB (30 days)", target: "< 50 MB", hardLimit: "100 MB" },
];
