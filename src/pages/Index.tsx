import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { IssueCatalog } from "@/components/IssueCatalog";
import { SafetyMatrix } from "@/components/SafetyMatrix";
import { Roadmap } from "@/components/Roadmap";
import { SnapshotViewer } from "@/components/SnapshotViewer";
import { DiagnosisView } from "@/components/DiagnosisView";
import { useDiagnosis } from "@/hooks/use-diagnosis";
import { getEngineInfo } from "@/engine/local-inference";
import { generateSnapshot } from "@/data/scenarios";
import { isElectronApp, collectLiveTelemetry } from "@/engine/electron-telemetry";
import type { EndpointSnapshot } from "@/types/endpoint";
import {
  Stethoscope, Bug, Shield, Map, Brain, Loader2, Zap, Cpu, Wifi, MonitorCheck, RefreshCw, Pause, Moon, Sun, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const APP_VERSION = __APP_VERSION__;

const Index = () => {
  const [snapshot, setSnapshot] = useState<EndpointSnapshot>(() => generateSnapshot(isElectronApp() ? "healthy" : "high_cpu"));
  const [isScanning, setIsScanning] = useState(false);
  const [isBootstrappingLive, setIsBootstrappingLive] = useState(() => isElectronApp());
  const { diagnose, isLoading, result, error, latencyMs, clearResult, modelsReady } = useDiagnosis();
  const engineInfo = useMemo(() => getEngineInfo(), [modelsReady]);
  const isElectron = useMemo(() => isElectronApp(), []);
  const { resolvedTheme, setTheme } = useTheme();
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [telemetryExpanded, setTelemetryExpanded] = useState(true);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHealthRef = useRef<string>("healthy");

  const loadLiveTelemetry = useCallback(async (showToast = true) => {
    if (!isElectronApp()) return;
    setIsScanning(true);
    clearResult();
    try {
      const liveSnap = await collectLiveTelemetry();
      setSnapshot(liveSnap);
      if (showToast) toast.success("Live telemetry collected from this Mac");
    } catch (err) {
      if (showToast) {
        toast.error("Live scan failed: " + (err instanceof Error ? err.message : "Unknown error"));
      }
    } finally {
      setIsScanning(false);
      setIsBootstrappingLive(false);
    }
  }, [clearResult]);

  const collectAndDiagnose = useCallback(async () => {
    if (!isElectronApp()) return;
    setIsScanning(true);
    try {
      const liveSnap = await collectLiveTelemetry();
      setSnapshot(liveSnap);
      const diagResult = await diagnose(liveSnap, "quick");

      // Notify main process on health state change
      if (diagResult && diagResult.overall_health !== lastHealthRef.current) {
        const previousHealth = lastHealthRef.current;
        lastHealthRef.current = diagResult.overall_health;
        const issues = diagResult.diagnoses.map(d => d.title);
        window.electronAPI?.notifyHealthChange({
          previousHealth,
          currentHealth: diagResult.overall_health,
          issues,
        });
      }
    } catch (err) {
      console.warn("Auto-refresh telemetry failed:", err);
    } finally {
      setIsScanning(false);
    }
  }, [diagnose]);

  useEffect(() => {
    if (autoRefresh && isElectron) {
      autoRefreshRef.current = setInterval(collectAndDiagnose, 30_000);
      return () => {
        if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
      };
    } else {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    }
  }, [autoRefresh, isElectron, collectAndDiagnose]);

  useEffect(() => {
    if (!isElectron || !isBootstrappingLive) return;
    void loadLiveTelemetry(false);
  }, [isElectron, isBootstrappingLive, loadLiveTelemetry]);

  useEffect(() => {
    if (result) {
      setTelemetryExpanded(false);
    }
  }, [result]);

  const handleLiveScan = async () => {
    await loadLiveTelemetry(true);
  };

  const handleDiagnose = (mode: "quick" | "deep") => {
    diagnose(snapshot, mode);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">EndpointDoctor</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[11px] text-muted-foreground">Edge AI Diagnostic Engine — Fully Local, Zero Cloud</p>
                <Badge variant="outline" className="text-[10px] font-mono">v{APP_VERSION}</Badge>
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                className="h-8 gap-1.5 text-[11px]"
              >
                {resolvedTheme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {resolvedTheme === "dark" ? "Light" : "Dark"}
              </Button>
              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                <Wifi className="w-3 h-3 mr-1 line-through" /> Offline-Ready
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                <Cpu className="w-3 h-3 mr-1" /> Local Engine
              </Badge>
              {modelsReady && (
                <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                  <Brain className="w-3 h-3 mr-1" /> ONNX ML
                </Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <Tabs defaultValue="diagnose" className="space-y-5">
          <TabsList className="grid w-full grid-cols-2 max-w-sm">
            <TabsTrigger value="diagnose" className="flex items-center gap-1.5 text-xs">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Diagnostics</span>
              <span className="sm:hidden">Diagnose</span>
            </TabsTrigger>
            <TabsTrigger value="reference" className="flex items-center gap-1.5 text-xs">
              <Map className="w-3.5 h-3.5" />
              Reference
            </TabsTrigger>
          </TabsList>

          {/* DIAGNOSTICS TAB */}
          <TabsContent value="diagnose" className="space-y-5">
            {/* Engine info bar */}
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                <span className="font-medium">{engineInfo.name} v{engineInfo.version}</span>
                <span className="text-muted-foreground">{engineInfo.mode}</span>
                <span className="text-muted-foreground">{engineInfo.issuesCovered} issue classes</span>
                <span className="text-muted-foreground">{engineInfo.modelStatus}</span>
                {latencyMs !== null && (
                  <span className="ml-auto font-mono text-emerald-600 dark:text-emerald-400">⚡ {latencyMs}ms</span>
                )}
              </CardContent>
            </Card>

            <Card className="border-primary/15 bg-primary/5">
              <CardContent className="p-4 flex flex-wrap items-center gap-3">
                <div className="mr-auto">
                  <p className="text-sm font-medium">Host Diagnostics</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This screen uses only live telemetry from the current machine and groups it into CPU, Memory, Disk, Network, and overall system health.
                  </p>
                </div>
                {isElectron ? (
                  <>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                      {isBootstrappingLive ? "Connecting to this Mac..." : `Live: ${snapshot.hostname}`}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleLiveScan}
                      disabled={isScanning || isBootstrappingLive}
                      className="h-8 gap-1.5"
                    >
                      {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MonitorCheck className="w-3.5 h-3.5" />}
                      {isScanning ? "Refreshing..." : "Refresh Telemetry"}
                    </Button>
                    <button
                      onClick={() => setAutoRefresh(prev => !prev)}
                      disabled={isBootstrappingLive}
                      className={cn(
                        "px-2.5 py-1.5 rounded-md border text-[11px] transition-all flex items-center gap-1.5 font-medium",
                        autoRefresh
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-card hover:bg-muted border-border text-muted-foreground"
                      )}
                    >
                      {autoRefresh ? <Pause className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                      {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
                    </button>
                  </>
                ) : (
                  <Badge variant="outline" className="text-[10px]">
                    Live telemetry available in Electron desktop app
                  </Badge>
                )}
              </CardContent>
            </Card>

            {/* Diagnose buttons */}
            <div className="rounded-xl border bg-card p-3 flex flex-wrap items-center gap-3">
              <div className="mr-auto">
                <p className="text-sm font-medium">Diagnose this Mac</p>
                <p className="text-xs text-muted-foreground">
                  Use this for real troubleshooting on the current host. Results correlate issues across CPU, RAM, Disk, Network, and system health signals.
                </p>
              </div>
              <Button onClick={() => handleDiagnose("quick")} disabled={isLoading || isBootstrappingLive} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Quick Diagnosis
              </Button>
              <Button onClick={() => handleDiagnose("deep")} disabled={isLoading || isBootstrappingLive} variant="outline" className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Deep Analysis
              </Button>
              {(isLoading || isBootstrappingLive) && <span className="text-xs text-muted-foreground animate-pulse">{isBootstrappingLive ? "Loading this Mac's telemetry..." : "Running local diagnostics..."}</span>}
            </div>

            {/* Error */}
            {error && (
              <Card className="border-destructive/50">
                <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}

            {/* Results */}
            {result && <DiagnosisView result={result} />}

            {/* Snapshot view */}
            <Collapsible open={telemetryExpanded} onOpenChange={setTelemetryExpanded}>
              <Card>
                <CardContent className="p-0">
                  <div className="p-4 flex flex-wrap items-center gap-3 border-b bg-muted/20">
                    <div className="mr-auto">
                      <p className="text-sm font-medium">Telemetry Details</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Raw host signals grouped by CPU, RAM, Disk, Network, and system health.
                      </p>
                    </div>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        {telemetryExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {telemetryExpanded ? "Hide telemetry" : "Show telemetry"}
                      </Button>
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent>
                    <div className="p-4">
                      {isBootstrappingLive ? (
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" /> Collecting live telemetry from your Mac...
                        </div>
                      ) : (
                        <SnapshotViewer snapshot={snapshot} />
                      )}
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          </TabsContent>

          <TabsContent value="reference">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-sm font-medium">Reference Library</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supporting material for understanding issue classes, remediation safety, and planned product direction.
                  </p>
                </div>

                <Tabs defaultValue="issues" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-3 max-w-md">
                    <TabsTrigger value="issues" className="flex items-center gap-1.5 text-xs">
                      <Bug className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Issue Catalog</span>
                      <span className="sm:hidden">Issues</span>
                    </TabsTrigger>
                    <TabsTrigger value="safety" className="flex items-center gap-1.5 text-xs">
                      <Shield className="w-3.5 h-3.5" />
                      Safety
                    </TabsTrigger>
                    <TabsTrigger value="roadmap" className="flex items-center gap-1.5 text-xs">
                      <Map className="w-3.5 h-3.5" />
                      Roadmap
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="issues"><IssueCatalog /></TabsContent>
                  <TabsContent value="safety"><SafetyMatrix /></TabsContent>
                  <TabsContent value="roadmap"><Roadmap /></TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
