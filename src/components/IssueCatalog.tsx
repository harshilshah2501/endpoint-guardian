import { useState } from "react";
import { issues } from "@/data/issues";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Cpu, MemoryStick, HardDrive, Gauge, Timer, Bug, Wifi, RefreshCw, Download, Battery,
  ChevronDown, ChevronUp, Shield, Brain, Zap, AlertTriangle, CheckCircle, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap: Record<string, React.ElementType> = {
  Cpu, MemoryStick, HardDrive, Gauge, Timer, Bug, Wifi, RefreshCw, Download, Battery,
};

const tierColors: Record<string, string> = {
  "diagnostic": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "basic": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "advanced": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "never": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const tierIcons: Record<string, React.ElementType> = {
  "diagnostic": Brain,
  "basic": AlertTriangle,
  "advanced": CheckCircle,
  "never": XCircle,
};

const tierLabels: Record<string, string> = {
  "diagnostic": "Diagnostic",
  "basic": "Basic",
  "advanced": "Advanced",
  "never": "Never",
};

export function IssueCatalog() {
  const [expandedId, setExpandedId] = useState<number | null>(1);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-6">
        <Badge variant="outline" className={safetyColors["auto-safe"]}>
          <CheckCircle className="w-3 h-3 mr-1" /> Auto-safe
        </Badge>
        <Badge variant="outline" className={safetyColors["approval"]}>
          <AlertTriangle className="w-3 h-3 mr-1" /> Approval Required
        </Badge>
        <Badge variant="outline" className={safetyColors["recommendation"]}>
          <Brain className="w-3 h-3 mr-1" /> Recommendation Only
        </Badge>
        <Badge variant="outline" className={safetyColors["never"]}>
          <XCircle className="w-3 h-3 mr-1" /> Never Auto-fix
        </Badge>
      </div>

      {issues.map((issue) => {
        const Icon = iconMap[issue.icon] || Cpu;
        const expanded = expandedId === issue.id;
        return (
          <Card
            key={issue.id}
            className={cn(
              "transition-all duration-200 cursor-pointer hover:shadow-md",
              expanded && "ring-2 ring-primary/30 shadow-lg"
            )}
            onClick={() => setExpandedId(expanded ? null : issue.id)}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="text-muted-foreground text-sm font-mono">#{issue.id}</span>
                      {issue.name}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{issue.approach}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {issue.modelUseful === true && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[10px]">
                      <Brain className="w-3 h-3 mr-1" /> ML Useful
                    </Badge>
                  )}
                  {issue.modelUseful === "marginal" && (
                    <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">
                      ML Marginal
                    </Badge>
                  )}
                  {issue.rulesSufficient && (
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                      <Shield className="w-3 h-3 mr-1" /> Rules ✓
                    </Badge>
                  )}
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
            </CardHeader>

            {expanded && (
              <CardContent className="pt-2 space-y-5" onClick={(e) => e.stopPropagation()}>
                {/* Symptoms & Signals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Symptoms</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {issue.symptoms.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs font-normal">{s}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Primary Signals</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {issue.primarySignals.map((s) => (
                        <Badge key={s} variant="outline" className="text-xs font-mono font-normal">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Trigger Conditions */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <Zap className="w-3 h-3 inline mr-1" />Trigger Conditions
                  </h4>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                    {issue.triggerConditions.map((t) => (
                      <code key={t} className="block text-xs font-mono text-foreground">{t}</code>
                    ))}
                  </div>
                </div>

                {/* Decision Logic */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Decision Logic</h4>
                  <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {issue.decisionLogic}
                  </pre>
                </div>

                {/* Remediations */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Remediation Actions</h4>
                  <div className="space-y-2">
                    {issue.remediations.map((r) => {
                      const TierIcon = tierIcons[r.tier];
                      return (
                        <div key={r.action} className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("text-[10px] shrink-0 w-28 justify-center", tierColors[r.tier])}>
                            <TierIcon className="w-3 h-3 mr-1" /> {tierLabels[r.tier]}
                          </Badge>
                          <span className="text-sm">{r.action}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Post-fix & ML notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Post-fix Verification</h4>
                    <p className="text-xs">{issue.postFixVerification}</p>
                  </div>
                  {issue.mlNotes && (
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-purple-700 dark:text-purple-400 mb-1">
                        <Brain className="w-3 h-3 inline mr-1" />ML Notes
                      </h4>
                      <p className="text-xs">{issue.mlNotes}</p>
                    </div>
                  )}
                </div>

                {/* Model Strategy */}
                <div className="border-t pt-3">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span><strong>Approach:</strong> {issue.approach}</span>
                    <span><strong>Model:</strong> {issue.suggestedModel}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 italic">{issue.approachJustification}</p>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
