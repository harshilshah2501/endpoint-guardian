import { useState, useEffect } from "react";
import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { runLocalInference, initModels, areModelsAvailable } from "@/engine/local-inference";
import type { AnomalyScore } from "@/engine/onnx-model-manager";
import { toast } from "sonner";

interface AugmentedResult extends DiagnosisResult {
  mlAugmented?: boolean;
  anomalyScore?: AnomalyScore;
}

export function useDiagnosis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AugmentedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

  // Attempt to load ONNX models on mount
  useEffect(() => {
    initModels().then(ok => setModelsReady(ok));
  }, []);

  const diagnose = async (snapshot: EndpointSnapshot, mode: "quick" | "deep" = "quick") => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setLatencyMs(null);

    try {
      const start = performance.now();
      const data = await runLocalInference(snapshot, { mode });
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResult(data);
      const engine = data.mlAugmented ? "rules + ONNX ML" : "rules engine";
      toast.success(`Diagnosis complete in ${elapsed}ms (${engine})`);
      return data;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    diagnose, isLoading, result, error, latencyMs, modelsReady,
    clearResult: () => { setResult(null); setLatencyMs(null); },
  };
}
