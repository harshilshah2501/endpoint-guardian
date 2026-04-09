import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { runLocalDiagnosis } from "./rules-engine";

/**
 * Local AI inference layer.
 * Phase 1: Pure deterministic rules engine (instant, zero dependencies).
 * Phase 2+: Will integrate ONNX models for crash classification & anomaly detection.
 *
 * This module provides the same DiagnosisResult interface as the cloud edge function,
 * but runs entirely locally with zero network calls.
 */

export interface LocalInferenceOptions {
  mode: "quick" | "deep";
  /** Future: enable ML model augmentation when available */
  useModels?: boolean;
}

export async function runLocalInference(
  snapshot: EndpointSnapshot,
  options: LocalInferenceOptions = { mode: "quick" }
): Promise<DiagnosisResult> {
  // Phase 1: deterministic rules engine
  const result = runLocalDiagnosis(snapshot);

  if (options.mode === "deep") {
    // Deep mode: add cross-correlation analysis
    result.summary = `[Deep Analysis] ${result.summary}`;

    // Cross-correlate: high CPU + high temp = thermal cascade
    const hasCpu = result.diagnoses.some(d => d.issue_class === "high_cpu");
    const hasThermal = result.diagnoses.some(d => d.issue_class === "battery_thermal");
    if (hasCpu && hasThermal) {
      result.summary += " Cross-correlation: High CPU is likely causing thermal issues — resolving CPU should also resolve thermal throttling.";
    }

    // Cross-correlate: low disk + crashes = possibly related
    const hasDisk = result.diagnoses.some(d => d.issue_class === "low_disk");
    const hasCrash = result.diagnoses.some(d => d.issue_class === "app_crash");
    if (hasDisk && hasCrash) {
      result.summary += " Cross-correlation: Low disk space may be contributing to application crashes.";
    }
  }

  return result;
}

/**
 * Check if ONNX models are available for enhanced inference.
 * Phase 1: Always returns false.
 * Phase 2+: Will check for local model files.
 */
export function areModelsAvailable(): boolean {
  return false;
}

/**
 * Get engine info for display in UI.
 */
export function getEngineInfo() {
  return {
    name: "EndpointDoctor Local Engine",
    version: "1.0.0",
    mode: "Deterministic Rules Engine",
    modelStatus: areModelsAvailable() ? "ONNX models loaded" : "Rules-only (no ML models)",
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
    ],
  };
}
