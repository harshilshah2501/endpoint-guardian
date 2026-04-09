import type { EndpointSnapshot, DiagnosisResult } from "@/types/endpoint";

interface Signal {
  field: string;
  value: string;
  threshold: string;
  note: string;
}

interface Remediation {
  action: string;
  safety_level: "auto_safe" | "approval_required" | "recommendation_only";
  command_hint?: string;
  risk: string;
}

interface Diagnosis {
  issue_class: string;
  severity: "critical" | "warning" | "info";
  confidence: number;
  title: string;
  explanation: string;
  contributing_signals: Signal[];
  remediations: Remediation[];
  post_verification: string;
}

// ─── Individual rule detectors ───

function detectHighCpu(s: EndpointSnapshot): Diagnosis | null {
  if (s.cpu.usage_avg_5m < 70 && s.cpu.usage_avg_1m < 80) return null;

  const topOffender = s.top_processes.find(p => p.cpu_pct > 80 && p.is_user);
  const systemOffender = s.top_processes.find(p => p.cpu_pct > 60 && !p.is_user);
  const indexers = ["mds", "mdworker", "Spotlight", "SearchIndexer", "mds_stores"];
  const isIndexing = s.top_processes.some(p => indexers.includes(p.name));

  const signals: Signal[] = [];
  const remediations: Remediation[] = [];

  if (s.cpu.usage_avg_5m >= 85) {
    signals.push({ field: "cpu.usage_avg_5m", value: `${s.cpu.usage_avg_5m}%`, threshold: "< 70%", note: "Sustained high CPU" });
  }
  if (s.cpu.usage_avg_1m >= 80) {
    signals.push({ field: "cpu.usage_avg_1m", value: `${s.cpu.usage_avg_1m}%`, threshold: "< 70%", note: "Current CPU spike" });
  }

  let title = "High CPU Usage Detected";
  let explanation = `System CPU averaging ${s.cpu.usage_avg_5m}% over 5 minutes.`;

  if (topOffender) {
    title = `High CPU: ${topOffender.name} (${topOffender.cpu_pct}%)`;
    explanation = `${topOffender.name} (PID ${topOffender.pid}) is consuming ${topOffender.cpu_pct}% CPU for ${Math.round(topOffender.runtime_sec / 60)} minutes. `;
    explanation += topOffender.runtime_sec > 300
      ? "This appears to be a runaway process."
      : "This may be a temporary intensive operation.";
    signals.push({ field: "top_process.cpu_pct", value: `${topOffender.cpu_pct}%`, threshold: "< 50%", note: `${topOffender.name} is the primary consumer` });

    remediations.push({
      action: `Terminate ${topOffender.name} (PID ${topOffender.pid})`,
      safety_level: "approval_required",
      command_hint: s.os === "macos" ? `kill -15 ${topOffender.pid}` : `taskkill /PID ${topOffender.pid}`,
      risk: `Will close ${topOffender.name}. Unsaved work may be lost.`,
    });
  }

  if (isIndexing) {
    remediations.push({
      action: "Wait for indexing to complete — this is normal after updates or large file changes",
      safety_level: "recommendation_only",
      risk: "None — indexing is a normal system process",
    });
  }

  if (systemOffender && !isIndexing) {
    remediations.push({
      action: `Investigate system process: ${systemOffender.name}`,
      safety_level: "recommendation_only",
      risk: "System processes may be essential — do not kill without understanding",
    });
  }

  const severity = s.cpu.usage_avg_5m >= 90 ? "critical" : s.cpu.usage_avg_5m >= 75 ? "warning" : "info";
  const confidence = topOffender ? 0.95 : 0.8;

  return {
    issue_class: "high_cpu",
    severity,
    confidence,
    title,
    explanation,
    contributing_signals: signals,
    remediations,
    post_verification: "Re-check cpu.usage_avg_1m after 30 seconds. Expect < 50%.",
  };
}

