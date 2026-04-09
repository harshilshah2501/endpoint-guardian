export interface SafetyAction {
  action: string;
  tier: "diagnostic" | "basic" | "advanced" | "never";
  description: string;
  macPrivilege: string;
  winPrivilege: string;
  rollbackPossible: "yes" | "partial" | "no";
  rollbackStrategy: string;
  preCheck?: string;
  postCheck?: string;
}

export const safetyActions: SafetyAction[] = [
  // ─── DIAGNOSTIC TIER: Read-only, investigation & debug ───
  {
    action: "Inspect crash logs",
    tier: "diagnostic",
    description: "Read and analyze crash report signatures for pattern matching",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "yes",
    rollbackStrategy: "Read-only — no changes made",
    preCheck: "Locate crash log directory",
    postCheck: "Verify log signatures extracted",
  },
  {
    action: "Check process tree",
    tier: "diagnostic",
    description: "List running processes with CPU, memory, and runtime data",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "yes",
    rollbackStrategy: "Read-only — no changes made",
  },
  {
    action: "Test network connectivity",
    tier: "diagnostic",
    description: "Sequential ping: gateway → DNS → internet to isolate failure",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "yes",
    rollbackStrategy: "Read-only — no changes made",
  },
  {
    action: "Inspect disk SMART status",
    tier: "diagnostic",
    description: "Read disk health indicators for hardware degradation",
    macPrivilege: "User",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Read-only — no changes made",
  },
  {
    action: "Recommend battery service",
    tier: "diagnostic",
    description: "Inform user about battery degradation — no system changes",
    macPrivilege: "N/A",
    winPrivilege: "N/A",
    rollbackPossible: "yes",
    rollbackStrategy: "Informational only",
  },

  // ─── BASIC TIER: Requires human confirmation ───
  {
    action: "Kill user process",
    tier: "basic",
    description: "Terminate a runaway user-owned process after user confirms",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "no",
    rollbackStrategy: "User relaunches app",
    preCheck: "Verify process is still running and consuming high resources",
    postCheck: "Confirm CPU/memory usage decreased",
  },
  {
    action: "Kill system process",
    tier: "basic",
    description: "Terminate a system-owned process with user approval",
    macPrivilege: "Root (sudo)",
    winPrivilege: "Admin",
    rollbackPossible: "no",
    rollbackStrategy: "Service manager may auto-restart",
    preCheck: "Verify process identity and impact",
    postCheck: "Check dependent services still operational",
  },
  {
    action: "Disable startup item",
    tier: "basic",
    description: "Remove an application from login/startup sequence",
    macPrivilege: "User / Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Re-enable the item",
    preCheck: "List startup item and its dependencies",
    postCheck: "Verify item removed from startup list",
  },
  {
    action: "Apply OS updates",
    tier: "basic",
    description: "Install pending system or app updates",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "partial",
    rollbackStrategy: "OS rollback / restore point",
    preCheck: "List pending updates and their criticality",
    postCheck: "Verify updates installed successfully",
  },
  {
    action: "Change DNS server",
    tier: "basic",
    description: "Switch to alternate DNS server (e.g. 8.8.8.8 or 1.1.1.1)",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Restore original DNS settings",
    preCheck: "Record current DNS configuration",
    postCheck: "Test DNS resolution with new server",
  },

  // ─── ADVANCED TIER: Autonomous, safe, no confirmation needed ───
  {
    action: "Clear user caches",
    tier: "advanced",
    description: "Remove browser and system caches to free space — auto-safe",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "partial",
    rollbackStrategy: "Cache rebuilds naturally",
    preCheck: "Estimate total cache size",
    postCheck: "Verify disk space increased",
  },
  {
    action: "Empty trash",
    tier: "advanced",
    description: "Permanently delete items already marked for deletion by user",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "no",
    rollbackStrategy: "Files already in trash — user intended deletion",
    preCheck: "List trash contents and total size",
    postCheck: "Verify disk space reclaimed",
  },
  {
    action: "Flush DNS cache",
    tier: "advanced",
    description: "Clear local DNS resolver cache — rebuilds automatically",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "DNS cache rebuilds automatically",
    preCheck: "Confirm DNS resolution is failing",
    postCheck: "Re-test DNS resolution",
  },
  {
    action: "Renew DHCP lease",
    tier: "advanced",
    description: "Release and renew network IP assignment",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Network reconfigures automatically",
    preCheck: "Check current IP lease status",
    postCheck: "Verify new IP assigned and connectivity restored",
  },
  {
    action: "Restart stopped service",
    tier: "advanced",
    description: "Restart a service that is expected to be running (max 2 retries)",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Stop service to revert",
    preCheck: "Verify service is expected to be running",
    postCheck: "Confirm service status = running after 30s",
  },
  {
    action: "Toggle WiFi",
    tier: "advanced",
    description: "Turn WiFi off and back on to reset connection — brief interruption",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "yes",
    rollbackStrategy: "WiFi can be toggled back on",
    preCheck: "Check if WiFi adapter is present",
    postCheck: "Verify network connectivity restored",
  },

  // ─── NEVER: Explicitly blocked ───
  {
    action: "Delete user files",
    tier: "never",
    description: "Remove documents, photos, or source code",
    macPrivilege: "Blocked",
    winPrivilege: "Blocked",
    rollbackPossible: "no",
    rollbackStrategy: "Explicitly blocked in code",
  },
  {
    action: "Modify registry hives",
    tier: "never",
    description: "Direct edits to Windows registry system hives",
    macPrivilege: "N/A",
    winPrivilege: "Blocked",
    rollbackPossible: "no",
    rollbackStrategy: "Explicitly blocked in code",
  },
  {
    action: "Disable SIP / security features",
    tier: "never",
    description: "Disable System Integrity Protection or equivalent",
    macPrivilege: "Blocked",
    winPrivilege: "Blocked",
    rollbackPossible: "no",
    rollbackStrategy: "Explicitly blocked in code",
  },
];

export const protectedPaths = [
  "/System/ (macOS)",
  "C:\\Windows\\System32\\ (Windows)",
  "Kernel extensions / drivers",
  "FileVault / BitLocker configuration",
  "Firewall rules",
  "User documents, photos, source code",
  "Authentication configuration",
  "Disk partitioning",
];

export const consentFlow = [
  "Agent runs diagnostics (Tier 1 — always automatic)",
  "Agent identifies issues and proposes remediations",
  "Advanced actions (Tier 3) auto-execute with audit log + undo option",
  "Basic actions (Tier 2) show prompt: command, risk, rollback plan",
  "User approves or declines Basic actions",
  "Post-check verification runs after every action",
  "Full audit trail logged regardless of tier",
];

export const escalationPath = [
  "Tier 3 (Advanced) auto-fix → success? done.",
  "Tier 3 failed → escalate to Tier 2 (prompt user)",
  "Tier 2 (Basic) user remediation → success? done.",
  "Tier 2 failed → escalate to Tier 1 (Diagnostic — recommend IT contact)",
  "Recurring issue (3x in 7 days) → flag for IT review",
];
