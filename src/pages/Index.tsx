import { useState, useMemo } from "react";
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
import { scenarios, generateSnapshot, type ScenarioKey } from "@/data/scenarios";
import type { EndpointSnapshot } from "@/types/endpoint";
import {
  Stethoscope, Bug, Shield, Map, Brain, Loader2, Zap, FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

const Index = () => {
  const [activeScenario, setActiveScenario] = useState<ScenarioKey>("high_cpu");
  const [customJson, setCustomJson] = useState("");
  const [snapshot, setSnapshot] = useState<EndpointSnapshot>(() => generateSnapshot("high_cpu"));
  const { diagnose, isLoading, result, error, clearResult } = useDiagnosis();

  const handleScenarioSelect = (key: ScenarioKey) => {
    setActiveScenario(key);
    if (key !== "custom") {
      const snap = generateSnapshot(key);
      setSnapshot(snap);
      clearResult();
    }
  };

  const handleCustomApply = () => {
    try {
      const parsed = JSON.parse(customJson);
      setSnapshot(parsed);
      clearResult();
    } catch {
      // invalid JSON handled by textarea
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
              <p className="text-[11px] text-muted-foreground">AI-Powered Endpoint Diagnostic Engine — MVP Dashboard</p>
            </div>
            <Badge variant="outline" className="ml-auto text-[10px] bg-primary/10 text-primary border-primary/30">
              <Brain className="w-3 h-3 mr-1" /> AI-Enabled
            </Badge>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5">
        <Tabs defaultValue="diagnose" className="space-y-5">
          <TabsList className="grid w-full grid-cols-4 max-w-xl">
            <TabsTrigger value="diagnose" className="flex items-center gap-1.5 text-xs">
              <Brain className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AI Diagnosis</span>
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

          {/* AI DIAGNOSIS TAB */}
          <TabsContent value="diagnose" className="space-y-5">
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
              </div>
              {activeScenario !== "custom" && (
                <p className="text-xs text-muted-foreground mt-2">
                  {scenarios.find(s => s.key === activeScenario)?.description}
                </p>
              )}
            </div>

            {/* Custom JSON input */}
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
              {isLoading && <span className="text-xs text-muted-foreground animate-pulse">AI analyzing endpoint signals...</span>}
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
