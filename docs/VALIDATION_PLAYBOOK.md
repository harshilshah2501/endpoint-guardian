# Scenario Validation Playbook

This playbook gives reproducible checks you can run to validate behavior before demos, releases, and support handoff.

## How To Use This Playbook

1. Start app in web mode or desktop mode.
2. Select scenario source (built-in or custom JSON).
3. Run Quick Diagnosis and verify expected baseline outputs.
4. Run Deep Analysis and verify enrichment outputs.
5. Record pass/fail and attach screenshot of summary + top issue card.

## Expected Output Contract

For each scenario below, validate at minimum:
- overall health classification
- presence of expected issue class(es)
- first priority action category (diagnostic/basic/advanced)
- deep-mode enrichment behavior

## Built-In Scenario Checks

| Scenario | Source | Quick Expected | Deep Expected |
|---|---|---|---|
| Healthy Endpoint | built-in | overall health healthy; zero diagnoses | may stay healthy; no false critical escalation |
| High CPU - Runaway Process | built-in | issue class includes high_cpu; warning/critical; top action often basic process termination | anomaly panel visible; possible causal links if other signals elevated |
| Memory Crisis | built-in | issue class includes high_memory; likely critical; memory-focused remediations | anomaly confidence and scoring visible; deep summary enrichment |
| Low Disk Space | built-in | issue class includes low_disk; warning/critical | same plus ranked actions (deep models loaded) |
| DNS / Network Failure | built-in | issue class includes network_dns; DNS-specific remediation chain | same plus causal/ranked action enrichment when available |
| App Crash Storm | built-in | issue class includes app_crash; repeated app offender in title/explanation | anomaly/ranked actions may elevate ordering |
| Multi-Issue Cascade | built-in | multiple issue classes expected (commonly high_cpu, high_memory, low_disk, battery_thermal) | strongest deep-mode demonstration: causal edges + ranked actions |
| Thermal Throttling | built-in | issue class includes battery_thermal; warning/critical | causal chain likely shows CPU/thermal interactions |

## Custom JSON Scenarios For Deterministic Regression

Use Custom JSON to cover paths not represented by built-in scenario buttons.

### 1) Service Restart Loop

Expected:
- includes issue class service_loop
- severity warning or info depending on restart count and running status
- top action diagnostic (investigate logs), not repeated blind restart

```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "hostname": "qa-host",
  "os": "macos",
  "os_version": "15.3",
  "agent_version": "0.1.0",
  "cpu": { "usage_avg_1m": 22, "usage_avg_5m": 20, "core_count": 8, "temp_celsius": 54 },
  "memory": { "total_mb": 16384, "available_mb": 6400, "pressure": "normal", "swap_usage_mb": 100 },
  "disk": { "free_pct": 42, "free_gb": 101, "total_gb": 239 },
  "top_processes": [],
  "network": { "dns_ok": true, "gateway_reachable": true, "internet_reachable": true, "primary_dns": "8.8.8.8" },
  "services": [{ "name": "endpoint-agent", "running": true, "restart_count_1h": 6, "exit_code": 1 }],
  "crashes": { "count_24h": 0, "recent_apps": [] },
  "updates": { "pending_count": 0, "last_update": "2026-04-07T10:00:00.000Z" },
  "startup": { "items_count": 8, "boot_time_sec": 25 },
  "battery": { "health_pct": 92, "cycle_count": 300, "thermal_throttle": false }
}
```

### 2) Startup Slowdown

Expected:
- includes issue class startup_slow
- top action basic tier for startup item reduction

```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "hostname": "qa-host",
  "os": "windows",
  "os_version": "11",
  "agent_version": "0.1.0",
  "cpu": { "usage_avg_1m": 18, "usage_avg_5m": 15, "core_count": 8, "temp_celsius": null },
  "memory": { "total_mb": 16384, "available_mb": 7600, "pressure": "normal", "swap_usage_mb": 0 },
  "disk": { "free_pct": 35, "free_gb": 180, "total_gb": 512 },
  "top_processes": [],
  "network": { "dns_ok": true, "gateway_reachable": true, "internet_reachable": true, "primary_dns": "1.1.1.1" },
  "services": [{ "name": "endpoint-agent", "running": true, "restart_count_1h": 0, "exit_code": null }],
  "crashes": { "count_24h": 0, "recent_apps": [] },
  "updates": { "pending_count": 0, "last_update": "2026-04-10T10:00:00.000Z" },
  "startup": { "items_count": 24, "boot_time_sec": 165 },
  "battery": { "health_pct": 90, "cycle_count": 120, "thermal_throttle": false }
}
```

