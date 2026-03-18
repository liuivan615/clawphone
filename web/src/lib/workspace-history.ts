export interface WorkspaceHistoryEntry {
  workspace: string;
  lastOpenedAt: number;
  lastSessionId?: string;
  lastTitle?: string;
}

const HISTORY_KEY = "clawphone_workspace_history";
const LEGACY_KEY = "clawphone_recent_dirs";
const MAX_ENTRIES = 10;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeEntry(value: unknown): WorkspaceHistoryEntry | null {
  if (!isObject(value) || typeof value.workspace !== "string" || !value.workspace.trim()) {
    return null;
  }

  const lastOpenedAt =
    typeof value.lastOpenedAt === "number" && Number.isFinite(value.lastOpenedAt)
      ? value.lastOpenedAt
      : Date.now();

  return {
    workspace: value.workspace,
    lastOpenedAt,
    lastSessionId: typeof value.lastSessionId === "string" ? value.lastSessionId : undefined,
    lastTitle: typeof value.lastTitle === "string" ? value.lastTitle : undefined,
  };
}

function dedupeAndSort(entries: WorkspaceHistoryEntry[]): WorkspaceHistoryEntry[] {
  const byWorkspace = new Map<string, WorkspaceHistoryEntry>();

  for (const entry of entries) {
    const existing = byWorkspace.get(entry.workspace);
    if (!existing || existing.lastOpenedAt < entry.lastOpenedAt) {
      byWorkspace.set(entry.workspace, entry);
    }
  }

  return Array.from(byWorkspace.values())
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)
    .slice(0, MAX_ENTRIES);
}

export function mergeWorkspaceHistory(
  entries: WorkspaceHistoryEntry[],
  update: WorkspaceHistoryEntry
): WorkspaceHistoryEntry[] {
  const existing = entries.find((entry) => entry.workspace === update.workspace);

  return dedupeAndSort([
    {
      workspace: update.workspace,
      lastOpenedAt: update.lastOpenedAt,
      lastSessionId: update.lastSessionId ?? existing?.lastSessionId,
      lastTitle: update.lastTitle ?? existing?.lastTitle,
    },
    ...entries,
  ]);
}

export function persistWorkspaceHistory(entries: WorkspaceHistoryEntry[]): void {
  const normalized = dedupeAndSort(entries);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(normalized));
  localStorage.setItem(
    LEGACY_KEY,
    JSON.stringify(normalized.map((entry) => entry.workspace))
  );
}

export function loadWorkspaceHistory(): WorkspaceHistoryEntry[] {
  const raw = localStorage.getItem(HISTORY_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown[];
      const normalized = dedupeAndSort(parsed.map(normalizeEntry).filter((entry): entry is WorkspaceHistoryEntry => Boolean(entry)));
      persistWorkspaceHistory(normalized);
      return normalized;
    } catch {
      // Fall through to legacy migration below.
    }
  }

  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "[]") as unknown[];
    const now = Date.now();
    const migrated = dedupeAndSort(
      legacy
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        .map((workspace, index) => ({
          workspace,
          lastOpenedAt: now - index,
        }))
    );
    persistWorkspaceHistory(migrated);
    return migrated;
  } catch {
    return [];
  }
}
