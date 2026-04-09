/**
 * ONNX Model Manager — loads and runs ONNX models for local ML inference.
 * 
 * Models are loaded from the /models/ directory (bundled with the app).
 * Uses onnxruntime-web with WASM backend for cross-platform compatibility.
 */

import * as ort from "onnxruntime-web";
import type { EndpointSnapshot } from "@/types/endpoint";

// Configure ONNX Runtime to use WASM backend (works in both browser and Electron)
ort.env.wasm.numThreads = 1;
// Vite will serve these from public/ in dev, and from dist/ in production
ort.env.wasm.wasmPaths = "./";

export interface OnnxModelInfo {
  name: string;
  version: string;
  inputShape: number[];
  outputShape: number[];
  loaded: boolean;
}

export interface AnomalyScore {
  score: number;           // 0-1, higher = more anomalous
  category: string;        // "normal" | "warning" | "critical"
  featureImportance: Record<string, number>; // which features contributed most
}

// Feature extraction: convert snapshot to a normalized float array
export function extractFeatures(snapshot: EndpointSnapshot): Float32Array {
  const totalMem = snapshot.memory.total_mb || 1;
  const totalDisk = snapshot.disk.total_gb || 1;

  const features = new Float32Array(12);
  features[0]  = snapshot.cpu.usage_avg_1m / 100;
  features[1]  = snapshot.cpu.usage_avg_5m / 100;
  features[2]  = (snapshot.cpu.temp_celsius ?? 50) / 110;
  features[3]  = 1 - (snapshot.memory.available_mb / totalMem);
  features[4]  = snapshot.memory.pressure === "critical" ? 1.0 : snapshot.memory.pressure === "warning" ? 0.6 : 0.0;
  features[5]  = snapshot.memory.swap_usage_mb / 16384;
  features[6]  = 1 - (snapshot.disk.free_pct / 100);
  features[7]  = snapshot.network.dns_ok ? 0 : 1;
  features[8]  = snapshot.network.gateway_reachable ? 0 : 1;
  features[9]  = snapshot.network.internet_reachable ? 0 : 1;
  features[10] = Math.min(snapshot.crashes.count_24h / 10, 1.0);
  features[11] = snapshot.battery.thermal_throttle ? 1.0 : 0.0;

  return features;
}

const FEATURE_NAMES = [
  "cpu_1m", "cpu_5m", "cpu_temp", "mem_used_pct", "mem_pressure",
  "swap_usage", "disk_used_pct", "dns_fail", "gateway_fail",
  "internet_fail", "crash_rate", "thermal_throttle",
];

class OnnxModelManager {
  private session: ort.InferenceSession | null = null;
  private _loaded = false;
  private _loading = false;
  private _error: string | null = null;
  private _modelInfo: OnnxModelInfo | null = null;

  get loaded() { return this._loaded; }
  get loading() { return this._loading; }
  get error() { return this._error; }
  get modelInfo() { return this._modelInfo; }

  /**
   * Load the anomaly detection ONNX model.
   * Call this once at app startup.
   */
  async loadModel(modelPath = "./models/anomaly_detector.onnx"): Promise<boolean> {
    if (this._loaded || this._loading) return this._loaded;
    this._loading = true;
    this._error = null;

    try {
      this.session = await ort.InferenceSession.create(modelPath, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });

      this._modelInfo = {
        name: "EndpointDoctor Anomaly Detector",
        version: "1.0.0",
        inputShape: [1, 12],
        outputShape: [1, 3],
        loaded: true,
      };
      this._loaded = true;
      console.log("[ONNX] Model loaded successfully");
      return true;
    } catch (e) {
      this._error = e instanceof Error ? e.message : "Failed to load ONNX model";
      console.warn("[ONNX] Model load failed (falling back to rules-only):", this._error);
      return false;
    } finally {
      this._loading = false;
    }
  }

  /**
   * Run anomaly detection on a snapshot.
   * Returns anomaly scores and feature importance.
   */
  async predict(snapshot: EndpointSnapshot): Promise<AnomalyScore | null> {
    if (!this.session || !this._loaded) return null;

    try {
      const features = extractFeatures(snapshot);
      const inputTensor = new ort.Tensor("float32", features, [1, 12]);
      const results = await this.session.run({ input: inputTensor });

      // Output: [normal_prob, warning_prob, critical_prob]
      const output = results.output.data as Float32Array;
      const probs = Array.from(output);

      // Determine category from highest probability
      const maxIdx = probs.indexOf(Math.max(...probs));
      const categories = ["normal", "warning", "critical"] as const;
      const category = categories[maxIdx];

      // Anomaly score: weighted combination (0 = normal, 1 = critical)
      const score = probs[1] * 0.5 + probs[2] * 1.0;

      // Feature importance: use absolute feature values as a proxy
      const featureImportance: Record<string, number> = {};
      for (let i = 0; i < FEATURE_NAMES.length; i++) {
        featureImportance[FEATURE_NAMES[i]] = features[i];
      }

      return { score: Math.min(score, 1.0), category, featureImportance };
    } catch (e) {
      console.error("[ONNX] Inference failed:", e);
      return null;
    }
  }

  /**
   * Dispose of the model session to free memory.
   */
  async dispose() {
    if (this.session) {
      await this.session.release();
      this.session = null;
      this._loaded = false;
      this._modelInfo = null;
    }
  }
}

// Singleton instance
export const modelManager = new OnnxModelManager();
