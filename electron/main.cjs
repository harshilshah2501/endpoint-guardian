const { app, BrowserWindow, protocol } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

// Register custom protocol for proper MIME type handling (especially .wasm)
protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "EndpointDoctor",
    icon: path.join(__dirname, "..", "public", "favicon.ico"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Register protocol handler for serving files with correct MIME types
  protocol.registerFileProtocol("app", (request, callback) => {
    const url = request.url.replace("app://./", "");
    const filePath = path.join(__dirname, "..", "dist", url);
    callback({ path: filePath });
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
