import { safetyActions, protectedPaths, consentFlow, escalationPath } from "@/data/safety";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle, AlertTriangle, Brain, XCircle, Shield, Lock, ArrowRight, Search, UserCheck, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const tierConfig = {
  diagnostic: {
    label: "Tier 1 — Diagnostic",
    shortLabel: "Diagnostic",
    icon: Search,
    color: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
    description: "Read-only investigation & debug. Zero system changes.",
    gate: "Always automatic — no confirmation needed",
  },
  basic: {
    label: "Tier 2 — Basic",
    shortLabel: "Basic",
    icon: UserCheck,
    color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    description: "Trivial commands that require human confirmation before execution.",
    gate: "User must approve — shows command, risk, and rollback plan",
  },
  advanced: {
    label: "Tier 3 — Advanced",
    shortLabel: "Advanced",
    icon: Zap,
    color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    description: "Autonomous safe actions. Reversible or zero data-loss risk.",
    gate: "Auto-execute with notification + undo option",
  },
  never: {
    label: "Never",
    shortLabel: "Never",
    icon: XCircle,
    color: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
    description: "Could cause data loss or system instability. Explicitly blocked.",
    gate: "Blocked in code — cannot be executed",
  },
};

const rollbackColors = {
  yes: "text-emerald-600 dark:text-emerald-400",
  partial: "text-amber-600 dark:text-amber-400",
  no: "text-red-600 dark:text-red-400",
};

export function SafetyMatrix() {
  return (
    <div className="space-y-8">
      {/* Tier overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(Object.entries(tierConfig) as [keyof typeof tierConfig, typeof tierConfig[keyof typeof tierConfig]][]).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = safetyActions.filter((a) => a.tier === key).length;
          return (
            <Card key={key} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={cn("text-xs", cfg.color)}>
                    <Icon className="w-3 h-3 mr-1" /> {cfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">{count} actions</span>
                </div>
                <p className="text-xs text-muted-foreground">{cfg.description}</p>
                <p className="text-[10px] text-muted-foreground mt-1 italic">{cfg.gate}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Actions table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Action Safety Matrix
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="hidden md:table-cell">macOS</TableHead>
                <TableHead className="hidden md:table-cell">Windows</TableHead>
                <TableHead>Rollback</TableHead>
                <TableHead className="hidden lg:table-cell">Lifecycle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {safetyActions.map((action) => {
                const cfg = tierConfig[action.tier];
                const Icon = cfg.icon;
                return (
                  <TableRow key={action.action}>
                    <TableCell>
                      <div>
                        <span className="font-medium text-sm">{action.action}</span>
                        <p className="text-xs text-muted-foreground hidden sm:block">{action.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>
                        <Icon className="w-3 h-3 mr-0.5" /> {cfg.shortLabel}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">{action.macPrivilege}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono">{action.winPrivilege}</TableCell>
                    <TableCell>
                      <span className={cn("text-xs font-medium", rollbackColors[action.rollbackPossible])}>
                        {action.rollbackPossible === "yes" ? "✓ Yes" : action.rollbackPossible === "partial" ? "⚠ Partial" : "✗ No"}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="text-[10px] text-muted-foreground space-y-0.5">
                        {action.preCheck && <div>Pre: {action.preCheck}</div>}
                        {action.postCheck && <div>Post: {action.postCheck}</div>}
                        {!action.preCheck && !action.postCheck && <div>{action.rollbackStrategy}</div>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Protected paths & consent */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="w-4 h-4 text-destructive" /> Protected Paths (Never Touch)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {protectedPaths.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm">
                  <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
                  <span className="font-mono text-xs">{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Three-Tier Consent Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {consentFlow.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" /> Escalation Path
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-2">
                {escalationPath.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-bold shrink-0 mt-0.5">{i + 1}</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
