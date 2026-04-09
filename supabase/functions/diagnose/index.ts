import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { snapshot, mode } = await req.json();
    
    if (!snapshot) {
      return new Response(JSON.stringify({ error: "Missing snapshot data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are EndpointDoctor, an expert AI-powered endpoint diagnostic engine. You analyze system health snapshots from macOS and Windows endpoints and provide precise, actionable diagnoses.

You MUST respond with valid JSON matching this exact schema:
{
  "diagnoses": [
    {
      "issue_class": "high_cpu | high_memory | low_disk | disk_io | startup_slow | app_crash | network_dns | service_loop | update_issue | battery_thermal | healthy",
      "severity": "critical | warning | info",
      "confidence": 0.0-1.0,
      "title": "Short diagnosis title",
      "explanation": "Detailed root cause explanation in 2-3 sentences",
      "contributing_signals": [
        { "field": "field_name", "value": "current_value", "threshold": "normal_threshold", "note": "why this matters" }
      ],
      "remediations": [
        {
          "action": "specific action description",
          "safety_level": "auto_safe | approval_required | recommendation_only",
          "command_hint": "optional OS command or action",
          "risk": "what could go wrong"
        }
      ],
      "post_verification": "how to verify the fix worked"
    }
  ],
  "overall_health": "healthy | degraded | critical",
  "summary": "One-paragraph executive summary of endpoint health",
  "priority_action": "The single most important thing to do right now"
}

Rules:
- Analyze ALL signals in the snapshot, not just the obvious ones
- Cross-correlate symptoms (e.g., high CPU + high temp = thermal issue, not just CPU issue)
- For each diagnosis, provide specific remediation steps with safety levels
- Be precise about thresholds: explain what's normal vs what you're seeing
- If multiple issues exist, prioritize by severity
- If the endpoint looks healthy, say so with confidence
- NEVER recommend actions that could cause data loss without explicit "recommendation_only" safety level
- Consider platform-specific context (macOS vs Windows signals)`;

    const userPrompt = mode === "deep" 
      ? `Perform a DEEP diagnostic analysis of this endpoint snapshot. Cross-correlate all signals, identify hidden patterns, check for cascading failures, and provide comprehensive remediation plans.\n\nSnapshot:\n${JSON.stringify(snapshot, null, 2)}`
      : `Analyze this endpoint health snapshot and diagnose any issues.\n\nSnapshot:\n${JSON.stringify(snapshot, null, 2)}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: false,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted. Please add funds in Settings > Workspace > Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: "AI diagnosis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    
    // Parse JSON from the response (handle markdown code blocks)
    let parsed;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      // If JSON parsing fails, return raw content as summary
      parsed = {
        diagnoses: [],
        overall_health: "unknown",
        summary: content,
        priority_action: "Unable to parse structured diagnosis. See summary."
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("diagnose error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
