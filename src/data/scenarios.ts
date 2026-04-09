import type { EndpointSnapshot } from "@/types/endpoint";

// Helper to generate random in range
const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const baseSnapshot = (): EndpointSnapshot => ({
  timestamp: new Date().toISOString(),
  hostname: "demo-macbook",
  os: "macos",
  os_version: "15.3",
  agent_version: "0.1.0",
  cpu: { usage_avg_1m: rand(5, 25), usage_avg_5m: rand(5, 20), core_count: 8, temp_celsius: rand(40, 55) },
  memory: { total_mb: 16384, available_mb: randInt(4000, 8000), pressure: "normal", swap_usage_mb: randInt(0, 200) },
  disk: { free_pct: rand(30, 60), free_gb: rand(60, 150), total_gb: 239 },
  top_processes: [
    { pid: 101, name: "Finder", cpu_pct: rand(0.1, 2), rss_mb: randInt(30, 80), is_user: true, runtime_sec: 86400 },
    { pid: 102, name: "Safari", cpu_pct: rand(1, 5), rss_mb: randInt(100, 300), is_user: true, runtime_sec: 3600 },
    { pid: 103, name: "WindowServer", cpu_pct: rand(1, 4), rss_mb: randInt(80, 200), is_user: false, runtime_sec: 86400 },
  ],
  network: { dns_ok: true, gateway_reachable: true, internet_reachable: true, primary_dns: "8.8.8.8" },
  services: [{ name: "com.apple.mdworker", running: true, restart_count_1h: 0, exit_code: null }],
  crashes: { count_24h: 0, recent_apps: [] },
  updates: { pending_count: 0, last_update: new Date(Date.now() - 5 * 86400000).toISOString() },
  startup: { items_count: 8, boot_time_sec: 25 },
  battery: { health_pct: 92, cycle_count: 245, thermal_throttle: false },
});

export type ScenarioKey = "healthy" | "high_cpu" | "memory_pressure" | "low_disk" | "dns_failure" | "crash_storm" | "multi_issue" | "thermal_crisis" | "custom";

interface Scenario {
  name: string;
  description: string;
  key: ScenarioKey;
}

export const scenarios: Scenario[] = [
  { key: "healthy", name: "Healthy Endpoint", description: "All signals within normal range" },
  { key: "high_cpu", name: "High CPU — Runaway Process", description: "Chrome Helper pegged at 98% CPU for 10+ minutes" },
  { key: "memory_pressure", name: "Memory Crisis", description: "Critical memory pressure with heavy swap usage" },
  { key: "low_disk", name: "Low Disk Space", description: "Only 3% disk space remaining" },
  { key: "dns_failure", name: "DNS / Network Failure", description: "DNS resolution failing, gateway reachable" },
  { key: "crash_storm", name: "App Crash Storm", description: "Slack crashing repeatedly (7 times in 24h)" },
  { key: "multi_issue", name: "Multi-Issue Cascade", description: "High CPU + memory pressure + thermal throttling" },
  { key: "thermal_crisis", name: "Thermal Throttling", description: "CPU at 99°C, fan maxed, thermal throttle active" },
];

export function generateSnapshot(scenario: ScenarioKey): EndpointSnapshot {
  const snap = baseSnapshot();

  switch (scenario) {
    case "high_cpu":
      snap.cpu.usage_avg_1m = 94.2;
      snap.cpu.usage_avg_5m = 91.7;
      snap.cpu.temp_celsius = 88;
      snap.top_processes = [
        { pid: 1234, name: "Google Chrome Helper", cpu_pct: 98.1, rss_mb: 1450, is_user: true, runtime_sec: 720 },
        { pid: 1235, name: "Google Chrome Helper", cpu_pct: 42.3, rss_mb: 820, is_user: true, runtime_sec: 720 },
        { pid: 50, name: "kernel_task", cpu_pct: 15.2, rss_mb: 0, is_user: false, runtime_sec: 86400 },
        ...snap.top_processes,
      ];
      break;

    case "memory_pressure":
      snap.memory.pressure = "critical";
      snap.memory.available_mb = 512;
      snap.memory.swap_usage_mb = 4800;
      snap.top_processes = [
        { pid: 2001, name: "Electron", cpu_pct: 12.3, rss_mb: 4200, is_user: true, runtime_sec: 7200 },
        { pid: 2002, name: "node", cpu_pct: 8.1, rss_mb: 2800, is_user: true, runtime_sec: 3600 },
        { pid: 2003, name: "Safari", cpu_pct: 5.5, rss_mb: 1900, is_user: true, runtime_sec: 14400 },
        ...snap.top_processes,
      ];
      break;

    case "low_disk":
      snap.disk.free_pct = 3.1;
      snap.disk.free_gb = 7.4;
      break;

    case "dns_failure":
      snap.network.dns_ok = false;
      snap.network.internet_reachable = false;
      snap.network.gateway_reachable = true;
      break;

    case "crash_storm":
      snap.crashes.count_24h = 7;
      snap.crashes.recent_apps = ["Slack", "Slack", "Slack", "Slack", "Slack", "Slack", "Slack"];
      break;

    case "multi_issue":
      snap.cpu.usage_avg_1m = 89.5;
      snap.cpu.usage_avg_5m = 87.2;
      snap.cpu.temp_celsius = 96;
      snap.memory.pressure = "warning";
      snap.memory.available_mb = 1800;
      snap.memory.swap_usage_mb = 2400;
      snap.disk.free_pct = 4.5;
      snap.disk.free_gb = 10.8;
      snap.battery.thermal_throttle = true;
      snap.top_processes = [
        { pid: 3001, name: "docker", cpu_pct: 88, rss_mb: 5500, is_user: true, runtime_sec: 18000 },
        { pid: 3002, name: "node", cpu_pct: 22, rss_mb: 1800, is_user: true, runtime_sec: 7200 },
        ...snap.top_processes,
      ];
      break;

    case "thermal_crisis":
      snap.cpu.usage_avg_1m = 72;
      snap.cpu.usage_avg_5m = 68;
      snap.cpu.temp_celsius = 99;
      snap.battery.thermal_throttle = true;
      snap.battery.health_pct = 74;
      snap.battery.cycle_count = 1150;
      break;

    case "healthy":
    default:
      break;
  }

  return snap;
}
