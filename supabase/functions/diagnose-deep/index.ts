import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are EndpointDoctor — an elite systems diagnostician with 20+ years of experience as a senior SRE, sysadmin, and performance engineer across macOS, Windows, and Linux.

You receive a raw telemetry snapshot from an endpoint (laptop/desktop) and must produce a precise, surgical diagnosis.

## Your Approach

1. **Root Cause Analysis**: Don't just flag symptoms. Identify the ROOT CAUSE. If CPU is high AND thermal throttling is active, the throttling is a CONSEQUENCE of the CPU issue — don't list them as separate problems. Chain causality.

2. **Cross-Signal Correlation**: Look at signals together. High memory + high swap + slow disk I/O = memory pressure cascading to disk. A single Chrome process at 98% CPU with 1.4GB RSS for 12 minutes = likely a tab with a runaway JS loop (WebGL, crypto-mining page, or infinite loop), not just "high CPU."

3. **Contextual Intelligence**: 
   - A process named "mds_stores" at 40% CPU after a macOS update = Spotlight re-indexing, completely normal, will resolve on its own.
   - Docker at 88% CPU on a developer machine might be expected during a build.
   - 8 startup items on macOS is normal; 25 is a problem.

4. **Surgical Remediations**: Don't say "close applications." Say exactly WHICH process to investigate and WHY. Provide the actual command. Explain the risk clearly.

## Safety Tiers (CRITICAL — classify every remediation correctly)

- **diagnostic**: Read-only investigation. Gathering info, checking logs, listing processes. ZERO system changes. Examples: "Check Chrome's Task Manager for the offending tab", "Review crash logs in Console.app"
- **basic**: Requires human confirmation before execution. Changes system state. Examples: "Kill process PID 1234", "Disable startup item", "Apply pending updates"  
- **advanced**: Safe to execute automatically WITHOUT human confirmation. Fully reversible or inherently safe. Examples: "Flush DNS cache", "Clear browser caches", "Toggle WiFi off/on", "Empty trash"

## Output Format

You MUST call the diagnose_endpoint function with your analysis.

For each diagnosis:
- issue_class: one of high_cpu, high_memory, low_disk, disk_io, startup_slow, app_crash, network_dns, service_loop, update_issue, battery_thermal
- severity: critical (needs immediate attention), warning (should address soon), info (informational)
- confidence: 0.0-1.0 based on signal strength
- title: Precise, specific title (not generic)
- explanation: 2-3 sentences of expert analysis explaining the WHY, not just the WHAT. Write like you're explaining to a smart but non-technical user.
- contributing_signals: the actual data points that led to this conclusion
- remediations: ordered by priority, each with correct tier, risk assessment, pre/post checks
- post_verification: how to confirm the fix worked

For overall_health: healthy (no issues), degraded (warnings only), critical (at least one critical issue)
For summary: One paragraph synthesizing ALL findings, explaining how issues relate to each other.
For priority_action: The single most impactful thing to do RIGHT NOW.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { snapshot } = await req.json();
    if (!snapshot) {
      return new Response(
        JSON.stringify({ error: "Missing snapshot in request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userPrompt = `Analyze this endpoint telemetry snapshot and provide a complete diagnosis:

\`\`\`json
${JSON.stringify(snapshot, null, 2)}
\`\`\`

Think step-by-step:
1. What are the anomalous signals?
2. How do they relate to each other (causal chains)?
3. What is the root cause?
4. What are the precise, surgical remediations?`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "diagnose_endpoint",
              description: "Submit the structured diagnosis result for the endpoint",
              parameters: {
                type: "object",
                properties: {
                  diagnoses: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        issue_class: { type: "string" },
                        severity: { type: "string", enum: ["critical", "warning", "info"] },
                        confidence: { type: "number" },
                        title: { type: "string" },
                        explanation: { type: "string" },
                        contributing_signals: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              field: { type: "string" },
                              value: { type: "string" },
                              threshold: { type: "string" },
                              note: { type: "string" },
                            },
                            required: ["field", "value", "threshold", "note"],
                          },
                        },
                        remediations: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              action: { type: "string" },
                              tier: { type: "string", enum: ["diagnostic", "basic", "advanced"] },
                              command_hint: { type: "string" },
                              risk: { type: "string" },
                              pre_check: { type: "string" },
                              post_check: { type: "string" },
                              rollback: { type: "string" },
                            },
                            required: ["action", "tier", "risk"],
                          },
                        },
                        post_verification: { type: "string" },
                      },
                      required: ["issue_class", "severity", "confidence", "title", "explanation", "contributing_signals", "remediations", "post_verification"],
                    },
                  },
                  overall_health: { type: "string", enum: ["healthy", "degraded", "critical", "unknown"] },
                  summary: { type: "string" },
                  priority_action: { type: "string" },
                },
                required: ["diagnoses", "overall_health", "summary", "priority_action"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "diagnose_endpoint" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "AI rate limit reached. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings > Workspace > Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      return new Response(
        JSON.stringify({ error: "AI analysis unavailable. Use Quick Diagnosis for offline results." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI returned unexpected format. Use Quick Diagnosis instead." }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const diagnosis = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({ result: diagnosis, ai_powered: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("diagnose-deep error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
