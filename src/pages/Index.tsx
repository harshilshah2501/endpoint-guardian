import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IssueCatalog } from "@/components/IssueCatalog";
import { SafetyMatrix } from "@/components/SafetyMatrix";
import { Roadmap } from "@/components/Roadmap";
import { SnapshotViewer } from "@/components/SnapshotViewer";
import { DiagnosisView } from "@/components/DiagnosisView";
import { useDiagnosis } from "@/hooks/use-diagnosis";
import { getEngineInfo } from "@/engine/local-inference";
import { scenarios, generateSnapshot, type ScenarioKey } from "@/data/scenarios";
import { isElectronApp, collectLiveTelemetry } from "@/engine/electron-telemetry";
import type { EndpointSnapshot } from "@/types/endpoint";
import {
  Stethoscope, Bug, Shield, Map, Brain, Loader2, Zap, FlaskConical, Cpu, Wifi, MonitorCheck, RefreshCw, Pause,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const Index = () => {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey | "live">("high_cpu");
  const [customJson, setCustomJson] = useState("");
  const [snapshot, setSnapshot] = useState<EndpointSnapshot>(() => generateSnapshot("high_cpu"));
  const [isScanning, setIsScanning] = useState(false);
  const { diagnose, isLoading, result, error, latencyMs, clearResult, modelsReady } = useDiagnosis();
  const engineInfo = useMemo(() => getEngineInfo(), [modelsReady]);
  const isElectron = useMemo(() => isElectronApp(), []);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastHealthRef = useRef<string>("healthy");

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
    if (autoRefresh && activeScenario === "live") {
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
  }, [autoRefresh, activeScenario, collectAndDiagnose]);

  // Turn off auto-refresh when leaving live mode
  const handleScenarioSelect = (key: ScenarioKey) => {
    setAutoRefresh(false);
    setActiveScenario(key);
    if (key !== "custom") {
      const snap = generateSnapshot(key);
      setSnapshot(snap);
      clearResult();
    }
  };

  const handleLiveScan = async () => {
    setActiveScenario("live");
    setIsScanning(true);
    clearResult();
    try {
      const liveSnap = await collectLiveTelemetry();
      setSnapshot(liveSnap);
      toast.success("Live telemetry collected from this machine");
    } catch (err) {
      toast.error("Live scan failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsScanning(false);
    }
  };

  const handleCustomApply = () => {
    try {
      const parsed = JSON.parse(customJson);
      setSnapshot(parsed);
      clearResult();
    } catch {
      // invalid JSON
    }
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
              <p className="text-[11px] text-muted-foreground">Edge AI Diagnostic Engine — Fully Local, Zero Cloud</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="diagnose" className="flex items-center gap-1.5 text-xs">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Diagnostics</span>
              <span className="sm:hidden">Diagnose</span>
            </TabsTrigger>
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

            {/* Scenario selector */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                <FlaskConical className="w-3.5 h-3.5" /> Select Scenario
              </h3>
              <div className="flex flex-wrap gap-2">
                {scenarios.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => handleScenarioSelect(s.key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs transition-all",
                      activeScenario === s.key
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-card hover:bg-muted border-border"
                    )}
                  >
                    {s.name}
                  </button>
                ))}
                <button
                  onClick={() => handleScenarioSelect("custom")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg border text-xs transition-all",
                    activeScenario === "custom"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card hover:bg-muted border-border"
                  )}
                >
                  Custom JSON
                </button>
                {isElectron && (
                  <button
                    onClick={handleLiveScan}
                    disabled={isScanning}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs transition-all flex items-center gap-1.5 font-semibold",
                      activeScenario === "live"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                        : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {isScanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <MonitorCheck className="w-3 h-3" />}
                    {isScanning ? "Scanning..." : "⚡ Live Scan"}
                  </button>
                )}
                {!isElectron && (
                  <span className="px-3 py-1.5 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground italic">
                    Live Scan available in desktop app
                  </span>
                )}
              </div>
              {activeScenario === "live" && (
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    🖥️ Real telemetry from {snapshot.hostname} ({snapshot.os} {snapshot.os_version})
                  </p>
                  <button
                    onClick={() => setAutoRefresh(prev => !prev)}
                    className={cn(
                      "px-2.5 py-1 rounded-md border text-[10px] transition-all flex items-center gap-1.5 font-medium",
                      autoRefresh
                        ? "bg-emerald-600 text-white border-emerald-600"
                        : "bg-card hover:bg-muted border-border text-muted-foreground"
                    )}
                  >
                    {autoRefresh ? <Pause className="w-3 h-3" /> : <RefreshCw className="w-3 h-3" />}
                    {autoRefresh ? "Auto-refresh ON (30s)" : "Auto-refresh"}
                  </button>
                </div>
              )}
              {activeScenario !== "custom" && activeScenario !== "live" && (
                <p className="text-xs text-muted-foreground mt-2">
                  {scenarios.find(s => s.key === activeScenario)?.description}
                </p>
              )}
            </div>

            {/* Custom JSON */}
            {activeScenario === "custom" && (
              <Card>
                <CardContent className="p-4 space-y-3">
                  <Textarea
                    value={customJson}
                    onChange={(e) => setCustomJson(e.target.value)}
                    placeholder="Paste endpoint snapshot JSON here..."
                    className="font-mono text-xs h-40"
                  />
                  <Button size="sm" onClick={handleCustomApply}>Apply Snapshot</Button>
                </CardContent>
              </Card>
            )}

            {/* Snapshot view */}
            <SnapshotViewer snapshot={snapshot} />

            {/* Diagnose buttons */}
            <div className="flex items-center gap-3">
              <Button onClick={() => handleDiagnose("quick")} disabled={isLoading} className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                Quick Diagnosis
              </Button>
              <Button onClick={() => handleDiagnose("deep")} disabled={isLoading} variant="outline" className="gap-2">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                Deep Analysis
              </Button>
              {isLoading && <span className="text-xs text-muted-foreground animate-pulse">Running local diagnostics...</span>}
            </div>

            {/* Error */}
            {error && (
              <Card className="border-destructive/50">
                <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
              </Card>
            )}

            {/* Results */}
            {result && <DiagnosisView result={result} />}
          </TabsContent>

          <TabsContent value="issues"><IssueCatalog /></TabsContent>
          <TabsContent value="safety"><SafetyMatrix /></TabsContent>
          <TabsContent value="roadmap"><Roadmap /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
