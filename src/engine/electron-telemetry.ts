import type { EndpointSnapshot } from "@/types/endpoint";

interface ElectronAPI {
  collectTelemetry: () => Promise<EndpointSnapshot>;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export function isElectronApp(): boolean {
  return !!window.electronAPI?.isElectron;
}

export async function collectLiveTelemetry(): Promise<EndpointSnapshot> {
  if (!window.electronAPI) {
    throw new Error("Live telemetry is only available in the Electron desktop app");
  }
  return window.electronAPI.collectTelemetry();
}
