import { existsSync, readFileSync, readdirSync, statSync, type Dirent } from "fs";
import { join, resolve } from "path";
import type {
  HistoryContinuePayload,
  HistoryThreadItem,
  HistoryThreadSnapshot,
  HistoryThreadState,
  HistoryThreadSummary,
  HistoryWorkspaceSummary,
} from "../../shared/types.js";

interface SessionIndexEntry {
  id: string;
  threadName: string;
  updatedAt: number;
}

interface HistoryFallback {
  updatedAt: number;
  items: HistoryThreadItem[];
  preview: string;
}

interface ParsedRollout {
  id: string;
  workspace: string;
  updatedAt: number;
  createdAt?: string;
  title: string;
  preview: string;
  items: HistoryThreadItem[];
  meta: {
    source?: string;
    originator?: string;
    cliVersion?: string;
    modelProvider?: string;
  };
}

interface HistoryCache {
  loadedAt: number;
  cacheKey: string;
  threads: HistoryThreadSummary[];
  snapshots: Map<string, HistoryThreadSnapshot>;
  workspaces: HistoryWorkspaceSummary[];
}

interface PendingToolCall {
  name: string;
  command: string;
  cwd?: string;
  timestamp: number;
}

const CACHE_TTL_MS = 5000;
const MAX_HISTORY_MESSAGES = 12;
const MAX_PREVIEW_LENGTH = 140;
const MAX_SNIPPET_LENGTH = 800;
const THREAD_ID_RE = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

function defaultCodexHome(): string {
  if (process.env.CODEX_HOME?.trim()) {
    return resolve(process.env.CODEX_HOME);
  }

  const home = process.env.USERPROFILE || process.env.HOME;
  if (!home) {
    return resolve(".codex");
  }

  return resolve(home, ".codex");
}

function safeStat(path: string): { mtimeMs: number; size: number } | null {
  try {
    const stat = statSync(path);
    return { mtimeMs: stat.mtimeMs, size: stat.size };
  } catch {
    return null;
  }
}

function readJsonLines(path: string): Array<Record<string, unknown>> {
  if (!existsSync(path)) return [];

  const content = readFileSync(path, "utf-8");
  const lines = content.split(/\r?\n/);
  const records: Array<Record<string, unknown>> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      records.push(parsed);
    } catch {
      // Ignore malformed history lines.
    }
  }

  return records;
}

function truncateText(value: string, max = MAX_SNIPPET_LENGTH): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function toTimestampMs(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000_000_000 ? value : value * 1000;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return Date.now();
}

function toTimestampSeconds(value: number): number {
  return Math.max(0, Math.floor(value / 1000));
}

function getWorkspaceTitle(workspace: string): string {
  if (!workspace) return "未知工作区";
  const normalized = workspace.replace(/[\\/]+$/, "");
  const parts = normalized.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] || workspace;
}

function isRootWorkspace(workspace: string): boolean {
  return /^[A-Za-z]:\\?$/.test(workspace.trim());
}

function sortWorkspaceEntries<T extends { workspace: string; updatedAt: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (isRootWorkspace(a.workspace) !== isRootWorkspace(b.workspace)) {
      return isRootWorkspace(a.workspace) ? 1 : -1;
    }
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return a.workspace.localeCompare(b.workspace);
  });
}