function detectHighMemory(s: EndpointSnapshot): Diagnosis | null {
  const availPct = (s.memory.available_mb / s.memory.total_mb) * 100;
  if (s.memory.pressure === "normal" && availPct > 15 && s.memory.swap_usage_mb < 2000) return null;

  const signals: Signal[] = [];
  const remediations: Remediation[] = [];

  if (s.memory.pressure !== "normal") {
    signals.push({ field: "memory.pressure", value: s.memory.pressure, threshold: "normal", note: "OS-reported memory pressure" });
  }
  if (availPct < 15) {
    signals.push({ field: "memory.available_pct", value: `${availPct.toFixed(1)}%`, threshold: "> 20%", note: `Only ${s.memory.available_mb}MB free of ${s.memory.total_mb}MB` });
  }
  if (s.memory.swap_usage_mb > 2000) {
    signals.push({ field: "memory.swap_usage_mb", value: `${s.memory.swap_usage_mb}MB`, threshold: "< 1000MB", note: "Heavy swapping degrades performance" });
  }

  const memHog = s.top_processes.find(p => p.rss_mb > s.memory.total_mb * 0.3 && p.is_user);
  let explanation = `Memory pressure is ${s.memory.pressure} with ${s.memory.available_mb}MB available. `;
  if (memHog) {
    explanation += `${memHog.name} is consuming ${memHog.rss_mb}MB (${((memHog.rss_mb / s.memory.total_mb) * 100).toFixed(0)}% of total RAM).`;
    remediations.push({
      action: `Close or restart ${memHog.name} to reclaim ${memHog.rss_mb}MB`,
      safety_level: "approval_required",
      command_hint: s.os === "macos" ? `kill -15 ${memHog.pid}` : `taskkill /PID ${memHog.pid}`,
      risk: `Will close ${memHog.name}. Save work first.`,
    });
  }
  if (s.memory.swap_usage_mb > 4000 && s.memory.total_mb < 8192) {
    explanation += " System RAM may be insufficient for current workload.";
    remediations.push({
      action: "Consider upgrading RAM or reducing concurrent applications",
      safety_level: "recommendation_only",
      risk: "None — informational recommendation",
    });
  }

  return {
    issue_class: "high_memory",
    severity: s.memory.pressure === "critical" ? "critical" : "warning",
    confidence: 0.92,
    title: `Memory Pressure: ${s.memory.pressure}`,
    explanation,
    contributing_signals: signals,
    remediations,
    post_verification: "Re-check memory.pressure and swap_usage after 30 seconds.",
  };
}

function detectLowDisk(s: EndpointSnapshot): Diagnosis | null {
  if (s.disk.free_pct >= 10 && s.disk.free_gb >= 5) return null;

  const signals: Signal[] = [
    { field: "disk.free_pct", value: `${s.disk.free_pct}%`, threshold: "> 10%", note: `Only ${s.disk.free_gb}GB free of ${s.disk.total_gb}GB` },
  ];

  const remediations: Remediation[] = [
    { action: "Empty trash / recycle bin", safety_level: "auto_safe", command_hint: s.os === "macos" ? "rm -rf ~/.Trash/*" : "Clear-RecycleBin -Force", risk: "Permanently deletes trashed files" },
    { action: "Clear browser and system caches", safety_level: "auto_safe", risk: "Caches will rebuild. No data loss." },
    { action: "Review and remove large files in Downloads folder", safety_level: "approval_required", risk: "User should verify files before deletion" },
  ];

  return {
    issue_class: "low_disk",
    severity: s.disk.free_pct < 5 ? "critical" : "warning",
    confidence: 0.98,
    title: `Low Disk Space: ${s.disk.free_pct}% free (${s.disk.free_gb}GB)`,
    explanation: `Disk is ${(100 - s.disk.free_pct).toFixed(0)}% full with only ${s.disk.free_gb}GB remaining. This can cause application failures, slow performance, and inability to install updates.`,
    contributing_signals: signals,
    remediations,
    post_verification: "Re-check disk.free_pct. Target > 15%.",
  };
}

