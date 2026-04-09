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
  remediations: { action: string; safety: "auto-safe" | "approval" | "recommendation" | "never" }[];
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
    safetyLevel: "Auto-fix safe (user process) / Approval (system process)",
    decisionLogic: `IF cpu_usage_avg_5m > 85%:
  top_offenders = get_top_processes(sort=cpu, limit=5)
  FOR each offender:
    IF offender.is_user_process AND offender.cpu > 90% AND offender.duration > 2min:
      → DIAGNOSE: runaway user process
      → REMEDIATE: offer to kill (auto-safe)
    IF offender.is_system_process:
      → DIAGNOSE: system process high CPU
      → REMEDIATE: recommend restart (approval required)
    IF offender.name IN known_indexers:
      → DIAGNOSE: indexing spike
      → REMEDIATE: wait + explain (recommendation only)`,
    remediations: [
      { action: "Kill runaway user process", safety: "auto-safe" },
      { action: "Suggest restarting system service", safety: "approval" },
      { action: "Explain known-benign spikes (indexing, updates)", safety: "recommendation" },
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
    safetyLevel: "Auto-fix safe (suggest close) / Approval (kill)",
    decisionLogic: `IF memory_pressure = critical:
  top_consumers = get_top_processes(sort=rss, limit=5)
  IF any consumer.rss > 50% of total_ram AND consumer.is_user_process:
    → DIAGNOSE: memory hog (user app)
    → REMEDIATE: suggest close / kill with approval
  IF total_open_apps > threshold:
    → DIAGNOSE: too many apps open
    → REMEDIATE: list largest, suggest closing
  IF swap_usage > 4GB AND physical_ram < 8GB:
    → DIAGNOSE: insufficient RAM for workload
    → REMEDIATE: recommendation only (upgrade RAM / reduce load)`,
    remediations: [
      { action: "Suggest closing heavy apps", safety: "recommendation" },
      { action: "Kill memory-hogging user process", safety: "approval" },
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
    safetyLevel: "Auto-fix safe (clear caches/trash)",
    decisionLogic: `cache_size = sum(browser caches, system caches, package caches)
trash_size = get_trash_size()
log_size = get_log_dir_size()
large_downloads = find_files(~/Downloads, size > 500MB, age > 30d)

IF trash_size > 1GB → REMEDIATE: empty trash (auto-safe)
IF cache_size > 2GB → REMEDIATE: clear caches (auto-safe, selective)
IF log_size > 1GB → REMEDIATE: rotate/clear old logs (auto-safe)
IF large_downloads exist → REMEDIATE: list and suggest deletion (approval)`,
    remediations: [
      { action: "Empty trash", safety: "auto-safe" },
      { action: "Clear browser/system caches", safety: "auto-safe" },
      { action: "Rotate old logs", safety: "auto-safe" },
      { action: "Suggest deleting large old downloads", safety: "approval" },
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
    safetyLevel: "Approval required",
    decisionLogic: `IF smart_status = failing:
  → DIAGNOSE: disk hardware degradation
  → REMEDIATE: URGENT backup recommendation (never auto-fix)
IF heavy_writer_process exists:
  → DIAGNOSE: process saturating disk
  → REMEDIATE: identify + recommend throttle (approval)
IF disk_fragmentation high (HDD only):
  → REMEDIATE: schedule defrag (approval, Windows only)`,
    remediations: [
      { action: "Urgent backup recommendation", safety: "never" },
      { action: "Identify disk-saturating process", safety: "approval" },
      { action: "Schedule defrag (Windows HDD)", safety: "approval" },
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
    safetyLevel: "Approval required",
    decisionLogic: `startup_items = list_startup_items()
IF startup_items.count > 15:
  → DIAGNOSE: excessive startup items
  → REMEDIATE: list with impact, suggest disabling (approval)
IF any startup_item.known_unnecessary:
  → REMEDIATE: suggest disabling specific items (approval)`,
    remediations: [
      { action: "List startup items with impact scores", safety: "recommendation" },
      { action: "Disable unnecessary startup items", safety: "approval" },
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
    approachJustification: "Best ML use case. Crash log signature clustering and matching. A distilled BERT (3-5MB) or TF-IDF + logistic regression.",
    safetyLevel: "Recommendation only",
    decisionLogic: `crash_logs = collect_recent_crash_reports(app)
IF crash_signature matches known_patterns:
  → DIAGNOSE: known issue (incompatible plugin, corrupt prefs)
  → REMEDIATE: specific fix (approval)
IF crash_count > 5 in 24h:
  → DIAGNOSE: unstable app
  → REMEDIATE: suggest reinstall / update (recommendation)
IF hung_process.duration > 60s:
  → REMEDIATE: offer force-quit (auto-safe for user apps)`,
    remediations: [
      { action: "Force-quit hung user app", safety: "auto-safe" },
      { action: "Suggest reinstall / update", safety: "recommendation" },
      { action: "Apply known fix for crash pattern", safety: "approval" },
    ],
    postFixVerification: "Monitor crash_count_24h for recurrence.",
    mlNotes: "A tiny text classifier on crash log signatures can cluster unknown crashes and match to known resolution patterns. This is the strongest ML use case.",
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
    approachJustification: "Sequential diagnostic tree. Completely deterministic. No ML can improve on 'ping the gateway.'",
    safetyLevel: "Auto-fix safe (flush DNS, renew DHCP)",
    decisionLogic: `1. Check: is network interface up?
   NO → DIAGNOSE: interface down → enable (auto-safe)
2. Check: is gateway reachable?
   NO → DIAGNOSE: local network issue → reconnect WiFi/Ethernet
3. Check: is DNS resolving?
   NO → DIAGNOSE: DNS failure → flush DNS cache (auto-safe)
4. Check: is internet reachable?
   NO → DIAGNOSE: upstream/firewall issue → recommendation only
5. All pass → DIAGNOSE: intermittent / resolved`,
    remediations: [
      { action: "Flush DNS cache", safety: "auto-safe" },
      { action: "Renew DHCP lease", safety: "auto-safe" },
      { action: "Suggest reconnect WiFi/Ethernet", safety: "recommendation" },
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
    safetyLevel: "Auto-fix safe (restart) / Approval (re-register)",
    decisionLogic: `IF service.status = stopped AND service.expected = running:
  → REMEDIATE: restart service (auto-safe, up to 2 retries)
IF service.restart_count_1h > 3:
  → DIAGNOSE: restart loop
  → check exit_code, stderr, logs
  → REMEDIATE: recommendation (do not keep restarting)`,
    remediations: [
      { action: "Restart stopped service (max 2 retries)", safety: "auto-safe" },
      { action: "Investigate restart loop root cause", safety: "recommendation" },
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
    safetyLevel: "Approval required",
    decisionLogic: `IF pending_updates.age > 14d:
  → REMEDIATE: recommend applying updates (approval)
IF update_error in log:
  → DIAGNOSE: update failure
  → parse error code → match known fixes
  → REMEDIATE: specific fix (approval) or escalate
IF symptoms started within 24h of last_update:
  → DIAGNOSE: possible update-related regression
  → REMEDIATE: recommend rollback / contact IT`,
    remediations: [
      { action: "Recommend applying pending updates", safety: "approval" },
      { action: "Apply known fix for update error", safety: "approval" },
      { action: "Recommend rollback / contact IT", safety: "recommendation" },
    ],
    postFixVerification: "Re-check pending_update_count and update_error_log.",
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
    approachJustification: "Battery degradation trend prediction (Phase 3). Linear regression may suffice.",
    safetyLevel: "Recommendation only",
    decisionLogic: `IF thermal_throttle = active:
  → check top CPU processes → same as Issue #1
IF battery_health < 80%:
  → DIAGNOSE: battery degradation
  → REMEDIATE: recommendation (service battery)
IF battery_drain_rate abnormally high:
  → check energy-hungry processes
  → REMEDIATE: identify + suggest close (recommendation)`,
    remediations: [
      { action: "Identify energy-hungry processes", safety: "recommendation" },
      { action: "Recommend battery service", safety: "recommendation" },
    ],
    postFixVerification: "Monitor cpu_temp and battery_drain_rate over next hour.",
    mlNotes: "Trend-based battery degradation prediction (time-series regression on battery_health over weeks/months). Not critical for MVP.",
  },
];
