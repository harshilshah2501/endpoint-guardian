import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { runLocalDiagnosis } from "./rules-engine";
import {
  modelManager,
  type AnomalyClfOutput,
  type CausalRankerOutput,
  type RemediationOutput,
} from "./onnx-model-manager";

export interface TransformerPipelineResult extends DiagnosisResult {
  transformerPowered: boolean;
  anomalyClf?: AnomalyClfOutput;
  causalRanker?: CausalRankerOutput;
  remediationSelector?: RemediationOutput;
  aiPowered?: boolean;
}

export interface LocalInferenceOptions {
  mode: "quick" | "deep";
  useModels?: boolean;
}

export async function initModels(): Promise<boolean> {
  // Eagerly load anomaly classifier; others are lazy-loaded on deep analysis
  return modelManager.load("anomaly_clf");
}

export async function runLocalInference(
  snapshot: EndpointSnapshot,
  options: LocalInferenceOptions = { mode: "quick" }
): Promise<TransformerPipelineResult> {
  // Phase 1: deterministic rules engine (always runs, instant)
  const result: TransformerPipelineResult = {
    ...runLocalDiagnosis(snapshot),
    transformerPowered: false,
  };

  if (options.useModels === false) return result;

  // Phase 2: Anomaly classifier (quick + deep)
  const anomalyClf = await modelManager.runAnomalyClf(snapshot);
  if (anomalyClf) {
    result.transformerPowered = true;
    result.anomalyClf = anomalyClf;

    // ML can upgrade severity
    if (anomalyClf.healthClass === "critical" && result.overall_health !== "critical") {
      result.summary += ` [Transformer: health=${anomalyClf.healthClass}, confidence=${(anomalyClf.confidence * 100).toFixed(0)}%]`;
      result.overall_health = "critical";
    }
    if (anomalyClf.healthClass === "warning" && result.overall_health === "healthy") {
      result.overall_health = "degraded";
      result.summary += ` [Transformer: anomaly pattern detected]`;
    }
  }

  // Phase 3: Deep mode — causal ranker + remediation selector
  if (options.mode === "deep") {
    result.summary = `[Deep Analysis] ${result.summary}`;

    const [causalResult, remediationResult] = await Promise.all([
      modelManager.runCausalRanker(snapshot),
      modelManager.runRemediationSelector(snapshot),
    ]);

    if (causalResult) {
      result.causalRanker = causalResult;
      // Add causal chain insights to summary
      const topEdges = causalResult.causalEdges.slice(0, 3);
      if (topEdges.length > 0) {
        const chains = topEdges.map(
          e => `${e.source} → ${e.target} (${(e.strength * 100).toFixed(0)}%)`
        );
        result.summary += ` Causal chains: ${chains.join("; ")}.`;
      }
    }

    if (remediationResult) {
      result.remediationSelector = remediationResult;
    }

    // Cross-correlation from rules engine
    const hasCpu = result.diagnoses.some(d => d.issue_class === "high_cpu");
    const hasThermal = result.diagnoses.some(d => d.issue_class === "battery_thermal");
    if (hasCpu && hasThermal) {
      result.summary += " Cross-correlation: High CPU is likely causing thermal issues.";
    }
    const hasDisk = result.diagnoses.some(d => d.issue_class === "low_disk");
    const hasCrash = result.diagnoses.some(d => d.issue_class === "app_crash");
    if (hasDisk && hasCrash) {
      result.summary += " Cross-correlation: Low disk may be contributing to crashes.";
    }
  }

  return result;
}

export function areModelsAvailable(): boolean {
  return modelManager.anyLoaded;
}

export function getModelLoadError(): string | null {
  const status = modelManager.getStatus();
  const errors = Object.entries(status)
    .filter(([, s]) => s.error)
    .map(([name, s]) => `${name}: ${s.error}`);
  return errors.length > 0 ? errors.join("; ") : null;
}

export function getEngineInfo() {
  const status = modelManager.getStatus();
  const loadedModels = Object.entries(status)
    .filter(([, s]) => s.loaded)
    .map(([name]) => name);

  return {
    name: "EndpointDoctor Transformer Engine",
    version: "2.0.0",
    mode: loadedModels.length > 0
      ? `Rules Engine + ${loadedModels.length} Transformer Model${loadedModels.length > 1 ? "s" : ""}`
      : "Deterministic Rules Engine",
    modelStatus: loadedModels.length > 0
      ? `Loaded: ${loadedModels.join(", ")}`
      : Object.values(status).some(s => s.loading)
        ? "Loading transformer models..."
        : Object.values(status).some(s => s.error)
          ? `Models unavailable`
          : "Rules-only (no transformer models)",
    issuesCovered: 10,
    capabilities: [
      "High CPU detection & process attribution",
      "Memory pressure analysis",
      "Low disk space detection & cleanup recommendations",
      "Network/DNS sequential diagnostics",
      "App crash pattern detection",
      "Startup slowdown analysis",
      "Service health monitoring",
      "Update status tracking",
      "Thermal/battery health assessment",
      "Disk I/O pattern detection",
      ...(status.anomaly_clf.loaded ? [
        "Transformer anomaly classification",
        "Per-feature anomaly scoring",
      ] : []),
      ...(status.causal_ranker.loaded ? [
        "Causal chain discovery via cross-attention",
        "Signal correlation analysis",
      ] : []),
      ...(status.remediation_selector.loaded ? [
        "ML-ranked remediation actions",
        "Automated tier classification",
      ] : []),
    ],
  };
}
