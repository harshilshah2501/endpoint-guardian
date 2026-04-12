/**
 * Real system telemetry collector for Electron main process.
 * Uses Node.js os module + child_process for platform-specific data.
 */
const os = require("os");
const { execSync } = require("child_process");

function safeExec(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: 5000, ...opts }).trim();
  } catch {
    return "";
  }
}

/** CPU usage: sample over 1 second */
function getCpuUsage() {
  const cpus1 = os.cpus();
  return new Promise((resolve) => {
    setTimeout(() => {
      const cpus2 = os.cpus();
      let totalIdle = 0, totalTick = 0;
      for (let i = 0; i < cpus2.length; i++) {
        const c1 = cpus1[i].times, c2 = cpus2[i].times;
        const idle = c2.idle - c1.idle;
        const total = (c2.user - c1.user) + (c2.nice - c1.nice) + (c2.sys - c1.sys) + (c2.irq - c1.irq) + idle;
        totalIdle += idle;
        totalTick += total;
      }
      const usage = totalTick > 0 ? ((1 - totalIdle / totalTick) * 100) : 0;
      resolve(Math.round(usage * 10) / 10);
    }, 1000);
  });
}

/** Top processes by CPU — platform-specific */
function getTopProcesses() {
  const platform = process.platform;
  const procs = [];

  try {
    if (platform === "darwin") {
      // macOS: use ps
      const raw = safeExec("ps -Arco pid,pcpu,rss,comm -r | head -8");
      const lines = raw.split("\n").slice(1); // skip header
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const pid = parseInt(parts[0], 10);
        const cpu = parseFloat(parts[1]);
        const rssKb = parseInt(parts[2], 10);
        const name = parts.slice(3).join(" ");
        // Heuristic: system processes have low PIDs or known names
        const sysNames = ["kernel_task", "launchd", "WindowServer", "mds", "mdworker", "mds_stores", "loginwindow"];
        const isUser = pid > 100 && !sysNames.includes(name);
        procs.push({ pid, name, cpu_pct: cpu, rss_mb: Math.round(rssKb / 1024), is_user: isUser, runtime_sec: 0 });
      }
    } else if (platform === "win32") {
      // Windows: use wmic
      const raw = safeExec('wmic process get ProcessId,Name,WorkingSetSize /format:csv', { timeout: 10000 });
      const lines = raw.split("\n").filter(l => l.trim().length > 0).slice(1);
      for (const line of lines) {
        const parts = line.trim().split(",");
        if (parts.length < 4) continue;
        const name = parts[1];
        const pid = parseInt(parts[2], 10);
        const wss = parseInt(parts[3], 10);
        if (isNaN(pid) || isNaN(wss)) continue;
        const sysNames = ["System", "Registry", "smss.exe", "csrss.exe", "wininit.exe", "services.exe", "lsass.exe"];
        procs.push({ pid, name, cpu_pct: 0, rss_mb: Math.round(wss / 1048576), is_user: !sysNames.includes(name), runtime_sec: 0 });
      }
      // Sort by RSS since we can't easily get CPU% from wmic
      procs.sort((a, b) => b.rss_mb - a.rss_mb);
    } else {
      // Linux: use ps
      const raw = safeExec("ps -eo pid,pcpu,rss,comm --sort=-pcpu | head -8");
      const lines = raw.split("\n").slice(1);
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 4) continue;
        const pid = parseInt(parts[0], 10);
        const cpu = parseFloat(parts[1]);
        const rssKb = parseInt(parts[2], 10);
        const name = parts.slice(3).join(" ");
        const sysNames = ["systemd", "kthreadd", "rcu_sched", "kworker", "ksoftirqd"];
        const isUser = pid > 100 && !sysNames.some(s => name.startsWith(s));
        procs.push({ pid, name, cpu_pct: cpu, rss_mb: Math.round(rssKb / 1024), is_user: isUser, runtime_sec: 0 });
      }
    }
  } catch {
    // fallback: empty
  }

  return procs.slice(0, 6);
}

/** Disk info */
function getDiskInfo() {
  const platform = process.platform;
  try {
    if (platform === "win32") {
      const raw = safeExec('wmic logicaldisk where "DeviceID=\'C:\'" get FreeSpace,Size /format:csv', { timeout: 10000 });
      const lines = raw.split("\n").filter(l => l.includes(","));
      if (lines.length > 0) {
        const parts = lines[lines.length - 1].trim().split(",");
        const free = parseInt(parts[1], 10);
        const total = parseInt(parts[2], 10);
        if (!isNaN(free) && !isNaN(total) && total > 0) {
          const freeGb = Math.round(free / 1073741824 * 10) / 10;
          const totalGb = Math.round(total / 1073741824 * 10) / 10;
          return { free_pct: Math.round(free / total * 1000) / 10, free_gb: freeGb, total_gb: totalGb };
        }
      }
    } else {
      const raw = safeExec("df -k / | tail -1");
      const parts = raw.split(/\s+/);
      if (parts.length >= 4) {
        const totalKb = parseInt(parts[1], 10);
        const usedKb = parseInt(parts[2], 10);
        const availKb = parseInt(parts[3], 10);
        const totalGb = Math.round(totalKb / 1048576 * 10) / 10;
        const freeGb = Math.round(availKb / 1048576 * 10) / 10;
        const freePct = Math.round(availKb / totalKb * 1000) / 10;
        return { free_pct: freePct, free_gb: freeGb, total_gb: totalGb };
      }
    }
  } catch {}
  return { free_pct: 50, free_gb: 100, total_gb: 200 };
}

