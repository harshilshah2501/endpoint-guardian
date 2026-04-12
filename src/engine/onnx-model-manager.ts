/**
 * Multi-Model ONNX Manager — loads and manages multiple ONNX models
 * with lazy-loading and auto-unload for minimal memory footprint.
 */

import * as ort from "onnxruntime-web";
import type { EndpointSnapshot } from "@/types/endpoint";

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = "./";

export type ModelName = "anomaly_clf" | "causal_ranker" | "remediation_selector";

export interface AnomalyScore {
  score: number;
  category: string;
  featureImportance: Record<string, number>;
}

export interface AnomalyClfOutput {
  classProbs: Float32Array;       // [4]: healthy, degraded, warning, critical
  anomalyScores: Float32Array;    // [12]: per-feature anomaly score
  healthClass: string;
  confidence: number;
}

export interface CausalRankerOutput {
  causalMatrix: Float32Array;     // [12×12]: causal adjacency
  attentionWeights: Float32Array; // [12×12]: raw attention
  causalEdges: { source: string; target: string; strength: number }[];
}

export interface RemediationOutput {
  actionScores: Float32Array;     // [8]: per-action confidence
  tierProbs: Float32Array;        // [8×3]: tier probabilities per action
  rankedActions: { action: string; score: number; tier: string; tierConfidence: number }[];
}

const FEATURE_NAMES = [
  "cpu_1m", "cpu_5m", "cpu_temp", "mem_used_pct", "mem_pressure",
  "swap_usage", "disk_used_pct", "dns_fail", "gateway_fail",
  "internet_fail", "crash_rate", "thermal_throttle",
];

const REMEDIATION_ACTIONS = [
  "kill_process", "clear_cache", "restart_service", "flush_dns",
  "update_system", "reduce_startup", "free_disk", "investigate_logs",
];

const TIER_NAMES = ["diagnostic", "basic", "advanced"];

const MODEL_PATHS: Record<ModelName, string> = {
  anomaly_clf: "./models/anomaly_clf.onnx",
  causal_ranker: "./models/causal_ranker.onnx",
  remediation_selector: "./models/remediation_selector.onnx",
};

const IDLE_TIMEOUT_MS = 60_000;

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

interface ModelSlot {
  session: ort.InferenceSession | null;
  loading: boolean;
  error: string | null;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

class MultiModelManager {
  private slots: Record<ModelName, ModelSlot> = {
    anomaly_clf: { session: null, loading: false, error: null, idleTimer: null },
    causal_ranker: { session: null, loading: false, error: null, idleTimer: null },
    remediation_selector: { session: null, loading: false, error: null, idleTimer: null },
  };

  isLoaded(name: ModelName): boolean {
    return this.slots[name].session !== null;
  }

  isLoading(name: ModelName): boolean {
    return this.slots[name].loading;
  }

  getError(name: ModelName): string | null {
    return this.slots[name].error;
  }

  get anyLoaded(): boolean {
    return Object.values(this.slots).some(s => s.session !== null);
  }

  private resetIdleTimer(name: ModelName) {
    const slot = this.slots[name];
    if (slot.idleTimer) clearTimeout(slot.idleTimer);
    slot.idleTimer = setTimeout(() => this.unload(name), IDLE_TIMEOUT_MS);
  }

