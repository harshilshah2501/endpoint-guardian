import { useState } from "react";
import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { runLocalInference } from "@/engine/local-inference";
import { toast } from "sonner";

export function useDiagnosis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

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
      toast.success(`Diagnosis complete in ${elapsed}ms (local engine)`);
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

  return { diagnose, isLoading, result, error, latencyMs, clearResult: () => { setResult(null); setLatencyMs(null); } };
}
