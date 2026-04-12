# Top 20 Covered Scenarios

This list captures what the current system can diagnose today, with exact signal pathways based on the implemented detectors and model pipeline.

## Legend
- `Rules`: deterministic detector in `runLocalDiagnosis`.
- `Anomaly`: local ONNX anomaly classifier (`anomaly_clf.onnx`).
- `Causal`: local ONNX causal ranker (`causal_ranker.onnx`, deep mode).
- `Remediation ML`: local ONNX action ranking (`remediation_selector.onnx`, deep mode).
- `Cloud Deep`: optional Supabase deep analysis (`diagnose-deep`).

| # | Scenario | Primary Signals | Detection Path | Typical Output |
|---|---|---|---|---|
| 1 | Runaway user CPU process | `cpu.usage_avg_5m`, top process CPU | Rules + Anomaly | high_cpu diagnosis, process-targeted basic action |
| 2 | System process CPU pressure | high CPU on non-user process | Rules + Anomaly | diagnostic investigation path |
| 3 | Indexing-related CPU spike | `mds/mdworker` patterns | Rules + Anomaly | benign/expected spike explanation |
| 4 | Critical memory pressure | memory pressure state, available RAM | Rules + Anomaly | high_memory warning/critical card |
| 5 | Heavy swap thrashing | `swap_usage_mb`, low available memory | Rules + Anomaly | close/restart memory hog recommendations |
| 6 | Low disk free space (<10%) | `disk.free_pct`, `disk.free_gb` | Rules + Anomaly | low_disk actions (cache/trash/cleanup) |
| 7 | Critical disk exhaustion (<5%) | very low `disk.free_pct` | Rules + Anomaly | critical low_disk with urgent remediation |
| 8 | DNS resolution failure | `network.dns_ok = false` | Rules + Anomaly | DNS-specific remediation chain |
| 9 | Gateway unreachable | `network.gateway_reachable = false` | Rules + Anomaly | local connectivity failure diagnosis |
| 10 | Internet unreachable (DNS OK) | `internet_reachable = false` | Rules + Anomaly | upstream/firewall/proxy diagnostic path |
| 11 | App crash storm (single app) | `crashes.count_24h`, per-app repeats | Rules + Anomaly | app_crash with repeated offender details |
| 12 | Multi-app crash instability | high aggregate crash count | Rules + Anomaly | crash instability recommendations |
| 13 | Thermal throttling active | `battery.thermal_throttle`, CPU temp | Rules + Anomaly + Causal | battery_thermal critical degradation path |
| 14 | CPU thermal spike without throttle | high `cpu.temp_celsius` | Rules + Anomaly + Causal | warning/critical thermal advice |
| 15 | Battery health degradation | `battery.health_pct < 80` | Rules + Anomaly | battery service recommendation |
| 16 | Slow startup from login load | `startup.items_count`, `boot_time_sec` | Rules + Anomaly | startup_slow with disable-startup guidance |
| 17 | Service stopped unexpectedly | service `running=false` | Rules + Anomaly | service_loop stopped-service recovery action |
| 18 | Service restart loop | restart count > threshold | Rules + Anomaly + Causal | loop diagnosis, no blind restart looping |
| 19 | Update staleness / backlog | pending updates + age | Rules + Anomaly | update_issue risk reduction recommendations |
| 20 | Cross-signal cascade incident | CPU + memory + thermal/disk/network combos | Rules + Anomaly + Causal + Remediation ML (+Cloud Deep optional) | enriched summary with causal edges and ranked actions |

## Notes On Precision

- The rules engine currently runs 10 detector families: `high_cpu`, `high_memory`, `low_disk`, `network_dns`, `app_crash`, `battery_thermal`, `startup_slow`, `service_loop`, `update_issue`, `disk_io`.
- The 20 scenarios above are concrete operational manifestations of these detector families plus deep-mode correlation/ranking behavior.
- `disk_io` today is process-pattern based (known disk-heavy process names) rather than SMART/queue-depth telemetry.