### 3) Update Staleness / Backlog

Expected:
- includes issue class update_issue
- action suggests applying updates (basic)

```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "hostname": "qa-host",
  "os": "linux",
  "os_version": "6.8",
  "agent_version": "0.1.0",
  "cpu": { "usage_avg_1m": 10, "usage_avg_5m": 8, "core_count": 8, "temp_celsius": 48 },
  "memory": { "total_mb": 16384, "available_mb": 9000, "pressure": "normal", "swap_usage_mb": 0 },
  "disk": { "free_pct": 44, "free_gb": 220, "total_gb": 512 },
  "top_processes": [],
  "network": { "dns_ok": true, "gateway_reachable": true, "internet_reachable": true, "primary_dns": "9.9.9.9" },
  "services": [{ "name": "endpoint-agent", "running": true, "restart_count_1h": 0, "exit_code": null }],
  "crashes": { "count_24h": 0, "recent_apps": [] },
  "updates": { "pending_count": 7, "last_update": "2026-02-25T10:00:00.000Z" },
  "startup": { "items_count": 5, "boot_time_sec": 20 },
  "battery": { "health_pct": 95, "cycle_count": 40, "thermal_throttle": false }
}
```

### 4) Gateway Unreachable Network Failure

Expected:
- includes issue class network_dns
- title indicates local network unreachable
- tier includes advanced toggle-WiFi style remediation

```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "hostname": "qa-host",
  "os": "macos",
  "os_version": "15.3",
  "agent_version": "0.1.0",
  "cpu": { "usage_avg_1m": 9, "usage_avg_5m": 7, "core_count": 8, "temp_celsius": 47 },
  "memory": { "total_mb": 16384, "available_mb": 10000, "pressure": "normal", "swap_usage_mb": 0 },
  "disk": { "free_pct": 55, "free_gb": 132, "total_gb": 239 },
  "top_processes": [],
  "network": { "dns_ok": false, "gateway_reachable": false, "internet_reachable": false, "primary_dns": "8.8.8.8" },
  "services": [{ "name": "endpoint-agent", "running": true, "restart_count_1h": 0, "exit_code": null }],
  "crashes": { "count_24h": 0, "recent_apps": [] },
  "updates": { "pending_count": 0, "last_update": "2026-04-10T10:00:00.000Z" },
  "startup": { "items_count": 8, "boot_time_sec": 25 },
  "battery": { "health_pct": 92, "cycle_count": 300, "thermal_throttle": false }
}
```

### 5) Disk-Intensive Process Pattern

Expected:
- includes issue class disk_io
- info-severity diagnosis referencing process name pattern

```json
{
  "timestamp": "2026-04-12T10:00:00.000Z",
  "hostname": "qa-host",
  "os": "macos",
  "os_version": "15.3",
  "agent_version": "0.1.0",
  "cpu": { "usage_avg_1m": 31, "usage_avg_5m": 27, "core_count": 8, "temp_celsius": 62 },
  "memory": { "total_mb": 16384, "available_mb": 7500, "pressure": "normal", "swap_usage_mb": 200 },
  "disk": { "free_pct": 35, "free_gb": 84, "total_gb": 239 },
  "top_processes": [
    { "pid": 777, "name": "mds", "cpu_pct": 26, "rss_mb": 300, "is_user": false, "runtime_sec": 1600 }
  ],
  "network": { "dns_ok": true, "gateway_reachable": true, "internet_reachable": true, "primary_dns": "8.8.8.8" },
  "services": [{ "name": "endpoint-agent", "running": true, "restart_count_1h": 0, "exit_code": null }],
  "crashes": { "count_24h": 0, "recent_apps": [] },
  "updates": { "pending_count": 0, "last_update": "2026-04-10T10:00:00.000Z" },
  "startup": { "items_count": 8, "boot_time_sec": 25 },
  "battery": { "health_pct": 92, "cycle_count": 300, "thermal_throttle": false }
}
```

## Pass Criteria

A scenario is considered pass when:
- expected issue class appears
- expected severity band appears (exact value or stricter)
- priority action aligns with expected remediation type
- deep mode produces additive context and does not remove baseline rule findings