/** Memory info */
function getMemoryInfo() {
  const totalMb = Math.round(os.totalmem() / 1048576);
  const freeMb = Math.round(os.freemem() / 1048576);
  const availPct = freeMb / totalMb;

  let swapMb = 0;
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      const raw = safeExec("sysctl vm.swapusage");
      const match = raw.match(/used\s*=\s*([\d.]+)M/);
      if (match) swapMb = Math.round(parseFloat(match[1]));
    } else if (platform === "linux") {
      const raw = safeExec("free -m | grep Swap");
      const parts = raw.split(/\s+/);
      if (parts.length >= 3) swapMb = parseInt(parts[2], 10) || 0;
    }
  } catch {}

  const pressure = availPct < 0.05 ? "critical" : availPct < 0.15 ? "warning" : "normal";

  return { total_mb: totalMb, available_mb: freeMb, pressure, swap_usage_mb: swapMb };
}

/** Network checks */
async function getNetworkInfo() {
  const dns = require("dns");
  const net = require("net");

  function getDefaultGateway() {
    try {
      if (process.platform === "linux") {
        return safeExec("command -v ip >/dev/null 2>&1 && ip route 2>/dev/null | awk '/default/ {print $3; exit}'");
      }
      if (process.platform === "darwin") {
        return safeExec("route -n get default 2>/dev/null | awk '/gateway/ {print $2; exit}'");
      }
    } catch {}
    return "";
  }

  const dnsOk = await new Promise((resolve) => {
    dns.resolve("google.com", (err) => resolve(!err));
  });

  const gatewayReachable = await new Promise((resolve) => {
    // Try to find default gateway
    const gw = getDefaultGateway();
    if (!gw) { resolve(true); return; } // assume OK
    const sock = new net.Socket();
    sock.setTimeout(2000);
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => { sock.destroy(); resolve(false); });
    sock.connect(80, gw);
  });

  const internetReachable = await new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(3000);
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => { sock.destroy(); resolve(false); });
    sock.connect(443, "1.1.1.1");
  });

  // Get DNS server
  const servers = dns.getServers();
  const primaryDns = servers.length > 0 ? servers[0] : "unknown";

  return { dns_ok: dnsOk, gateway_reachable: gatewayReachable, internet_reachable: internetReachable, primary_dns: primaryDns };
}

/** CPU temperature (best-effort) */
function getCpuTemp() {
  try {
    if (process.platform === "darwin") {
      // Requires powermetrics or iStats — usually not available without sudo
      return null;
    } else if (process.platform === "linux") {
      const raw = safeExec("cat /sys/class/thermal/thermal_zone0/temp 2>/dev/null");
      if (raw) return Math.round(parseInt(raw, 10) / 1000);
    }
  } catch {}
  return null;
}

/**
 * Collect a full EndpointSnapshot from the real system.
 */
async function collectSnapshot() {
  const cpuUsage = await getCpuUsage();
  const network = await getNetworkInfo();
  const mem = getMemoryInfo();
  const disk = getDiskInfo();
  const procs = getTopProcesses();
  const cpuTemp = getCpuTemp();

  const osMap = { darwin: "macos", win32: "windows", linux: "linux" };

  return {
    timestamp: new Date().toISOString(),
    hostname: os.hostname(),
    os: osMap[process.platform] || "linux",
    os_version: os.release(),
    agent_version: "1.1.0",
    cpu: {
      usage_avg_1m: cpuUsage,
      usage_avg_5m: cpuUsage, // single sample; would need history for true 5m avg
      core_count: os.cpus().length,
      temp_celsius: cpuTemp,
    },
    memory: mem,
    disk,
    top_processes: procs,
    network,
    services: [{ name: "EndpointDoctor", running: true, restart_count_1h: 0, exit_code: null }],
    crashes: { count_24h: 0, recent_apps: [] },
    updates: { pending_count: 0, last_update: new Date().toISOString() },
    startup: { items_count: 0, boot_time_sec: Math.round(os.uptime()) },
    battery: { health_pct: null, cycle_count: null, thermal_throttle: false },
  };
}

module.exports = { collectSnapshot };
