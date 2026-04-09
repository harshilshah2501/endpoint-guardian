import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { IssueCatalog } from "@/components/IssueCatalog";
import { SafetyMatrix } from "@/components/SafetyMatrix";
import { Roadmap } from "@/components/Roadmap";
import { Shield, Bug, Map, Stethoscope } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary text-primary-foreground">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">EndpointDoctor</h1>
              <p className="text-xs text-muted-foreground">Architecture Explorer — AI-Assisted Local Endpoint Diagnostics</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="issues" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="issues" className="flex items-center gap-1.5 text-xs">
              <Bug className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Issue Catalog</span>
              <span className="sm:hidden">Issues</span>
            </TabsTrigger>
            <TabsTrigger value="safety" className="flex items-center gap-1.5 text-xs">
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Safety Matrix</span>
              <span className="sm:hidden">Safety</span>
            </TabsTrigger>
            <TabsTrigger value="roadmap" className="flex items-center gap-1.5 text-xs">
              <Map className="w-3.5 h-3.5" />
              Roadmap
            </TabsTrigger>
          </TabsList>

          <TabsContent value="issues">
            <IssueCatalog />
          </TabsContent>
          <TabsContent value="safety">
            <SafetyMatrix />
          </TabsContent>
          <TabsContent value="roadmap">
            <Roadmap />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
