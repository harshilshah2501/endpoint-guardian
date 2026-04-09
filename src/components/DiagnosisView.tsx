import type { DiagnosisResult, ActionTier } from "@/types/endpoint";
import type { AnomalyScore } from "@/engine/onnx-model-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, AlertTriangle, XCircle, Shield, Zap, Activity,
  ChevronDown, ChevronUp, Brain, Search, UserCheck, Play, Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  result: DiagnosisResult & { mlAugmented?: boolean; anomalyScore?: AnomalyScore; aiPowered?: boolean };
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

const tierConfig: Record<ActionTier, {
  label: string;
  icon: typeof Search;
  color: string;
  bgColor: string;
  description: string;
}> = {
  diagnostic: {
    label: "Diagnostic",
    icon: Search,
    color: "text-blue-700 dark:text-blue-400",
    bgColor: "bg-blue-500/10 border-blue-500/20",
    description: "Read-only debug — no system changes",
  },
  basic: {
    label: "Basic",
    icon: UserCheck,
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10 border-amber-500/20",
    description: "Requires your confirmation",
  },
  advanced: {
    label: "Advanced",
    icon: Zap,
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
    description: "Auto-safe — executes autonomously",
  },
};

export function DiagnosisView({ result }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const HealthIcon = healthIcons[result.overall_health] || Activity;

  const handleAutoExecute = (actionKey: string, action: string) => {
    setExecutedActions(prev => new Set(prev).add(actionKey));
    toast.success(`Auto-executed: ${action}`, {
      action: {
        label: "Undo",
        onClick: () => {
          setExecutedActions(prev => {
            const next = new Set(prev);
            next.delete(actionKey);
            return next;
          });
          toast.info(`Rolled back: ${action}`);
        },
      },
    });
  };

  const handleApprove = (actionKey: string, action: string) => {
    setExecutedActions(prev => new Set(prev).add(actionKey));
    toast.success(`Approved & executed: ${action}`);
  };

  // Group remediations by tier
  const groupByTier = (remediations: DiagnosisResult["diagnoses"][0]["remediations"]) => {
    const groups: Record<ActionTier, typeof remediations> = {
      diagnostic: [],
      basic: [],
      advanced: [],
    };
    remediations.forEach(r => {
      if (r.tier in groups) groups[r.tier].push(r);
    });
    return groups;
  };

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
                {result.aiPowered && (
                  <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                    <Brain className="w-3 h-3 mr-1" /> AI-Powered
                  </Badge>
                )}
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
              )}
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
        const tierGroups = groupByTier(diag.remediations);

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

                {/* Tiered Remediation Actions */}
                {diag.remediations?.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Shield className="w-3 h-3" /> Remediation Actions
                    </h4>

                    {(["advanced", "basic", "diagnostic"] as ActionTier[]).map(tier => {
                      const actions = tierGroups[tier];
                      if (actions.length === 0) return null;
                      const cfg = tierConfig[tier];
                      const TierIcon = cfg.icon;

                      return (
                        <div key={tier} className={cn("border rounded-lg overflow-hidden", cfg.bgColor)}>
                          <div className="px-3 py-2 flex items-center gap-2 border-b border-inherit">
                            <TierIcon className={cn("w-3.5 h-3.5", cfg.color)} />
                            <span className={cn("text-xs font-semibold", cfg.color)}>{cfg.label}</span>
                            <span className="text-[10px] text-muted-foreground">— {cfg.description}</span>
                          </div>
                          <div className="p-2 space-y-2">
                            {actions.map((rem, j) => {
                              const actionKey = `${i}-${tier}-${j}`;
                              const executed = executedActions.has(actionKey);

                              return (
                                <div key={j} className={cn("bg-background/80 rounded-lg p-3 space-y-2", executed && "opacity-60")}>
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-sm font-medium flex-1">{rem.action}</span>
                                    {/* Tier-specific buttons */}
                                    {tier === "advanced" && !executed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7 gap-1 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                                        onClick={() => handleAutoExecute(actionKey, rem.action)}
                                      >
                                        <Play className="w-3 h-3" /> Auto-Run
                                      </Button>
                                    )}
                                    {tier === "basic" && !executed && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-xs h-7 gap-1 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                        onClick={() => handleApprove(actionKey, rem.action)}
                                      >
                                        <UserCheck className="w-3 h-3" /> Approve
                                      </Button>
                                    )}
                                    {executed && (
                                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                        <CheckCircle className="w-3 h-3 mr-1" /> Done
                                      </Badge>
                                    )}
                                  </div>
                                  {rem.command_hint && (
                                    <code className="block text-xs font-mono bg-muted/50 rounded px-2 py-1 text-muted-foreground">{rem.command_hint}</code>
                                  )}
                                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                                    {rem.risk && <span><span className="text-amber-500 font-medium">Risk:</span> {rem.risk}</span>}
                                    {rem.pre_check && <span><span className="text-blue-500 font-medium">Pre:</span> {rem.pre_check}</span>}
                                    {rem.post_check && <span><span className="text-emerald-500 font-medium">Post:</span> {rem.post_check}</span>}
                                    {rem.rollback && <span><span className="text-violet-500 font-medium">Rollback:</span> {rem.rollback}</span>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
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
