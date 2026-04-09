import { phases, footprintBudget } from "@/data/roadmap";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle, AlertTriangle, XCircle, Clock, Target, Zap, Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";

const phaseColors: Record<string, string> = {
  primary: "border-l-4 border-l-primary",
  accent: "border-l-4 border-l-emerald-500",
  warning: "border-l-4 border-l-amber-500",
  destructive: "border-l-4 border-l-red-500",
};

const phaseBadgeColors: Record<string, string> = {
  primary: "bg-primary/10 text-primary border-primary/30",
  accent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  destructive: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
};

export function Roadmap() {
  return (
    <div className="space-y-8">
      {/* Timeline visualization */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {phases.map((phase, i) => (
          <div key={phase.id} className="flex items-center">
            <div className={cn("flex items-center gap-2 px-4 py-2 rounded-lg border", phaseBadgeColors[phase.color])}>
              <span className="font-mono text-xs font-bold">P{phase.id}</span>
              <span className="text-xs font-medium whitespace-nowrap">{phase.name}</span>
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{phase.weeks}</span>
            </div>
            {i < phases.length - 1 && (
              <div className="w-6 h-px bg-border mx-1" />
            )}
          </div>
        ))}
      </div>

      {/* Phase cards */}
      {phases.map((phase) => (
        <Card key={phase.id} className={cn(phaseColors[phase.color])}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="font-mono text-muted-foreground">Phase {phase.id}</span>
                  {phase.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{phase.subtitle}</p>
              </div>
              <Badge variant="outline" className={cn(phaseBadgeColors[phase.color])}>
                <Clock className="w-3 h-3 mr-1" /> {phase.weeks}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Scope */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Target className="w-3 h-3" /> Scope
                </h4>
                <ul className="space-y-1">
                  {phase.scope.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <Zap className="w-3 h-3 text-primary mt-1 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Success Criteria */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Success Criteria
                </h4>
                <ul className="space-y-1">
                  {phase.successCriteria.map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm">
                      <CheckCircle className="w-3 h-3 text-emerald-500 mt-1 shrink-0" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Risks */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Risks
                </h4>
                <ul className="space-y-1">
                  {phase.risks.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs">
                      <AlertTriangle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Dependencies */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Dependencies</h4>
                <div className="flex flex-wrap gap-1">
                  {phase.dependencies.map((d) => (
                    <Badge key={d} variant="secondary" className="text-[10px] font-normal">{d}</Badge>
                  ))}
                </div>
              </div>

              {/* Not Yet */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                  <Ban className="w-3 h-3" /> Not Yet
                </h4>
                <div className="flex flex-wrap gap-1">
                  {phase.notYet.map((n) => (
                    <Badge key={n} variant="outline" className="text-[10px] font-normal text-muted-foreground">{n}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Footprint budget */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Footprint Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Metric</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Hard Limit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {footprintBudget.map((row) => (
                <TableRow key={row.metric}>
                  <TableCell className="font-medium text-sm">{row.metric}</TableCell>
                  <TableCell className="text-sm font-mono text-emerald-600 dark:text-emerald-400">{row.target}</TableCell>
                  <TableCell className="text-sm font-mono text-amber-600 dark:text-amber-400">{row.hardLimit}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
