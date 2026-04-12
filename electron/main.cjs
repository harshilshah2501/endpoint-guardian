const { app, BrowserWindow, protocol, ipcMain, Tray, Menu, Notification, nativeImage } = require("electron");
const path = require("path");
const { collectSnapshot } = require("./telemetry.cjs");

let mainWindow;
let tray;
let monitorInterval;
let lastHealth = "healthy"; // track state changes

protocol.registerSchemesAsPrivileged([
  { scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// IPC handler for live telemetry
ipcMain.handle("collect-telemetry", async () => {
  return await collectSnapshot();
});

// IPC handler for renderer-driven health change notifications
ipcMain.on("health-state-changed", (_event, { previousHealth, currentHealth, issues }) => {
  if (currentHealth === previousHealth) return;

  // Update tray
  updateTrayMenu(currentHealth, issues || []);
  lastHealth = currentHealth;

  // Desktop notification on degradation
  if (currentHealth === "critical" && previousHealth !== "critical") {
    new Notification({
      title: "EndpointDoctor — Critical Issue Detected",
      body: (issues && issues.length > 0) ? issues.join(", ") : "System health is critical",
      urgency: "critical",
    }).show();
  } else if (currentHealth === "degraded" && previousHealth === "healthy") {
    new Notification({
      title: "EndpointDoctor — Performance Degraded",
      body: (issues && issues.length > 0) ? issues.join(", ") : "System performance has degraded",
    }).show();
  } else if (currentHealth === "healthy" && previousHealth !== "healthy") {
    new Notification({
      title: "EndpointDoctor — Recovered",
      body: "All systems back to normal",
    }).show();
  }
});

// ─── Health assessment (lightweight, runs in background) ───
function assessHealth(snapshot) {
  let health = "healthy";
  const issues = [];

  // CPU check
  if (snapshot.cpu.usage_avg_1m > 85) {
    health = "critical";
    issues.push(`CPU at ${snapshot.cpu.usage_avg_1m.toFixed(0)}%`);
  } else if (snapshot.cpu.usage_avg_1m > 70) {
    if (health !== "critical") health = "degraded";
    issues.push(`CPU at ${snapshot.cpu.usage_avg_1m.toFixed(0)}%`);
  }

  // Memory check
  const memPct = ((snapshot.memory.total_mb - snapshot.memory.available_mb) / snapshot.memory.total_mb) * 100;
  if (snapshot.memory.pressure === "critical" || memPct > 90) {
    health = "critical";
    issues.push(`Memory ${memPct.toFixed(0)}% used`);
  } else if (snapshot.memory.pressure === "warning" || memPct > 80) {
    if (health !== "critical") health = "degraded";
    issues.push(`Memory ${memPct.toFixed(0)}% used`);
  }

  // Disk check
  if (snapshot.disk.free_pct < 5) {
    health = "critical";
    issues.push(`Disk ${snapshot.disk.free_pct.toFixed(0)}% free`);
  } else if (snapshot.disk.free_pct < 10) {
    if (health !== "critical") health = "degraded";
    issues.push(`Disk ${snapshot.disk.free_pct.toFixed(0)}% free`);
  }

  return { health, issues };
}

// ─── Tray icon colors (1x1 pixel data URIs) ───
function createTrayIcon(color) {
  const colors = {
    green: "#22c55e",
    yellow: "#f59e0b",
    red: "#ef4444",
    gray: "#9ca3af",
  };
  const fill = colors[color] || colors.gray;

  // Create a 16x16 icon programmatically
  const canvas = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
    <circle cx="8" cy="8" r="6" fill="${fill}" stroke="#fff" stroke-width="1"/>
  </svg>`;

  return nativeImage.createFromBuffer(
    Buffer.from(canvas),
    { width: 16, height: 16 }
  );
}

function getHealthColor(health) {
  switch (health) {
    case "healthy": return "green";
    case "degraded": return "yellow";
    case "critical": return "red";
    default: return "gray";
  }
}

// ─── System Tray ───
function createTray() {
  const icon = createTrayIcon("gray");
  tray = new Tray(icon);
  tray.setToolTip("EndpointDoctor — Initializing...");

  updateTrayMenu("healthy", []);

  tray.on("click", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu(health, issues) {
  const statusLabel = health === "healthy" ? "✅ System Healthy"
    : health === "degraded" ? "⚠️ Degraded"
    : "🔴 Critical Issues";

  const template = [
    { label: `EndpointDoctor — ${statusLabel}`, enabled: false },
    { type: "separator" },
    ...(issues.length > 0
      ? issues.map(i => ({ label: `  • ${i}`, enabled: false }))
      : [{ label: "  No issues detected", enabled: false }]),
    { type: "separator" },
    {
      label: "Open Dashboard",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "Scan Now",
      click: async () => {
        await runBackgroundCheck();
      },
    },
    { type: "separator" },
    { label: "Quit", click: () => app.quit() },
  ];

  tray.setContextMenu(Menu.buildFromTemplate(template));
  tray.setToolTip(`EndpointDoctor — ${statusLabel}`);
  tray.setImage(createTrayIcon(getHealthColor(health)));
}

// ─── Background monitoring ───
async function runBackgroundCheck() {
  try {
    const snapshot = await collectSnapshot();
    const { health, issues } = assessHealth(snapshot);

    updateTrayMenu(health, issues);

    // Notify only on state CHANGE to worse
    if (health !== lastHealth) {
      if (health === "critical" && lastHealth !== "critical") {
        new Notification({
          title: "EndpointDoctor — Critical Issue",
          body: issues.join(", "),
          urgency: "critical",
        }).show();
      } else if (health === "degraded" && lastHealth === "healthy") {
        new Notification({
          title: "EndpointDoctor — Performance Warning",
          body: issues.join(", "),
        }).show();
      } else if (health === "healthy" && lastHealth !== "healthy") {
        new Notification({
          title: "EndpointDoctor — Recovered",
          body: "All systems back to normal",
        }).show();
      }
      lastHealth = health;
    }

    // Send to renderer if window is open
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("health-update", { health, issues, snapshot });
    }
  } catch (e) {
    console.error("Background check failed:", e);
  }
}

function startMonitoring() {
  // Initial check after 5 seconds
  setTimeout(runBackgroundCheck, 5000);
  // Then every 60 seconds
  monitorInterval = setInterval(runBackgroundCheck, 60000);
}

// ─── Window ───
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "EndpointDoctor",
    icon: path.join(__dirname, "..", "public", "favicon.ico"),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  protocol.registerFileProtocol("app", (request, callback) => {
    const url = request.url.replace("app://./", "");
    const filePath = path.join(__dirname, "..", "dist", url);
    callback({ path: filePath });
  });

  mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Minimize to tray instead of closing
  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ─── App lifecycle ───
app.whenReady().then(() => {
  createTray();
  createWindow();
  startMonitoring();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  if (monitorInterval) clearInterval(monitorInterval);
});

app.on("window-all-closed", () => {
  // Don't quit — keep tray agent running
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