  async load(name: ModelName): Promise<boolean> {
    const slot = this.slots[name];
    if (slot.session) { this.resetIdleTimer(name); return true; }
    if (slot.loading) return false;

    slot.loading = true;
    slot.error = null;

    try {
      slot.session = await ort.InferenceSession.create(MODEL_PATHS[name], {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      console.log(`[ONNX] ${name} loaded`);
      this.resetIdleTimer(name);
      return true;
    } catch (e) {
      slot.error = e instanceof Error ? e.message : `Failed to load ${name}`;
      console.warn(`[ONNX] ${name} load failed:`, slot.error);
      return false;
    } finally {
      slot.loading = false;
    }
  }

  async unload(name: ModelName) {
    const slot = this.slots[name];
    if (slot.session) {
      await slot.session.release();
      slot.session = null;
      if (slot.idleTimer) clearTimeout(slot.idleTimer);
      slot.idleTimer = null;
      console.log(`[ONNX] ${name} unloaded (idle)`);
    }
  }

  async unloadAll() {
    for (const name of Object.keys(this.slots) as ModelName[]) {
      await this.unload(name);
    }
  }

  async runAnomalyClf(snapshot: EndpointSnapshot): Promise<AnomalyClfOutput | null> {
    if (!(await this.load("anomaly_clf"))) return null;
    const session = this.slots.anomaly_clf.session!;
    this.resetIdleTimer("anomaly_clf");

    try {
      const features = extractFeatures(snapshot);
      // Reshape to [1, 12, 1]
      const input = new ort.Tensor("float32", features, [1, 12, 1]);
      const results = await session.run({ input });

      const classProbs = results.class_probs.data as Float32Array;
      const anomalyScores = results.anomaly_scores.data as Float32Array;

      const classes = ["healthy", "degraded", "warning", "critical"];
      const maxIdx = Array.from(classProbs).indexOf(Math.max(...Array.from(classProbs)));

      return {
        classProbs,
        anomalyScores,
        healthClass: classes[maxIdx],
        confidence: classProbs[maxIdx],
      };
    } catch (e) {
      console.error("[ONNX] anomaly_clf inference failed:", e);
      return null;
    }
  }

  async runCausalRanker(snapshot: EndpointSnapshot): Promise<CausalRankerOutput | null> {
    if (!(await this.load("causal_ranker"))) return null;
    const session = this.slots.causal_ranker.session!;
    this.resetIdleTimer("causal_ranker");

    try {
      const features = extractFeatures(snapshot);
      const input = new ort.Tensor("float32", features, [1, 12, 1]);
      const results = await session.run({ input });

      const causalMatrix = results.causal_matrix.data as Float32Array;
      const attentionWeights = results.attention_weights.data as Float32Array;

      // Extract significant causal edges (strength > 0.3)
      const causalEdges: CausalRankerOutput["causalEdges"] = [];
      for (let i = 0; i < 12; i++) {
        for (let j = 0; j < 12; j++) {
          if (i === j) continue;
          const strength = causalMatrix[i * 12 + j];
          if (strength > 0.3 && features[i] > 0.3) {
            causalEdges.push({
              source: FEATURE_NAMES[i],
              target: FEATURE_NAMES[j],
              strength,
            });
          }
        }
      }

      causalEdges.sort((a, b) => b.strength - a.strength);

      return { causalMatrix, attentionWeights, causalEdges: causalEdges.slice(0, 10) };
    } catch (e) {
      console.error("[ONNX] causal_ranker inference failed:", e);
      return null;
    }
  }

  async runRemediationSelector(snapshot: EndpointSnapshot): Promise<RemediationOutput | null> {
    if (!(await this.load("remediation_selector"))) return null;
    const session = this.slots.remediation_selector.session!;
    this.resetIdleTimer("remediation_selector");

    try {
      const features = extractFeatures(snapshot);
      const input = new ort.Tensor("float32", features, [1, 12, 1]);
      const results = await session.run({ input });

      const actionScores = results.action_scores.data as Float32Array;
      const tierProbs = results.tier_probs.data as Float32Array;

      const rankedActions: RemediationOutput["rankedActions"] = [];
      for (let i = 0; i < REMEDIATION_ACTIONS.length; i++) {
        const score = actionScores[i];
        if (score > 0.2) {
          const tierSlice = Array.from(tierProbs.slice(i * 3, i * 3 + 3));
          const tierIdx = tierSlice.indexOf(Math.max(...tierSlice));
          rankedActions.push({
            action: REMEDIATION_ACTIONS[i],
            score,
            tier: TIER_NAMES[tierIdx],
            tierConfidence: tierSlice[tierIdx],
          });
        }
      }

      rankedActions.sort((a, b) => b.score - a.score);

      return { actionScores, tierProbs, rankedActions };
    } catch (e) {
      console.error("[ONNX] remediation_selector inference failed:", e);
      return null;
    }
  }

  getStatus(): Record<ModelName, { loaded: boolean; loading: boolean; error: string | null }> {
    const result = {} as ReturnType<typeof this.getStatus>;
    for (const [name, slot] of Object.entries(this.slots)) {
      result[name as ModelName] = {
        loaded: slot.session !== null,
        loading: slot.loading,
        error: slot.error,
      };
    }
    return result;
  }
}

export const modelManager = new MultiModelManager();
