import type { EndpointSnapshot } from "@/types/endpoint";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Cpu, MemoryStick, HardDrive, Wifi, Activity, Battery, Thermometer, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  snapshot: EndpointSnapshot;
}

function Metric({ label, value, unit, warn, crit }: { label: string; value: number | string | null; unit?: string; warn?: boolean; crit?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn(
        "font-mono text-sm font-medium",
        crit && "text-red-500",
        warn && !crit && "text-amber-500",
        !warn && !crit && "text-foreground"
      )}>
        {value ?? "N/A"}{unit && <span className="text-muted-foreground text-xs ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

export function SnapshotViewer({ snapshot }: Props) {
  const s = snapshot;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* CPU */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-primary" /> CPU</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="1m avg" value={s.cpu.usage_avg_1m} unit="%" warn={s.cpu.usage_avg_1m > 70} crit={s.cpu.usage_avg_1m > 85} />
          <Metric label="5m avg" value={s.cpu.usage_avg_5m} unit="%" warn={s.cpu.usage_avg_5m > 70} crit={s.cpu.usage_avg_5m > 85} />
          <Metric label="Temp" value={s.cpu.temp_celsius} unit="°C" warn={(s.cpu.temp_celsius ?? 0) > 80} crit={(s.cpu.temp_celsius ?? 0) > 95} />
          <Metric label="Cores" value={s.cpu.core_count} />
        </CardContent>
      </Card>

      {/* Memory */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><MemoryStick className="w-4 h-4 text-primary" /> Memory</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="Available" value={s.memory.available_mb} unit="MB" warn={s.memory.available_mb < 2048} crit={s.memory.available_mb < 1024} />
          <Metric label="Total" value={s.memory.total_mb} unit="MB" />
          <Metric label="Pressure" value={s.memory.pressure} warn={s.memory.pressure === "warning"} crit={s.memory.pressure === "critical"} />
          <Metric label="Swap" value={s.memory.swap_usage_mb} unit="MB" warn={s.memory.swap_usage_mb > 2000} crit={s.memory.swap_usage_mb > 4000} />
        </CardContent>
      </Card>

      {/* Disk */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><HardDrive className="w-4 h-4 text-primary" /> Disk</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="Free" value={s.disk.free_pct} unit="%" warn={s.disk.free_pct < 15} crit={s.disk.free_pct < 10} />
          <Metric label="Free space" value={s.disk.free_gb} unit="GB" />
          <Metric label="Total" value={s.disk.total_gb} unit="GB" />
        </CardContent>
      </Card>

      {/* Network */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><Wifi className="w-4 h-4 text-primary" /> Network</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="DNS" value={s.network.dns_ok ? "OK" : "FAIL"} crit={!s.network.dns_ok} />
          <Metric label="Gateway" value={s.network.gateway_reachable ? "OK" : "FAIL"} crit={!s.network.gateway_reachable} />
          <Metric label="Internet" value={s.network.internet_reachable ? "OK" : "FAIL"} crit={!s.network.internet_reachable} />
          <Metric label="DNS Server" value={s.network.primary_dns} />
        </CardContent>
      </Card>

      {/* Services & Crashes */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Health</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="Crashes (24h)" value={s.crashes.count_24h} warn={s.crashes.count_24h > 2} crit={s.crashes.count_24h > 5} />
          <Metric label="Updates pending" value={s.updates.pending_count} warn={s.updates.pending_count > 3} />
          <Metric label="Startup items" value={s.startup.items_count} warn={s.startup.items_count > 15} />
          <Metric label="Boot time" value={s.startup.boot_time_sec} unit="s" warn={(s.startup.boot_time_sec ?? 0) > 60} crit={(s.startup.boot_time_sec ?? 0) > 120} />
        </CardContent>
      </Card>

      {/* Battery / Thermal */}
      <Card className="overflow-hidden">
        <CardHeader className="py-3 px-4 bg-muted/30">
          <CardTitle className="text-sm flex items-center gap-2"><Battery className="w-4 h-4 text-primary" /> Battery / Thermal</CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-2">
          <Metric label="Battery health" value={s.battery.health_pct} unit="%" warn={(s.battery.health_pct ?? 100) < 80} crit={(s.battery.health_pct ?? 100) < 60} />
          <Metric label="Cycle count" value={s.battery.cycle_count} warn={(s.battery.cycle_count ?? 0) > 1000} />
          <Metric label="Thermal throttle" value={s.battery.thermal_throttle ? "ACTIVE" : "Off"} crit={s.battery.thermal_throttle} />
        </CardContent>
      </Card>

      {/* Top Processes */}
      {s.top_processes.length > 0 && (
        <Card className="sm:col-span-2 lg:col-span-3 overflow-hidden">
          <CardHeader className="py-3 px-4 bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-primary" /> Top Processes</CardTitle>
          </CardHeader>
          <CardContent className="px-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {s.top_processes.slice(0, 6).map((p) => (
                <div key={`${p.pid}-${p.name}`} className="flex items-center justify-between bg-muted/30 rounded px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={p.is_user ? "secondary" : "outline"} className="text-[10px] px-1.5">
                      {p.is_user ? "user" : "sys"}
                    </Badge>
                    <span className="text-xs font-medium truncate max-w-[120px]">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className={cn(p.cpu_pct > 80 ? "text-red-500" : p.cpu_pct > 50 ? "text-amber-500" : "text-muted-foreground")}>
                      {p.cpu_pct}% CPU
                    </span>
                    <span className="text-muted-foreground">{p.rss_mb}MB</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