function detectNetworkDns(s: EndpointSnapshot): Diagnosis | null {
  if (s.network.dns_ok && s.network.gateway_reachable && s.network.internet_reachable) return null;

  const signals: Signal[] = [];
  const remediations: Remediation[] = [];
  let title = "Network Issue Detected";
  let explanation = "";
  let severity: "critical" | "warning" = "warning";

  if (!s.network.gateway_reachable) {
    title = "Local Network Unreachable";
    explanation = "Cannot reach the default gateway. The device may be disconnected from the network.";
    severity = "critical";
    signals.push({ field: "network.gateway_reachable", value: "false", threshold: "true", note: "No local network connectivity" });
    remediations.push(
      { action: "Check WiFi/Ethernet connection", safety_level: "recommendation_only", risk: "None" },
      { action: "Toggle WiFi off and back on", safety_level: "auto_safe", risk: "Brief network interruption" },
    );
  } else if (!s.network.dns_ok) {
    title = "DNS Resolution Failing";
    explanation = `Gateway is reachable but DNS queries are failing. Current DNS server: ${s.network.primary_dns}. This typically indicates a DNS server issue.`;
    severity = "critical";
    signals.push({ field: "network.dns_ok", value: "false", threshold: "true", note: "DNS queries failing" });
    remediations.push(
      { action: "Flush DNS cache", safety_level: "auto_safe", command_hint: s.os === "macos" ? "sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder" : "ipconfig /flushdns", risk: "None — cache rebuilds automatically" },
      { action: "Try alternate DNS (8.8.8.8 or 1.1.1.1)", safety_level: "approval_required", risk: "Changes DNS resolution path" },
    );
  } else if (!s.network.internet_reachable) {
    title = "Internet Unreachable";
    explanation = "Local network and DNS are working but internet is not reachable. This may indicate a firewall, proxy, or upstream provider issue.";
    signals.push({ field: "network.internet_reachable", value: "false", threshold: "true", note: "Cannot reach external hosts" });
    remediations.push({ action: "Check firewall and proxy settings. Contact IT if on corporate network.", safety_level: "recommendation_only", risk: "None" });
  }

  return {
    issue_class: "network_dns",
    severity,
    confidence: 0.97,
    title,
    explanation,
    contributing_signals: signals,
    remediations,
    post_verification: "Re-run network checks: gateway ping, DNS resolution, HTTP connectivity test.",
  };
}

function detectCrashStorm(s: EndpointSnapshot): Diagnosis | null {
  if (s.crashes.count_24h < 3) return null;

  const appCounts: Record<string, number> = {};
  s.crashes.recent_apps.forEach(app => { appCounts[app] = (appCounts[app] || 0) + 1; });
  const topCrasher = Object.entries(appCounts).sort((a, b) => b[1] - a[1])[0];

  const signals: Signal[] = [
    { field: "crashes.count_24h", value: `${s.crashes.count_24h}`, threshold: "< 3", note: "Abnormally high crash frequency" },
  ];
  if (topCrasher) {
    signals.push({ field: "crashes.top_app", value: `${topCrasher[0]} (${topCrasher[1]}x)`, threshold: "0", note: "Repeatedly crashing application" });
  }

  return {
    issue_class: "app_crash",
    severity: s.crashes.count_24h > 5 ? "critical" : "warning",
    confidence: 0.9,
    title: topCrasher ? `${topCrasher[0]} crashing repeatedly (${topCrasher[1]}x in 24h)` : `${s.crashes.count_24h} app crashes in 24 hours`,
    explanation: topCrasher
      ? `${topCrasher[0]} has crashed ${topCrasher[1]} times in the last 24 hours. This may indicate a corrupt installation, incompatible plugin, or insufficient resources.`
      : `${s.crashes.count_24h} application crashes detected in the last 24 hours across multiple apps.`,
    contributing_signals: signals,
    remediations: [
      ...(topCrasher ? [{ action: `Reinstall or update ${topCrasher[0]}`, safety_level: "recommendation_only" as const, risk: "May need to reconfigure application settings" }] : []),
      { action: "Check for OS updates that may fix compatibility issues", safety_level: "approval_required", risk: "Updates may require restart" },
    ],
    post_verification: "Monitor crashes.count_24h over the next 24 hours.",
  };
}

function detectStartupSlow(s: EndpointSnapshot): Diagnosis | null {
  if ((s.startup.boot_time_sec ?? 0) < 60 && s.startup.items_count < 15) return null;

  const signals: Signal[] = [];
  if ((s.startup.boot_time_sec ?? 0) >= 60) {
    signals.push({ field: "startup.boot_time_sec", value: `${s.startup.boot_time_sec}s`, threshold: "< 60s", note: "Slow boot/login" });
  }
  if (s.startup.items_count >= 15) {
    signals.push({ field: "startup.items_count", value: `${s.startup.items_count}`, threshold: "< 15", note: "Excessive startup items" });
  }

  return {
    issue_class: "startup_slow",
    severity: (s.startup.boot_time_sec ?? 0) > 120 ? "warning" : "info",
    confidence: 0.85,
    title: `Slow Startup: ${s.startup.boot_time_sec}s boot, ${s.startup.items_count} startup items`,
    explanation: `Boot time is ${s.startup.boot_time_sec} seconds with ${s.startup.items_count} startup items. Reducing login items can significantly improve boot performance.`,
    contributing_signals: signals,
    remediations: [
      { action: "Review and disable unnecessary startup items", safety_level: "approval_required", command_hint: s.os === "macos" ? "System Settings → General → Login Items" : "Task Manager → Startup tab", risk: "Some disabled items may need to be re-enabled if needed" },
    ],
    post_verification: "Measure boot_time_sec on next restart.",
  };
}

