import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";
import { toast } from "sonner";

export function useDiagnosis() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const diagnose = async (snapshot: EndpointSnapshot, mode: "quick" | "deep" = "quick") => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("diagnose", {
        body: { snapshot, mode },
      });

      if (fnError) {
        const msg = fnError.message || "Diagnosis failed";
        setError(msg);
        toast.error(msg);
        return null;
      }

      if (data?.error) {
        setError(data.error);
        toast.error(data.error);
        return null;
      }

      setResult(data as DiagnosisResult);
      return data as DiagnosisResult;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(msg);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return { diagnose, isLoading, result, error, clearResult: () => setResult(null) };
}
