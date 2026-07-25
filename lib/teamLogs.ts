export interface TeamLoginEntry {
  id: string;
  name: string;
  loginAt: string; // ISO timestamp
}

export interface TeamLoginLogs {
  entries: TeamLoginEntry[];
}

export const DEFAULT_TEAM_LOGS: TeamLoginLogs = { entries: [] };

// Keeps the log bounded automatically, so it never needs manual cleanup to
// stay a reasonable size - oldest entries drop off past this count.
export const MAX_LOG_ENTRIES = 1000;