function detectServiceIssue(s: EndpointSnapshot): Diagnosis | null {
  const down = s.services.find(svc => !svc.running);
  const looping = s.services.find(svc => svc.restart_count_1h > 3);
  if (!down && !looping) return null;

  const target = looping || down!;
  const signals: Signal[] = [
    { field: `services.${target.name}.running`, value: `${target.running}`, threshold: "true", note: looping ? `Restart loop: ${target.restart_count_1h} restarts/hour` : "Service stopped" },
  ];

  return {
    issue_class: "service_loop",
    severity: looping ? "warning" : "info",
    confidence: 0.93,
    title: looping ? `Service restart loop: ${target.name}` : `Service stopped: ${target.name}`,
    explanation: looping
      ? `${target.name} has restarted ${target.restart_count_1h} times in the last hour (exit code: ${target.exit_code ?? "unknown"}). This indicates a persistent failure.`
      : `${target.name} is not running but is expected to be active.`,
    contributing_signals: signals,
    remediations: looping
      ? [{ action: `Investigate ${target.name} logs for root cause. Do not keep restarting.`, safety_level: "recommendation_only", risk: "None" }]
      : [{ action: `Restart ${target.name}`, safety_level: "auto_safe", command_hint: s.os === "macos" ? `launchctl kickstart -k system/${target.name}` : `Restart-Service ${target.name}`, risk: "Brief service interruption" }],
    post_verification: `Verify ${target.name} status = running after 30 seconds.`,
  };
}

function detectUpdateIssue(s: EndpointSnapshot): Diagnosis | null {
  const daysSinceUpdate = s.updates.last_update
    ? (Date.now() - new Date(s.updates.last_update).getTime()) / 86400000
    : Infinity;
  if (s.updates.pending_count < 3 && daysSinceUpdate < 14) return null;

  const signals: Signal[] = [];
  if (s.updates.pending_count >= 3) {
    signals.push({ field: "updates.pending_count", value: `${s.updates.pending_count}`, threshold: "< 3", note: "Multiple pending updates" });
  }
  if (daysSinceUpdate >= 14) {
    signals.push({ field: "updates.last_update", value: `${Math.round(daysSinceUpdate)} days ago`, threshold: "< 14 days", note: "Stale update status" });
  }

  return {
    issue_class: "update_issue",
    severity: daysSinceUpdate > 30 ? "warning" : "info",
    confidence: 0.88,
    title: `${s.updates.pending_count} pending updates (last updated ${Math.round(daysSinceUpdate)} days ago)`,
    explanation: `There are ${s.updates.pending_count} pending system updates. The last successful update was ${Math.round(daysSinceUpdate)} days ago. Keeping the system updated is important for security and stability.`,
    contributing_signals: signals,
    remediations: [
      { action: "Apply pending system updates", safety_level: "approval_required", command_hint: s.os === "macos" ? "softwareupdate -ia" : "Start-Process ms-settings:windowsupdate", risk: "May require restart. Some updates may change system behavior." },
    ],
    post_verification: "Re-check updates.pending_count after applying updates.",
  };
}