function extractTextContent(chunks: unknown): string {
  if (!Array.isArray(chunks)) return "";

  const text = chunks
    .map((chunk) => {
      if (typeof chunk !== "object" || chunk === null) return "";
      const value = chunk as Record<string, unknown>;
      return typeof value.text === "string" ? value.text : "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();

  return text;
}

function extractShellCommand(args: string): { command: string; cwd?: string } {
  try {
    const parsed = JSON.parse(args) as Record<string, unknown>;
    return {
      command: typeof parsed.command === "string" ? parsed.command : "",
      cwd: typeof parsed.workdir === "string" ? parsed.workdir : undefined,
    };
  } catch {
    return { command: "" };
  }
}

function fallbackTitleFromItems(items: HistoryThreadItem[]): string {
  for (const item of items) {
    if (item.type === "user_message" && item.text.trim()) {
      return truncateText(item.text, 36);
    }
  }

  for (const item of items) {
    if (item.type === "agent_text" && item.content.trim()) {
      return truncateText(item.content, 36);
    }
  }

  return "未命名";
}

function buildPreview(items: HistoryThreadItem[]): string {
  for (const item of items) {
    if (item.type === "user_message" && item.text.trim()) {
      return truncateText(item.text, MAX_PREVIEW_LENGTH);
    }
    if (item.type === "agent_text" && item.content.trim()) {
      return truncateText(item.content, MAX_PREVIEW_LENGTH);
    }
  }

  return "";
}

function appendHistoryItem(items: HistoryThreadItem[], next: HistoryThreadItem) {
  const last = items[items.length - 1];

  if (
    last &&
    last.type === next.type &&
    ((last.type === "user_message" && next.type === "user_message" && last.text === next.text) ||
      (last.type === "agent_text" && next.type === "agent_text" && last.content === next.content) ||
      (last.type === "system" && next.type === "system" && last.content === next.content))
  ) {
    return;
  }

  items.push(next);
}

function trimContinuationHistory(items: HistoryThreadItem[]): HistoryThreadItem[] {
  const meaningful = items.filter((item) => {
    if (item.type === "system") return item.content.trim().length > 0;
    if (item.type === "reasoning") return (item.summary || item.content).trim().length > 0;
    if (item.type === "command_call") return item.output.trim().length > 0 || item.command.trim().length > 0;
    if (item.type === "file_change") return item.changes.length > 0;
    if (item.type === "task_update") return item.explanation.trim().length > 0;
    if (item.type === "user_message") return item.text.trim().length > 0;
    if (item.type === "agent_text") return item.content.trim().length > 0;
    return false;
  });

  return meaningful.slice(-MAX_HISTORY_MESSAGES);
}

export class CodexHistoryService {
  private readonly codexHome: string;
  private cache: HistoryCache | null = null;
  private readonly resumeOverrides = new Map<string, { state: HistoryThreadState; reason: string }>();
  private readonly rolloutCache = new Map<string, { mtimeMs: number; parsed: ParsedRollout | null }>();

  constructor(codexHome = defaultCodexHome()) {
    this.codexHome = codexHome;
  }

  getCodexHome(): string {
    return this.codexHome;
  }

  listWorkspaces(): HistoryWorkspaceSummary[] {
    return this.ensureCache().workspaces;
  }

  listThreads(opts: { workspace?: string; q?: string; limit?: number } = {}): HistoryThreadSummary[] {
    const workspace = opts.workspace?.trim();
    const q = opts.q?.trim().toLowerCase();
    const limit = Math.max(1, Math.min(500, opts.limit ?? 200));

    return this.ensureCache().threads
      .filter((thread) => {
        if (workspace && thread.workspace !== workspace) return false;
        if (!q) return true;

        const haystack = [thread.title, thread.preview, thread.workspace].join("\n").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, limit);
  }

  getThread(threadId: string): HistoryThreadSnapshot | null {
    return this.ensureCache().snapshots.get(threadId) || null;
  }

  createContinuePayload(threadId: string): HistoryContinuePayload | null {
    const thread = this.getThread(threadId);
    if (!thread || !thread.workspace) return null;

    const context = trimContinuationHistory(thread.items);
    const lines = context.map((item) => {
      switch (item.type) {
        case "user_message":
          return `- 用户: ${truncateText(item.text, 280)}`;
        case "agent_text":
          return `- 助手: ${truncateText(item.content, 280)}`;
        case "reasoning":
          return `- 推理摘要: ${truncateText(item.summary || item.content, 240)}`;
        case "command_call":
          return `- 工具输出 (${item.command || "shell_command"}): ${truncateText(item.output, 240)}`;
        case "file_change":
          return `- 文件修改: ${item.changes.map((change) => change.path).slice(0, 3).join(", ")}`;
        case "task_update":
          return `- 计划更新: ${truncateText(item.explanation, 240)}`;
        case "system":
          return `- 系统提示: ${truncateText(item.content, 220)}`;
        default:
          return "";
      }
    }).filter(Boolean);

    const prompt = [
      `你正在基于本机 Codex 历史快照继续一个线程。`,
      `这不是原线程的精确恢复，请把下面内容当作恢复摘要。`,
      "",
      `原标题: ${thread.title || "未命名线程"}`,
      `工作区: ${thread.workspace}`,
      thread.resumeReason ? `恢复状态: ${thread.resumeReason}` : "",
      "",
      `最近上下文:`,
      ...(lines.length > 0 ? lines : ["- 没有可用的历史消息快照。"]),
      "",
      `请先基于这些上下文继续原任务；如果关键信息缺失，请明确指出你缺少什么。`,
    ]
      .filter(Boolean)
      .join("\n");

    return {
      threadId,
      title: thread.title,
      workspace: thread.workspace,
      state: thread.state,
      prompt,
    };
  }

  markResumeFailure(threadId: string, reason: string): HistoryThreadSnapshot | null {
    const current = this.getThread(threadId);
    const state: HistoryThreadState = current?.hasSnapshot ? "snapshot_only" : "metadata_only";
    this.resumeOverrides.set(threadId, { state, reason });

    const cache = this.ensureCache(true);
    return cache.snapshots.get(threadId) || null;
  }

  private ensureCache(force = false): HistoryCache {
    const cacheKey = this.getCacheKey();
    if (
      !force &&
      this.cache &&
      this.cache.cacheKey === cacheKey &&
      Date.now() - this.cache.loadedAt < CACHE_TTL_MS
    ) {
      return this.cache;
    }

    const rebuilt = this.rebuildCache(cacheKey);
    this.cache = rebuilt;
    return rebuilt;
  }

  private getCacheKey(): string {
    const sessionIndex = safeStat(join(this.codexHome, "session_index.jsonl"));
    const history = safeStat(join(this.codexHome, "history.jsonl"));
    const sessionsRoot = safeStat(join(this.codexHome, "sessions"));

    return [
      sessionIndex?.mtimeMs ?? 0,
      sessionIndex?.size ?? 0,
      history?.mtimeMs ?? 0,
      history?.size ?? 0,
      sessionsRoot?.mtimeMs ?? 0,
    ].join(":");
  }

  private rebuildCache(cacheKey: string): HistoryCache {
    const sessionIndexMap = this.loadSessionIndex();
    const historyFallbackMap = this.loadHistoryFallback();
    const rolloutMap = this.loadRollouts();

    const ids = new Set<string>([
      ...sessionIndexMap.keys(),
      ...historyFallbackMap.keys(),
      ...rolloutMap.keys(),
    ]);

    const snapshots = new Map<string, HistoryThreadSnapshot>();

    for (const id of ids) {
      const indexEntry = sessionIndexMap.get(id);
      const rollout = rolloutMap.get(id);
      const fallback = historyFallbackMap.get(id);

      const items = (rollout?.items.length ? rollout.items : fallback?.items) || [];
      let state: HistoryThreadState = rollout
        ? "resumable"
        : items.length > 0
          ? "snapshot_only"
          : "metadata_only";
      let resumeReason = rollout ? undefined : fallback ? "本地缺少 rollout 文件，已回退到简化快照。" : "仅找到线程元数据。";

      const override = this.resumeOverrides.get(id);
      if (override) {
        state = override.state;
        resumeReason = override.reason;
      }

      const title =
        indexEntry?.threadName ||
        rollout?.title ||
        fallbackTitleFromItems(items) ||
        "未命名";
      const preview =
        rollout?.preview ||
        fallback?.preview ||
        truncateText(title, MAX_PREVIEW_LENGTH);
      const updatedAt = Math.max(
        indexEntry?.updatedAt || 0,
        rollout?.updatedAt || 0,
        fallback?.updatedAt || 0
      );
      const workspace = rollout?.workspace || "";

      snapshots.set(id, {
        id,
        title,
        preview,
        workspace,
        updatedAt: toTimestampSeconds(updatedAt || Date.now()),
        state,
        hasSnapshot: items.length > 0,
        resumeReason,
        items,
        meta: {
          createdAt: rollout?.createdAt,
          source: rollout?.meta.source,
          originator: rollout?.meta.originator,
          cliVersion: rollout?.meta.cliVersion,
          modelProvider: rollout?.meta.modelProvider,
        },
      });
    }

    const threads = sortWorkspaceEntries(
      Array.from(snapshots.values()).map((snapshot) => ({
        id: snapshot.id,
        title: snapshot.title,
        preview: snapshot.preview,
        workspace: snapshot.workspace,
        updatedAt: snapshot.updatedAt,
        state: snapshot.state,
        hasSnapshot: snapshot.hasSnapshot,
        resumeReason: snapshot.resumeReason,
      }))
    );

    const workspaceMap = new Map<string, HistoryWorkspaceSummary>();
    for (const thread of threads) {
      if (!thread.workspace) continue;

      const existing = workspaceMap.get(thread.workspace);
      if (existing) {
        existing.threadCount += 1;
        existing.updatedAt = Math.max(existing.updatedAt, thread.updatedAt);
      } else {
        workspaceMap.set(thread.workspace, {
          workspace: thread.workspace,
          title: getWorkspaceTitle(thread.workspace),
          updatedAt: thread.updatedAt,
          threadCount: 1,
        });
      }
    }

    return {
      loadedAt: Date.now(),
      cacheKey,
      threads,
      snapshots,
      workspaces: sortWorkspaceEntries(Array.from(workspaceMap.values())),
    };
  }

  private loadSessionIndex(): Map<string, SessionIndexEntry> {
    const path = join(this.codexHome, "session_index.jsonl");
    const records = readJsonLines(path);
    const entries = new Map<string, SessionIndexEntry>();

    for (const record of records) {
      const id = typeof record.id === "string" ? record.id : "";
      if (!id) continue;

      entries.set(id, {
        id,
        threadName: typeof record.thread_name === "string" ? record.thread_name : "",
        updatedAt: toTimestampMs(record.updated_at),
      });
    }

    return entries;
  }

  private loadHistoryFallback(): Map<string, HistoryFallback> {
    const path = join(this.codexHome, "history.jsonl");
    const records = readJsonLines(path);
    const grouped = new Map<string, HistoryFallback>();

    for (const record of records) {
      const id = typeof record.session_id === "string" ? record.session_id : "";
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!id || !text) continue;

      const timestamp = toTimestampMs(record.ts);
      const entry = grouped.get(id) || {
        updatedAt: 0,
        preview: "",
        items: [],
      };

      entry.updatedAt = Math.max(entry.updatedAt, timestamp);
      entry.preview = truncateText(text, MAX_PREVIEW_LENGTH);
      entry.items.push({
        type: "user_message",
        id: `${id}-history-${entry.items.length}`,
        text,
        timestamp,
      });

      grouped.set(id, entry);
    }

    return grouped;
  }

  private loadRollouts(): Map<string, ParsedRollout> {
    const sessionsRoot = join(this.codexHome, "sessions");
    const files = this.findRolloutFiles(sessionsRoot);
    const seen = new Set(files);
    const parsed = new Map<string, ParsedRollout>();

    for (const [path] of this.rolloutCache) {
      if (!seen.has(path)) {
        this.rolloutCache.delete(path);
      }
    }

    for (const file of files) {
      const stat = safeStat(file);
      if (!stat) continue;

      const cached = this.rolloutCache.get(file);
      let rollout: ParsedRollout | null = null;

      if (cached && cached.mtimeMs === stat.mtimeMs) {
        rollout = cached.parsed;
      } else {
        rollout = this.parseRolloutFile(file);
        this.rolloutCache.set(file, {
          mtimeMs: stat.mtimeMs,
          parsed: rollout,
        });
      }

      if (rollout?.id) {
        parsed.set(rollout.id, rollout);
      }
    }

    return parsed;
  }

  private findRolloutFiles(root: string): string[] {
    if (!existsSync(root)) return [];

    const queue = [root];
    const results: string[] = [];

    while (queue.length > 0) {
      const current = queue.pop()!;
      let entries: Dirent<string>[];
      try {
        entries = readdirSync(current, { withFileTypes: true }) as Dirent<string>[];
      } catch {
        continue;
      }

      for (const entry of entries) {
        const fullPath = join(current, entry.name);
        if (entry.isDirectory()) {
          queue.push(fullPath);
          continue;
        }

        if (entry.isFile() && entry.name.startsWith("rollout-") && entry.name.endsWith(".jsonl")) {
          results.push(fullPath);
        }
      }
    }

    return results;
  }

  private parseRolloutFile(path: string): ParsedRollout | null {
    const content = readFileSync(path, "utf-8");
    const lines = content.split(/\r?\n/);
    const items: HistoryThreadItem[] = [];
    const pendingCalls = new Map<string, PendingToolCall>();
    const fileStat = safeStat(path);
    let id = "";
    let workspace = "";
    let createdAt = "";
    let title = "";
    let source = "";
    let originator = "";
    let cliVersion = "";
    let modelProvider = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let record: Record<string, unknown>;
      try {
        record = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }

      const recordType = typeof record.type === "string" ? record.type : "";
      const timestamp = toTimestampMs(record.timestamp);

      if (recordType === "session_meta") {
        const payload = (record.payload as Record<string, unknown>) || {};
        id = typeof payload.id === "string" ? payload.id : id;
        workspace = typeof payload.cwd === "string" ? payload.cwd : workspace;
        createdAt = typeof payload.timestamp === "string" ? payload.timestamp : createdAt;
        source = typeof payload.source === "string" ? payload.source : source;
        originator = typeof payload.originator === "string" ? payload.originator : originator;
        cliVersion = typeof payload.cli_version === "string" ? payload.cli_version : cliVersion;
        modelProvider =
          typeof payload.model_provider === "string" ? payload.model_provider : modelProvider;
        continue;
      }

      if (recordType === "turn_context" && !workspace) {
        const payload = (record.payload as Record<string, unknown>) || {};
        workspace = typeof payload.cwd === "string" ? payload.cwd : workspace;
        continue;
      }

      if (recordType === "event_msg") {
        const payload = (record.payload as Record<string, unknown>) || {};
        const messageType = typeof payload.type === "string" ? payload.type : "";

        if (messageType === "user_message") {
          const text = typeof payload.message === "string" ? payload.message.trim() : "";
          if (!text) continue;

          title ||= truncateText(text, 36);
          appendHistoryItem(items, {
            type: "user_message",
            id: `${id || path}-user-${items.length}`,
            text,
            timestamp,
          });
        } else if (messageType === "agent_message") {
          const text = typeof payload.message === "string" ? payload.message.trim() : "";
          if (!text) continue;

          appendHistoryItem(items, {
            type: "agent_text",
            id: `${id || path}-assistant-${items.length}`,
            content: text,
            streaming: false,
            timestamp,
          });
        }

        continue;
      }

      if (recordType !== "response_item") continue;
      const payload = (record.payload as Record<string, unknown>) || {};
      const payloadType = typeof payload.type === "string" ? payload.type : "";

      if (payloadType === "reasoning") {
        const summary = Array.isArray(payload.summary)
          ? (payload.summary as unknown[]).filter((value): value is string => typeof value === "string").join("\n")
          : "";
        const contentText = Array.isArray(payload.content)
          ? (payload.content as unknown[]).filter((value): value is string => typeof value === "string").join("\n")
          : "";
        const reasoningText = summary || contentText;
        if (!reasoningText.trim()) continue;

        appendHistoryItem(items, {
          type: "reasoning",
          id: typeof payload.id === "string" ? payload.id : `${id || path}-reasoning-${items.length}`,
          content: contentText,
          summary,
          streaming: false,
          timestamp,
        });
        continue;
      }

      if (payloadType === "function_call") {
        const callId = typeof payload.call_id === "string" ? payload.call_id : "";
        if (!callId) continue;

        const name = typeof payload.name === "string" ? payload.name : "";
        if (name === "shell_command") {
          const extracted = extractShellCommand(
            typeof payload.arguments === "string" ? payload.arguments : ""
          );
          pendingCalls.set(callId, {
            name,
            command: extracted.command,
            cwd: extracted.cwd,
            timestamp,
          });
        }
        continue;
      }

      if (payloadType === "function_call_output") {
        const callId = typeof payload.call_id === "string" ? payload.call_id : "";
        const toolCall = pendingCalls.get(callId);
        const output = typeof payload.output === "string" ? payload.output : "";

        if (toolCall?.name === "shell_command") {
          appendHistoryItem(items, {
            type: "command_call",
            id: callId,
            command: toolCall.command,
            cwd: toolCall.cwd,
            status: "completed",
            output: truncateText(output, 6000),
            exitCode: null,
            durationMs: null,
            timestamp: toolCall.timestamp,
          });
        } else if (output.trim()) {
          appendHistoryItem(items, {
            type: "system",
            id: callId || `${id || path}-tool-${items.length}`,
            content: truncateText(output, 1200),
            timestamp,
          });
        }

        pendingCalls.delete(callId);
        continue;
      }

      if (payloadType === "message" && !title) {
        const role = typeof payload.role === "string" ? payload.role : "";
        if (role === "user") {
          const text = extractTextContent(payload.content);
          if (text) title = truncateText(text, 36);
        }
      }
    }

    if (!id) {
      const match = path.match(THREAD_ID_RE);
      id = match?.[1] || "";
    }

    if (!id) return null;

    return {
      id,
      workspace,
      updatedAt: fileStat?.mtimeMs || Date.now(),
      createdAt,
      title: title || fallbackTitleFromItems(items),
      preview: buildPreview(items),
      items,
      meta: {
        source,
        originator,
        cliVersion,
        modelProvider,
      },
    };
  }
}

export const codexHistoryService = new CodexHistoryService();
