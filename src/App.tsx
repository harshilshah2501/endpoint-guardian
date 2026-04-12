import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, MemoryRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import { isElectronApp } from "@/engine/electron-telemetry";

const queryClient = new QueryClient();

const App = () => {
  const inElectron = isElectronApp();

  const appRoutes = (
    <Routes>
      <Route path="/" element={<Index />} />
      {inElectron ? <Route path="*" element={<Index />} /> : <Route path="*" element={<NotFound />} />}
    </Routes>
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        {inElectron ? (
          <MemoryRouter initialEntries={["/"]}>{appRoutes}</MemoryRouter>
        ) : (
          <BrowserRouter>{appRoutes}</BrowserRouter>
        )}
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
