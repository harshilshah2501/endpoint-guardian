export interface SafetyAction {
  action: string;
  category: "auto-safe" | "approval" | "recommendation" | "never";
  description: string;
  macPrivilege: string;
  winPrivilege: string;
  rollbackPossible: "yes" | "partial" | "no";
  rollbackStrategy: string;
}

export const safetyActions: SafetyAction[] = [
  {
    action: "Kill user process",
    category: "auto-safe",
    description: "Terminate a runaway user-owned process",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "no",
    rollbackStrategy: "User relaunches app",
  },
  {
    action: "Clear user caches",
    category: "auto-safe",
    description: "Remove browser and system caches to free space",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "partial",
    rollbackStrategy: "Cache rebuilds naturally",
  },
  {
    action: "Empty trash",
    category: "auto-safe",
    description: "Permanently delete items in trash/recycle bin",
    macPrivilege: "User",
    winPrivilege: "User",
    rollbackPossible: "no",
    rollbackStrategy: "Irreversible — require confirmation",
  },
  {
    action: "Flush DNS cache",
    category: "auto-safe",
    description: "Clear local DNS resolver cache",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "DNS cache rebuilds automatically",
  },
  {
    action: "Renew DHCP lease",
    category: "auto-safe",
    description: "Release and renew network IP assignment",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Network reconfigures automatically",
  },
  {
    action: "Restart service",
    category: "approval",
    description: "Stop and restart a system service or agent",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Stop service to revert",
  },
  {
    action: "Kill system process",
    category: "approval",
    description: "Terminate a system-owned process",
    macPrivilege: "Root (sudo)",
    winPrivilege: "Admin",
    rollbackPossible: "no",
    rollbackStrategy: "Service manager may auto-restart",
  },
  {
    action: "Disable startup item",
    category: "approval",
    description: "Remove an application from login/startup sequence",
    macPrivilege: "User / Root",
    winPrivilege: "Admin",
    rollbackPossible: "yes",
    rollbackStrategy: "Re-enable the item",
  },
  {
    action: "Apply OS updates",
    category: "approval",
    description: "Install pending system or app updates",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "partial",
    rollbackStrategy: "OS rollback / restore point",
  },
  {
    action: "Reinstall application",
    category: "recommendation",
    description: "Remove and reinstall a crashing application",
    macPrivilege: "User / Root",
    winPrivilege: "Admin",
    rollbackPossible: "partial",
    rollbackStrategy: "Reinstall previous version",
  },
  {
    action: "Rollback update",
    category: "recommendation",
    description: "Revert a recently applied system update",
    macPrivilege: "Root",
    winPrivilege: "Admin",
    rollbackPossible: "partial",
    rollbackStrategy: "OS restore point",
  },
  {
    action: "Replace battery",
    category: "recommendation",
    description: "Hardware service recommendation for degraded battery",
    macPrivilege: "N/A",
    winPrivilege: "N/A",
    rollbackPossible: "no",
    rollbackStrategy: "N/A — hardware action",
  },
  {
    action: "Delete user files",
    category: "never",
    description: "Remove documents, photos, or source code",
    macPrivilege: "Blocked",
    winPrivilege: "Blocked",
    rollbackPossible: "no",
    rollbackStrategy: "Explicitly blocked in code",
  },
  {
    action: "Modify registry hives",
    category: "never",
    description: "Direct edits to Windows registry system hives",
    macPrivilege: "N/A",
    winPrivilege: "Blocked",
    rollbackPossible: "no",
    rollbackStrategy: "Explicitly blocked in code",
  },
  {
    action: "Disable SIP / security features",
    category: "never",
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
  "Agent diagnoses issue",
  "Agent proposes remediation with safety level",
  "If approval_required: show prompt with explanation",
  "User accepts or declines",
  "Agent executes only if accepted",
  "Full audit trail logged regardless",
];

export const escalationPath = [
  "Auto-fix (if safe) → success? done.",
  "Auto-fix failed → prompt user with manual steps",
  "User remediation failed → recommend IT contact",
  "Recurring issue (3x in 7 days) → flag for IT review",
];
