export interface ProcessInfo {
  pid: number;
  name: string;
  cpu_pct: number;
  rss_mb: number;
  is_user: boolean;
  runtime_sec: number;
}

export interface ServiceStatus {
  name: string;
  running: boolean;
  restart_count_1h: number;
  exit_code: number | null;
}

export interface EndpointSnapshot {
  timestamp: string;
  hostname: string;
  os: "macos" | "windows" | "linux";
  os_version: string;
  agent_version: string;
  cpu: {
    usage_avg_1m: number;
    usage_avg_5m: number;
    core_count: number;
    temp_celsius: number | null;
  };
  memory: {
    total_mb: number;
    available_mb: number;
    pressure: "normal" | "warning" | "critical";
    swap_usage_mb: number;
  };
  disk: {
    free_pct: number;
    free_gb: number;
    total_gb: number;
  };
  top_processes: ProcessInfo[];
  network: {
    dns_ok: boolean;
    gateway_reachable: boolean;
    internet_reachable: boolean;
    primary_dns: string;
  };
  services: ServiceStatus[];
  crashes: {
    count_24h: number;
    recent_apps: string[];
  };
  updates: {
    pending_count: number;
    last_update: string;
  };
  startup: {
    items_count: number;
    boot_time_sec: number | null;
  };
  battery: {
    health_pct: number | null;
    cycle_count: number | null;
    thermal_throttle: boolean;
  };
}

export type ActionTier = "diagnostic" | "basic" | "advanced";

export interface Remediation {
  action: string;
  tier: ActionTier;
  command_hint?: string;
  risk: string;
  pre_check?: string;
  post_check?: string;
  rollback?: string;
}

export interface DiagnosisResult {
  diagnoses: {
    issue_class: string;
    severity: "critical" | "warning" | "info";
    confidence: number;
    title: string;
    explanation: string;
    contributing_signals: {
      field: string;
      value: string;
      threshold: string;
      note: string;
    }[];
    remediations: Remediation[];
    post_verification: string;
  }[];
  overall_health: "healthy" | "degraded" | "critical" | "unknown";
  summary: string;
  priority_action: string;
}
