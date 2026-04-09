export interface IssueDetail {
  id: number;
  name: string;
  icon: string;
  symptoms: string[];
  primarySignals: string[];
  triggerConditions: string[];
  rulesSufficient: boolean;
  modelUseful: boolean | "marginal";
  suggestedModel: string;
  approach: string;
  approachJustification: string;
  safetyLevel: string;
  decisionLogic: string;
  remediations: { action: string; tier: "diagnostic" | "basic" | "advanced" | "never" }[];
  postFixVerification: string;
  mlNotes?: string;
}

export const issues: IssueDetail[] = [
  {
    id: 1,
    name: "High CPU Usage",
    icon: "Cpu",
    symptoms: ["Fan noise", "UI lag", "Hot chassis"],
    primarySignals: ["cpu_usage_avg_1m/5m", "top_process_cpu", "cpu_temp"],
    triggerConditions: ["cpu_usage_avg_5m > 85%", "single_process_cpu > 95% for > 2 min"],
    rulesSufficient: true,
    modelUseful: "marginal",
    suggestedModel: "Gradient-boosted tree",
    approach: "Rules + stats",
    approachJustification: "Threshold + top-process is sufficient. A GBT classifier for 'repeat offender' detection is Phase 3.",
    safetyLevel: "Basic (user process) / Diagnostic (system process)",
    decisionLogic: `IF cpu_usage_avg_5m > 85%:
  top_offenders = get_top_processes(sort=cpu, limit=5)
  FOR each offender:
    IF offender.is_user_process AND offender.cpu > 90% AND offender.duration > 2min:
      → DIAGNOSE: runaway user process
      → REMEDIATE: offer to kill (basic — needs confirmation)
    IF offender.is_system_process:
      → DIAGNOSE: system process high CPU
      → REMEDIATE: investigate logs (diagnostic)
    IF offender.name IN known_indexers:
      → DIAGNOSE: indexing spike
      → REMEDIATE: wait + explain (diagnostic)`,
    remediations: [
      { action: "Kill runaway user process", tier: "basic" },
      { action: "Investigate system process logs", tier: "diagnostic" },
      { action: "Explain known-benign spikes (indexing, updates)", tier: "diagnostic" },
    ],
    postFixVerification: "Re-sample cpu_usage_avg_1m after 30s. Confirm < 70%.",
  },
  {
    id: 2,
    name: "High Memory / Pressure",
    icon: "MemoryStick",
    symptoms: ["Slowness", "Swapping", "OOM kills"],
    primarySignals: ["memory_pressure", "swap_usage", "top_process_rss"],
    triggerConditions: ["memory_pressure = critical", "swap_usage > 2GB", "available_memory_pct < 10%"],
    rulesSufficient: true,
    modelUseful: false,
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "Purely threshold-based.",
    safetyLevel: "Diagnostic (suggest close) / Basic (kill)",
    decisionLogic: `IF memory_pressure = critical:
  top_consumers = get_top_processes(sort=rss, limit=5)
  IF any consumer.rss > 50% of total_ram AND consumer.is_user_process:
    → DIAGNOSE: memory hog (user app)
    → REMEDIATE: kill with user confirmation (basic)
  IF swap_usage > 4GB AND physical_ram < 8GB:
    → DIAGNOSE: insufficient RAM for workload
    → REMEDIATE: recommendation (diagnostic)`,
    remediations: [
      { action: "Suggest closing heavy apps", tier: "diagnostic" },
      { action: "Kill memory-hogging user process", tier: "basic" },
    ],
    postFixVerification: "Re-check memory_pressure and swap_usage.",
  },
  {
    id: 3,
    name: "Low Disk Space",
    icon: "HardDrive",
    symptoms: ["Warnings", "Install failures", "Slow performance"],
    primarySignals: ["disk_free_pct", "large_files", "cache_size", "trash_size"],
    triggerConditions: ["disk_free_pct < 10%", "disk_free_gb < 5"],
    rulesSufficient: true,
    modelUseful: false,
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "Enumeration + size calculation. Zero ML value.",
    safetyLevel: "Advanced (clear caches/trash) / Basic (delete files)",
    decisionLogic: `cache_size = sum(browser caches, system caches, package caches)
trash_size = get_trash_size()

IF trash_size > 1GB → REMEDIATE: empty trash (advanced — auto-safe)
IF cache_size > 2GB → REMEDIATE: clear caches (advanced — auto-safe)
IF large_downloads exist → REMEDIATE: list and suggest deletion (basic)`,
    remediations: [
      { action: "Empty trash", tier: "advanced" },
      { action: "Clear browser/system caches", tier: "advanced" },
      { action: "Suggest deleting large old downloads", tier: "basic" },
    ],
    postFixVerification: "Re-check disk_free_pct.",
  },
  {
    id: 4,
    name: "Disk I/O Slowness",
    icon: "Gauge",
    symptoms: ["App hangs", "Beach ball", "Write delays"],
    primarySignals: ["disk_queue_depth", "disk_await_ms", "iops", "smart_status"],
    triggerConditions: ["disk_queue_depth > 4 sustained 1m", "disk_await_ms > 200"],
    rulesSufficient: false,
    modelUseful: "marginal",
    suggestedModel: "Time-series anomaly detection",
    approach: "Rules + optional anomaly detection",
    approachJustification: "SMART prediction benefits from time-series anomaly detection, but only with historical data (Phase 2+).",
    safetyLevel: "Diagnostic (investigate) / Basic (schedule defrag)",
    decisionLogic: `IF smart_status = failing:
  → DIAGNOSE: disk hardware degradation
  → REMEDIATE: URGENT backup recommendation (diagnostic)
IF heavy_writer_process exists:
  → DIAGNOSE: process saturating disk
  → REMEDIATE: identify + wait for completion (diagnostic)`,
    remediations: [
      { action: "Urgent backup recommendation", tier: "diagnostic" },
      { action: "Identify disk-saturating process", tier: "diagnostic" },
      { action: "Schedule defrag (Windows HDD)", tier: "basic" },
    ],
    postFixVerification: "Re-check disk_queue_depth and disk_await_ms.",
  },
  {
    id: 5,
    name: "Startup Slowdown",
    icon: "Timer",
    symptoms: ["Long login time", "Delayed desktop"],
    primarySignals: ["startup_items_count", "login_items", "boot_time_sec"],
    triggerConditions: ["boot_time_sec > 120", "login_time_sec > 60"],
    rulesSufficient: true,
    modelUseful: false,
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "List + count. No ML value.",
    safetyLevel: "Basic (disable startup items)",
    decisionLogic: `startup_items = list_startup_items()
IF startup_items.count > 15:
  → DIAGNOSE: excessive startup items
  → REMEDIATE: list with impact, suggest disabling (basic)`,
    remediations: [
      { action: "List startup items with impact scores", tier: "diagnostic" },
      { action: "Disable unnecessary startup items", tier: "basic" },
    ],
    postFixVerification: "Measure next boot_time_sec.",
  },
  {
    id: 6,
    name: "App Crash / Freeze",
    icon: "Bug",
    symptoms: ["Crash dialogs", "Force-quit needed", "Repeated hangs"],
    primarySignals: ["crash_count_24h", "crash_log_signature", "hung_process"],
    triggerConditions: ["crash_count_24h > 3 for same app", "hung_process detected"],
    rulesSufficient: false,
    modelUseful: true,
    suggestedModel: "Tiny transformer (text classifier)",
    approach: "Rules + tiny text classifier ⭐",
    approachJustification: "Best ML use case. Crash log signature clustering and matching.",
    safetyLevel: "Diagnostic (analyze) / Basic (reinstall)",
    decisionLogic: `crash_logs = collect_recent_crash_reports(app)
IF crash_signature matches known_patterns:
  → DIAGNOSE: known issue
  → REMEDIATE: specific fix (basic — needs confirmation)
IF crash_count > 5 in 24h:
  → DIAGNOSE: unstable app
  → REMEDIATE: suggest reinstall (diagnostic)`,
    remediations: [
      { action: "Analyze crash log signatures", tier: "diagnostic" },
      { action: "Suggest reinstall / update", tier: "diagnostic" },
      { action: "Apply known fix for crash pattern", tier: "basic" },
    ],
    postFixVerification: "Monitor crash_count_24h for recurrence.",
    mlNotes: "A tiny text classifier on crash log signatures can cluster unknown crashes and match to known resolution patterns.",
  },
  {
    id: 7,
    name: "Network / DNS Issues",
    icon: "Wifi",
    symptoms: ["No internet", "Slow browsing", "Timeouts"],
    primarySignals: ["dns_fail_rate", "ping_latency", "gateway_reachable", "dns_server"],
    triggerConditions: ["dns_fail_rate > 30%", "gateway_unreachable", "internet_unreachable"],
    rulesSufficient: true,
    modelUseful: false,
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "Sequential diagnostic tree. Completely deterministic.",
    safetyLevel: "Advanced (flush DNS, toggle WiFi) / Basic (change DNS server)",
    decisionLogic: `1. Check: gateway reachable?
   NO → DIAGNOSE: local network issue
   → REMEDIATE: toggle WiFi (advanced — auto-safe)
2. Check: DNS resolving?
   NO → DIAGNOSE: DNS failure
   → REMEDIATE: flush DNS cache (advanced — auto-safe)
3. Check: internet reachable?
   NO → DIAGNOSE: upstream/firewall issue
   → REMEDIATE: investigation only (diagnostic)`,
    remediations: [
      { action: "Flush DNS cache", tier: "advanced" },
      { action: "Toggle WiFi", tier: "advanced" },
      { action: "Change DNS server", tier: "basic" },
      { action: "Investigate firewall/proxy settings", tier: "diagnostic" },
    ],
    postFixVerification: "Re-run sequential diagnostic tree.",
  },
  {
    id: 8,
    name: "Service Restart Loops",
    icon: "RefreshCw",
    symptoms: ["Agent offline", "Feature broken", "High CPU from service"],
    primarySignals: ["service_status", "service_restart_count", "service_exit_code"],
    triggerConditions: ["watched_service.status != running", "service_restart_count_1h > 3"],
    rulesSufficient: true,
    modelUseful: "marginal",
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "Exit code + log matching. Boolean checks.",
    safetyLevel: "Advanced (restart stopped) / Diagnostic (investigate loop)",
    decisionLogic: `IF service.status = stopped AND service.expected = running:
  → REMEDIATE: restart service (advanced — auto-safe, max 2 retries)
IF service.restart_count_1h > 3:
  → DIAGNOSE: restart loop
  → REMEDIATE: investigate logs (diagnostic — do not keep restarting)`,
    remediations: [
      { action: "Restart stopped service (max 2 retries)", tier: "advanced" },
      { action: "Investigate restart loop root cause", tier: "diagnostic" },
    ],
    postFixVerification: "Verify service_status = running after 30s.",
  },
  {
    id: 9,
    name: "Update Issues",
    icon: "Download",
    symptoms: ["Pending updates", "Failed installs", "Post-update breakage"],
    primarySignals: ["pending_updates", "last_update_date", "update_error_log"],
    triggerConditions: ["pending_update_age > 14d", "update_failure detected"],
    rulesSufficient: true,
    modelUseful: false,
    suggestedModel: "Rules only",
    approach: "Rules only",
    approachJustification: "Error code matching.",
    safetyLevel: "Basic (apply updates)",
    decisionLogic: `IF pending_updates.age > 14d:
  → REMEDIATE: apply updates (basic — needs confirmation)
IF symptoms started within 24h of last_update:
  → DIAGNOSE: possible update regression
  → REMEDIATE: recommend rollback (diagnostic)`,
    remediations: [
      { action: "Apply pending updates", tier: "basic" },
      { action: "Recommend rollback / contact IT", tier: "diagnostic" },
    ],
    postFixVerification: "Re-check pending_update_count.",
  },
  {
    id: 10,
    name: "Battery / Thermal",
    icon: "Battery",
    symptoms: ["Short battery life", "Throttling", "Hot chassis"],
    primarySignals: ["battery_health", "cpu_temp", "fan_speed", "thermal_throttle"],
    triggerConditions: ["cpu_temp > 95°C", "battery_health < 80%", "thermal_throttle = active"],
    rulesSufficient: false,
    modelUseful: true,
    suggestedModel: "Time-series regression",
    approach: "Rules + optional time-series",
    approachJustification: "Battery degradation trend prediction (Phase 3).",
    safetyLevel: "Diagnostic (all recommendations)",
    decisionLogic: `IF thermal_throttle = active:
  → check top CPU processes → same as Issue #1
IF battery_health < 80%:
  → DIAGNOSE: battery degradation
  → REMEDIATE: recommendation (diagnostic)`,
    remediations: [
      { action: "Identify energy-hungry processes", tier: "diagnostic" },
      { action: "Recommend battery service", tier: "diagnostic" },
    ],
    postFixVerification: "Monitor cpu_temp and battery_drain_rate over next hour.",
    mlNotes: "Trend-based battery degradation prediction. Not critical for MVP.",
  },
];
