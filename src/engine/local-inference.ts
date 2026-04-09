import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { runLocalDiagnosis } from "./rules-engine";
import { modelManager, type AnomalyScore } from "./onnx-model-manager";

/**
 * Local AI inference layer.
 * Phase 1: Deterministic rules engine (instant, zero dependencies).
 * Phase 2: ONNX anomaly detection model augments rules engine.
 */

export interface LocalInferenceOptions {
  mode: "quick" | "deep";
  useModels?: boolean;
}

let _modelLoadAttempted = false;

/**
 * Initialize ONNX models. Call once at app startup.
 * Non-blocking — falls back to rules-only if model unavailable.
 */
export async function initModels(): Promise<boolean> {
  if (_modelLoadAttempted) return modelManager.loaded;
  _modelLoadAttempted = true;
  return modelManager.loadModel("./models/anomaly_detector.onnx");
}

export async function runLocalInference(
  snapshot: EndpointSnapshot,
  options: LocalInferenceOptions = { mode: "quick" }
): Promise<DiagnosisResult & { mlAugmented?: boolean; anomalyScore?: AnomalyScore }> {
  // Phase 1: deterministic rules engine
  const result = runLocalDiagnosis(snapshot);

  // Phase 2: ONNX model augmentation
  let anomalyScore: AnomalyScore | null = null;
  let mlAugmented = false;

  if (options.useModels !== false && modelManager.loaded) {
    anomalyScore = await modelManager.predict(snapshot);
    if (anomalyScore) {
      mlAugmented = true;

      // ML can upgrade severity if it detects something rules missed
      if (anomalyScore.category === "critical" && result.overall_health !== "critical") {
        result.summary += ` [ML: anomaly score ${(anomalyScore.score * 100).toFixed(0)}% — model detects critical pattern]`;
      }
      if (anomalyScore.category === "warning" && result.overall_health === "healthy") {
        result.summary += ` [ML: anomaly score ${(anomalyScore.score * 100).toFixed(0)}% — model detects potential issue]`;
        result.overall_health = "degraded";
      }
    }
  }

  if (options.mode === "deep") {
    result.summary = `[Deep Analysis] ${result.summary}`;

    const hasCpu = result.diagnoses.some(d => d.issue_class === "high_cpu");
    const hasThermal = result.diagnoses.some(d => d.issue_class === "battery_thermal");
    if (hasCpu && hasThermal) {
      result.summary += " Cross-correlation: High CPU is likely causing thermal issues — resolving CPU should also resolve thermal throttling.";
    }

    const hasDisk = result.diagnoses.some(d => d.issue_class === "low_disk");
    const hasCrash = result.diagnoses.some(d => d.issue_class === "app_crash");
    if (hasDisk && hasCrash) {
      result.summary += " Cross-correlation: Low disk space may be contributing to application crashes.";
    }

    if (anomalyScore) {
      const topFeatures = Object.entries(anomalyScore.featureImportance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([k, v]) => `${k}=${(v * 100).toFixed(0)}%`);
      result.summary += ` Top ML signals: ${topFeatures.join(", ")}.`;
    }
  }

  return { ...result, mlAugmented, anomalyScore: anomalyScore ?? undefined };
}

export function areModelsAvailable(): boolean {
  return modelManager.loaded;
}

export function getModelLoadError(): string | null {
  return modelManager.error;
}

export function getEngineInfo() {
  return {
    name: "EndpointDoctor Local Engine",
    version: "1.1.0",
    mode: modelManager.loaded ? "Rules Engine + ONNX ML" : "Deterministic Rules Engine",
    modelStatus: modelManager.loaded
      ? "ONNX model loaded (anomaly detection)"
      : modelManager.loading
        ? "Loading ONNX model..."
        : modelManager.error
          ? `Model unavailable: ${modelManager.error}`
          : "Rules-only (no ML models)",
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
      ...(modelManager.loaded ? [
        "ML anomaly detection (ONNX)",
        "Feature importance analysis",
        "Cross-signal pattern recognition",
      ] : []),
    ],
  };
}
