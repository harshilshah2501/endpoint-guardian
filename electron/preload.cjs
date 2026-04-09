const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  collectTelemetry: () => ipcRenderer.invoke("collect-telemetry"),
  isElectron: true,
});
