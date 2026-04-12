const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  collectTelemetry: () => ipcRenderer.invoke("collect-telemetry"),
  notifyHealthChange: (data) => ipcRenderer.send("health-state-changed", data),
  isElectron: true,
});
