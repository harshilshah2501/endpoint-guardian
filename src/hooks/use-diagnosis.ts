import { useState, useEffect } from "react";
import type { EndpointSnapshot } from "@/types/endpoint";
import { runLocalInference, initModels, type TransformerPipelineResult } from "@/engine/local-inference";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AugmentedResult extends TransformerPipelineResult {
  aiPowered?: boolean;
}

async function runDeepAI(snapshot: EndpointSnapshot): Promise<AugmentedResult | null> {
  try {
    const { data, error } = await supabase.functions.invoke("diagnose-deep", {
      body: { snapshot },
    });

    if (error) {
      console.warn("AI deep analysis failed:", error);
      return null;
    }

    if (data?.error) {
      console.warn("AI deep analysis error:", data.error);
      toast.warning(data.error);
      return null;
    }

    if (data?.result) {
      return { ...data.result, aiPowered: true, transformerPowered: false };
    }

    return null;
  } catch (e) {
    console.warn("AI deep analysis unavailable (offline?):", e);
    return null;
  }
}

export function useDiagnosis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AugmentedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [modelsReady, setModelsReady] = useState(false);

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

      if (mode === "deep") {
        toast.info("Running AI-powered deep analysis...");
        const aiResult = await runDeepAI(snapshot);

        if (aiResult) {
          const elapsed = Math.round(performance.now() - start);
          setLatencyMs(elapsed);
          setResult(aiResult);
          toast.success(`AI deep analysis complete in ${(elapsed / 1000).toFixed(1)}s`);
          return aiResult;
        }

        toast.info("AI unavailable — falling back to local transformers");
      }

      const data = await runLocalInference(snapshot, { mode });
      const elapsed = Math.round(performance.now() - start);
      setLatencyMs(elapsed);
      setResult(data);
      const engine = data.transformerPowered ? "transformer pipeline" : "rules engine";
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