function detectThermalBattery(s: EndpointSnapshot): Diagnosis | null {
  const tempHigh = (s.cpu.temp_celsius ?? 0) > 90;
  const throttling = s.battery.thermal_throttle;
  const batteryDegraded = (s.battery.health_pct ?? 100) < 80;

  if (!tempHigh && !throttling && !batteryDegraded) return null;

  const signals: Signal[] = [];
  const remediations: Remediation[] = [];

  if (tempHigh) {
    signals.push({ field: "cpu.temp_celsius", value: `${s.cpu.temp_celsius}°C`, threshold: "< 85°C", note: "CPU temperature dangerously high" });
  }
  if (throttling) {
    signals.push({ field: "battery.thermal_throttle", value: "active", threshold: "off", note: "System is throttling to reduce heat" });
  }
  if (batteryDegraded) {
    signals.push({ field: "battery.health_pct", value: `${s.battery.health_pct}%`, threshold: "> 80%", note: `Battery cycle count: ${s.battery.cycle_count ?? "unknown"}` });
  }

  if (tempHigh || throttling) {
    remediations.push(
      { action: "Close resource-intensive applications to reduce heat", safety_level: "recommendation_only", risk: "None" },
      { action: "Ensure adequate ventilation — remove from soft surfaces", safety_level: "recommendation_only", risk: "None" },
    );
  }
  if (batteryDegraded) {
    remediations.push({ action: "Battery service recommended — health below 80%", safety_level: "recommendation_only", risk: "Requires hardware service appointment" });
  }

  return {
    issue_class: "battery_thermal",
    severity: throttling || (s.cpu.temp_celsius ?? 0) > 95 ? "critical" : "warning",
    confidence: 0.91,
    title: throttling ? "Thermal Throttling Active" : batteryDegraded ? `Battery Degraded: ${s.battery.health_pct}% health` : `High CPU Temperature: ${s.cpu.temp_celsius}°C`,
    explanation: throttling
      ? `System is actively throttling CPU performance due to high temperature (${s.cpu.temp_celsius}°C). This reduces performance to prevent hardware damage.`
      : batteryDegraded
        ? `Battery health is at ${s.battery.health_pct}% with ${s.battery.cycle_count} charge cycles. Performance may be affected and battery life is reduced.`
        : `CPU temperature is ${s.cpu.temp_celsius}°C, approaching thermal limits.`,
    contributing_signals: signals,
    remediations,
    post_verification: "Monitor cpu.temp_celsius and thermal_throttle status over the next 10 minutes.",
  };
}

function detectDiskIo(s: EndpointSnapshot): Diagnosis | null {
  // Disk I/O signals aren't in our basic snapshot, but detect via process correlation
  const diskHeavy = s.top_processes.filter(p => p.cpu_pct > 20 && p.name.match(/backup|TimeMachine|Spotlight|mds|fsck|diskutil/i));
  if (diskHeavy.length === 0) return null;

  return {
    issue_class: "disk_io",
    severity: "info",
    confidence: 0.7,
    title: `Disk-intensive process detected: ${diskHeavy[0].name}`,
    explanation: `${diskHeavy[0].name} is using significant CPU (${diskHeavy[0].cpu_pct}%), which often correlates with heavy disk I/O. This may cause system-wide slowness.`,
    contributing_signals: [
      { field: "process.name", value: diskHeavy[0].name, threshold: "N/A", note: "Known disk-intensive process" },
    ],
    remediations: [
      { action: "Wait for the disk-intensive operation to complete", safety_level: "recommendation_only", risk: "Interrupting may cause data corruption" },
    ],
    post_verification: "Check if the disk-intensive process has completed.",
  };
}

// ─── Main engine ───

export function runLocalDiagnosis(snapshot: EndpointSnapshot): DiagnosisResult {
  const detectors = [
    detectHighCpu,
    detectHighMemory,
    detectLowDisk,
    detectNetworkDns,
    detectCrashStorm,
    detectThermalBattery,
    detectStartupSlow,
    detectServiceIssue,
    detectUpdateIssue,
    detectDiskIo,
  ];

  const diagnoses: Diagnosis[] = [];
  for (const detector of detectors) {
    const result = detector(snapshot);
    if (result) diagnoses.push(result);
  }

  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  diagnoses.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const hasCritical = diagnoses.some(d => d.severity === "critical");
  const hasWarning = diagnoses.some(d => d.severity === "warning");
  const overall_health = hasCritical ? "critical" : hasWarning ? "degraded" : diagnoses.length > 0 ? "degraded" : "healthy";

  const summaryParts = diagnoses.map(d => d.title);
  const summary = diagnoses.length === 0
    ? "All endpoint signals are within normal range. No issues detected."
    : `Detected ${diagnoses.length} issue${diagnoses.length > 1 ? "s" : ""}: ${summaryParts.join("; ")}.`;

  const priority_action = diagnoses.length > 0
    ? diagnoses[0].remediations[0]?.action || "Review the top diagnosis for recommended actions."
    : "No action needed — endpoint is healthy.";

  return {
    diagnoses,
    overall_health: overall_health as DiagnosisResult["overall_health"],
    summary,
    priority_action,
  };
}
