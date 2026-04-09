import type { DiagnosisResult } from "@/types/endpoint";
import type { AnomalyScore } from "@/engine/onnx-model-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle, AlertTriangle, XCircle, Shield, Zap, Activity, ChevronDown, ChevronUp, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Props {
  result: DiagnosisResult & { mlAugmented?: boolean; anomalyScore?: AnomalyScore };
}

const healthColors = {
  healthy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  unknown: "bg-muted text-muted-foreground",
};

const healthIcons = {
  healthy: CheckCircle,
  degraded: AlertTriangle,
  critical: XCircle,
  unknown: Activity,
};

const severityColors = {
  critical: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  info: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
};

const safetyColors = {
  auto_safe: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  approval_required: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  recommendation_only: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
};

const safetyLabels = {
  auto_safe: "Auto-safe",
  approval_required: "Needs Approval",
  recommendation_only: "Recommendation",
};

export function DiagnosisView({ result }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const HealthIcon = healthIcons[result.overall_health] || Activity;

  return (
    <div className="space-y-4">
      {/* Overall health banner */}
      <Card className={cn("border-2", healthColors[result.overall_health])}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <HealthIcon className="w-6 h-6 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-base">
                  Overall: {result.overall_health.charAt(0).toUpperCase() + result.overall_health.slice(1)}
                </h3>
                <Badge variant="outline" className={healthColors[result.overall_health]}>
                  {result.diagnoses.length} issue{result.diagnoses.length !== 1 ? "s" : ""} found
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{result.summary}</p>
              {result.priority_action && (
                <div className="mt-3 flex items-start gap-2 bg-background/60 rounded-lg p-3 border">
                  <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Priority Action</span>
                    <p className="text-sm font-medium">{result.priority_action}</p>
                  </div>
                </div>
              {/* ML Anomaly Score */}
              {result.mlAugmented && result.anomalyScore && (
                <div className="mt-3 flex items-start gap-2 bg-violet-500/5 rounded-lg p-3 border border-violet-500/20">
                  <Brain className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">ML Anomaly Score</span>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all", 
                            result.anomalyScore.score > 0.7 ? "bg-red-500" : 
                            result.anomalyScore.score > 0.3 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${result.anomalyScore.score * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-mono font-bold">
                        {(result.anomalyScore.score * 100).toFixed(0)}%
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {result.anomalyScore.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}
              </div>
          </div>
        </CardContent>
      </Card>

      {/* Individual diagnoses */}
      {result.diagnoses.map((diag, i) => {
        const expanded = expandedIdx === i;
        return (
          <Card
            key={i}
            className={cn("transition-all cursor-pointer hover:shadow-md", expanded && "ring-1 ring-primary/20")}
            onClick={() => setExpandedIdx(expanded ? null : i)}
          >
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn("text-[10px]", severityColors[diag.severity])}>
                    {diag.severity}
                  </Badge>
                  <CardTitle className="text-sm">{diag.title}</CardTitle>
                  <Badge variant="secondary" className="text-[10px] font-mono">{diag.issue_class}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{Math.round(diag.confidence * 100)}%</span>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="px-4 pb-4 pt-0 space-y-4" onClick={e => e.stopPropagation()}>
                <p className="text-sm leading-relaxed">{diag.explanation}</p>

                {/* Contributing signals */}
                {diag.contributing_signals?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contributing Signals</h4>
                    <div className="space-y-1.5">
                      {diag.contributing_signals.map((sig, j) => (
                        <div key={j} className="flex items-center gap-2 bg-muted/30 rounded px-3 py-1.5 text-xs">
                          <code className="font-mono text-primary">{sig.field}</code>
                          <span className="text-red-500 font-mono font-medium">{sig.value}</span>
                          <span className="text-muted-foreground">vs threshold</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-mono">{sig.threshold}</span>
                          {sig.note && <span className="text-muted-foreground ml-auto hidden sm:inline">— {sig.note}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Remediations */}
                {diag.remediations?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Remediation Actions
                    </h4>
                    <div className="space-y-2">
                      {diag.remediations.map((rem, j) => (
                        <div key={j} className="border rounded-lg p-3 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className={cn("text-[10px]", safetyColors[rem.safety_level])}>
                              {safetyLabels[rem.safety_level] || rem.safety_level}
                            </Badge>
                            <span className="text-sm font-medium">{rem.action}</span>
                          </div>
                          {rem.command_hint && (
                            <code className="block text-xs font-mono bg-muted/50 rounded px-2 py-1 text-muted-foreground">{rem.command_hint}</code>
                          )}
                          {rem.risk && (
                            <p className="text-xs text-muted-foreground"><span className="text-amber-500">Risk:</span> {rem.risk}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post verification */}
                {diag.post_verification && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Post-fix Verification</h4>
                    <p className="text-xs">{diag.post_verification}</p>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}

      {result.diagnoses.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium">No issues detected</p>
            <p className="text-xs text-muted-foreground mt-1">All signals are within normal range</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
