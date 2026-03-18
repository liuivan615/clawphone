import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { api, hasToken } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ConversationItem } from "./lib/conversation-types";
import type {
  HistoryContinuePayload,
  HistoryThreadItem,
  HistoryThreadSnapshot,
  HistoryThreadSummary,
  HistoryWorkspaceSummary,
} from "./lib/types";
import { type WorkspaceHistoryEntry } from "./lib/workspace-history";
import { LoginScreen } from "./components/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { TopBar } from "./components/TopBar";
import { TabBar } from "./components/TabBar";
import { InputArea } from "./components/InputArea";
import { StatusBar } from "./components/StatusBar";
import { LeftDrawer } from "./components/LeftDrawer";
import { RightDrawer } from "./components/RightDrawer";
import { TasksView } from "./pages/TasksView";
import { ChangesView } from "./pages/ChangesView";
import { FilesView } from "./pages/FilesView";
import { StartScreen } from "./pages/StartScreen";
import { ContextHud } from "./components/ContextHud";

type Tab = "tasks" | "files" | "changes";
type SessionStatus = "starting" | "running" | "closed" | "error";

interface ThreadSummary {
  id: string;
  preview: string;
  name: string | null;
  cwd: string;
  updatedAt: number;
  agentNickname: string | null;
  agentRole: string | null;
  status: string;
}

interface TokenUsage {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
}

interface SessionBucket {
  sessionId: string;
  workspace: string;
  threadId: string | null;
  items: ConversationItem[];
  turnActive: boolean;
  savedThreads: ThreadSummary[];
  lastError: string | null;
  lastActiveAt: number;
  status: SessionStatus;
  tokenUsage: TokenUsage | null;
  clientRequestId?: string;
}

interface WsSessionSummary {
  id: string;
  workspace: string;
  status: string;
  threadId: string | null;
  createdAt: string;
}

type PendingStartAction =
  | {
      type: "resume_history";
      threadId: string;
      workspace: string;
    }
  | null;

interface PendingThreadTransition {
  previousItems: ConversationItem[];
  previousThreadId: string | null;
  previousStatus: SessionStatus;
  previousTurnActive: boolean;
  nextItems: ConversationItem[];
  nextTurnActive: boolean;
}

interface HistoryViewState {
  threadId: string;
  loading: boolean;
}

const VALID_THEMES = ["dark", "light", "one-dark", "dracula", "github-dark"];
const PENDING_SESSION_PREFIX = "pending:";

function getInitialTheme(): string {
  const saved = localStorage.getItem("clawphone_theme");
  if (saved && VALID_THEMES.includes(saved)) return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function formatTimeAgo(unixSeconds: number): string {
  if (!unixSeconds) return "";
  const now = Date.now() / 1000;
  const diff = now - unixSeconds;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} 天前`;
  return `${Math.floor(diff / 604800)} 周前`;
}

function getWorkspaceName(workspace: string): string {
  return workspace.split("\\").pop() || workspace || "Codex";
}

function isRootWorkspace(workspace: string): boolean {
  return /^[A-Za-z]:\\?$/.test(workspace.trim());
}

function getPendingSessionId(clientRequestId: string): string {
  return `${PENDING_SESSION_PREFIX}${clientRequestId}`;
}

function isPendingSessionId(sessionId: string): boolean {
  return sessionId.startsWith(PENDING_SESSION_PREFIX);
}

function mapSessionStatus(status: string): SessionStatus {
  if (status === "starting") return "starting";
  if (status === "closed") return "closed";
  if (status === "error") return "error";
  return "running";
}

function createUserMessage(text: string): ConversationItem {
  return {
    type: "user_message",
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    timestamp: Date.now(),
  };
}

function createSystemMessage(content: string): ConversationItem {
  return {
    type: "system",
    id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    content,
    timestamp: Date.now(),
  };
}

function createSessionBucket(
  sessionId: string,
  workspace: string,
  overrides: Partial<SessionBucket> = {}
): SessionBucket {
  return {
    sessionId,
    workspace,
    threadId: null,
    items: [],
    turnActive: false,
    savedThreads: [],
    lastError: null,
    lastActiveAt: Date.now(),
    status: "starting",
    tokenUsage: null,
    ...overrides,
  };
}

function getThreadTitle(thread: ThreadSummary | null | undefined): string | undefined {
  if (!thread) return undefined;
  return thread.name || thread.preview.slice(0, 40) || undefined;
}

function getSessionTitle(session: SessionBucket): string | undefined {
  const currentThread = session.savedThreads.find((thread) => thread.id === session.threadId);
  const threadTitle = getThreadTitle(currentThread);
  if (threadTitle) return threadTitle;

  for (let index = session.items.length - 1; index >= 0; index -= 1) {
    const item = session.items[index];
    if (item.type === "user_message") return item.text.slice(0, 40) || undefined;
    if (item.type === "agent_text") return item.content.slice(0, 40) || undefined;
  }

  return undefined;
}

function pickVisibleSessionId(
  sessionsById: Record<string, SessionBucket>,
  excludeSessionId?: string
): string | null {
  return (
    Object.values(sessionsById)
      .filter((session) => session.sessionId !== excludeSessionId && session.status !== "closed")
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0]?.sessionId || null
  );
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [theme, setTheme] = useState(getInitialTheme);
  const {
    connected,
    addHandler,
    startSession,
    sendMessage,
    approve,
    deny,
    grantPermissions,
    submitUserInput,
    rejectRequest,
    interrupt,
    killSession,
    listThreads,
    resumeThread,
    attachSession,
    listSessions,
    send,
  } = useWebSocket();

  const [sessionsById, setSessionsById] = useState<Record<string, SessionBucket>>({});
  const [visibleSessionId, setVisibleSessionId] = useState<string | null>(null);
  const [historyThreads, setHistoryThreads] = useState<HistoryThreadSummary[]>([]);
  const [historySnapshots, setHistorySnapshots] = useState<Record<string, HistoryThreadSnapshot>>({});
  const [historyWorkspaces, setHistoryWorkspaces] = useState<HistoryWorkspaceSummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyView, setHistoryView] = useState<HistoryViewState | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState("");
  const [appError, setAppError] = useState<string | null>(null);
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState(false);

  const [model, setModel] = useState("gpt-5.4");
  const [reasoning, setReasoning] = useState("xhigh");
  const [approvalPolicy, setApprovalPolicy] = useState("on-request");
  const [planMode, setPlanMode] = useState(false);
  const [skills, setSkills] = useState<Array<{ name: string; description: string; shortDescription?: string }>>([]);

  const sessionsRef = useRef<Record<string, SessionBucket>>({});
  const threadRefreshTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingStartActionsRef = useRef<Record<string, PendingStartAction>>({});
  const pendingThreadTransitionsRef = useRef<Record<string, PendingThreadTransition>>({});

  useEffect(() => {
    sessionsRef.current = sessionsById;
  }, [sessionsById]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clawphone_theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      for (const timer of threadRefreshTimers.current.values()) {
        clearTimeout(timer);
      }
      threadRefreshTimers.current.clear();
    };
  }, []);

  const changeTheme = useCallback((value: string) => {
    setTheme(value as typeof theme);
  }, []);

  const clearThreadRefresh = useCallback((sessionId: string) => {
    const existing = threadRefreshTimers.current.get(sessionId);
    if (!existing) return;
    clearTimeout(existing);
    threadRefreshTimers.current.delete(sessionId);
  }, []);

  const scheduleThreadRefresh = useCallback(
    (sessionId: string, delay = 600) => {
      if (!sessionId || isPendingSessionId(sessionId)) return;

      clearThreadRefresh(sessionId);

      const handle = setTimeout(() => {
        threadRefreshTimers.current.delete(sessionId);
        listThreads(sessionId);
      }, delay);

      threadRefreshTimers.current.set(sessionId, handle);
    },
    [clearThreadRefresh, listThreads]
  );

  const updateSession = useCallback(
    (sessionId: string, updater: (session: SessionBucket) => SessionBucket) => {
      setSessionsById((prev) => {
        const existing = prev[sessionId];
        if (!existing) return prev;
        return {
          ...prev,
          [sessionId]: updater(existing),
        };
      });
    },
    []
  );

  const updateSessionItem = useCallback(
    (
      sessionId: string,
      itemId: string,
      updater: (prev: ConversationItem | undefined) => ConversationItem
    ) => {
      updateSession(sessionId, (session) => {
        const index = session.items.findIndex((item) => item.id === itemId);
        const items = [...session.items];
        if (index >= 0) {
          items[index] = updater(items[index]);
        } else {
          items.push(updater(undefined));
        }
        return {
          ...session,
          items,
          lastActiveAt: Date.now(),
        };
      });
    },
    [updateSession]
  );

  const beginThreadTransition = useCallback(
    (
      sessionId: string,
      opts: {
        interimMessage?: string;
        nextItems: ConversationItem[];
        nextTurnActive?: boolean;
      }
    ) => {
      const current = sessionsRef.current[sessionId];
      if (!current) return false;

      pendingThreadTransitionsRef.current[sessionId] = {
        previousItems: current.items,
        previousThreadId: current.threadId,
        previousStatus: current.status,
        previousTurnActive: current.turnActive,
        nextItems: opts.nextItems,
        nextTurnActive: Boolean(opts.nextTurnActive),
      };

      updateSession(sessionId, (session) => ({
        ...session,
        items: opts.interimMessage
          ? [...current.items, createSystemMessage(opts.interimMessage)]
          : current.items,
        threadId: null,
        turnActive: false,
        status: "starting",
        lastError: null,
        lastActiveAt: Date.now(),
      }));

      return true;
    },
    [updateSession]
  );

  const restorePendingThreadTransition = useCallback(
    (sessionId: string, errorMessage?: string) => {
      const transition = pendingThreadTransitionsRef.current[sessionId];
      if (!transition) return false;

      delete pendingThreadTransitionsRef.current[sessionId];
      updateSession(sessionId, (session) => ({
        ...session,
        items: transition.previousItems,
        threadId: transition.previousThreadId,
        turnActive: transition.previousTurnActive,
        status: transition.previousStatus,
        lastError: errorMessage || session.lastError,
        lastActiveAt: Date.now(),
      }));
      return true;
    },
    [updateSession]
  );

  const upsertHistorySnapshot = useCallback((thread: HistoryThreadSnapshot) => {
    setHistorySnapshots((prev) => ({ ...prev, [thread.id]: thread }));
    setHistoryThreads((prev) => {
      const next = prev.filter((entry) => entry.id !== thread.id);
      next.unshift({
        id: thread.id,
        title: thread.title,
        preview: thread.preview,
        workspace: thread.workspace,
        updatedAt: thread.updatedAt,
        state: thread.state,
        hasSnapshot: thread.hasSnapshot,
        resumeReason: thread.resumeReason,
      });

      return next.sort((a, b) => b.updatedAt - a.updatedAt);
    });
  }, []);

  const convertHistoryItems = useCallback(
    (items: HistoryThreadItem[] | undefined): ConversationItem[] => {
      if (!items) return [];
      return items.map((item) => ({ ...item })) as ConversationItem[];
    },
    []
  );

  const loadHistoryCollections = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [workspacePayload, threadPayload] = await Promise.all([
        api.getHistoryWorkspaces(),
        api.getHistoryThreads({ limit: 300 }),
      ]);
      setHistoryWorkspaces(workspacePayload.workspaces || []);
      setHistoryThreads(threadPayload.threads || []);
      setHistoryLoaded(true);
      setSelectedWorkspace((prev) => prev || workspacePayload.workspaces?.[0]?.workspace || "");
    } catch (err) {
      setHistoryLoaded(true);
      setAppError((err as Error).message || "加载本机历史失败");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadHistoryThread = useCallback(
    async (threadId: string): Promise<HistoryThreadSnapshot | null> => {
      const cached = historySnapshots[threadId];
      if (cached) return cached;

      try {
        const payload = await api.getHistoryThread(threadId);
        upsertHistorySnapshot(payload.thread);
        return payload.thread;
      } catch (err) {
        setAppError((err as Error).message || "读取历史线程失败");
        return null;
      }
    },
    [historySnapshots, upsertHistorySnapshot]
  );

  const threadItemToConversation = useCallback((item: Record<string, unknown>): ConversationItem | null => {
    const type = item.type as string;
    const id = item.id as string;
    const ts = Date.now();

    switch (type) {
      case "userMessage": {
        const content = (item.content as Array<Record<string, unknown>>) || [];
        const text = content.map((chunk) => (chunk.text as string) || "").join("\n");
        return { type: "user_message", id, text, timestamp: ts };
      }
      case "agentMessage":
        return { type: "agent_text", id, content: (item.text as string) || "", streaming: false, timestamp: ts };
      case "plan":
        return { type: "task_update", id, explanation: (item.text as string) || "", steps: [], timestamp: ts };
      case "reasoning":
        return {
          type: "reasoning",
          id,
          content: ((item.content as string[]) || []).join(""),
          summary: ((item.summary as string[]) || []).join(""),
          streaming: false,
          timestamp: ts,
        };
      case "commandExecution":
        return {
          type: "command_call",
          id,
          command: (item.command as string) || "",
          cwd: item.cwd as string,
          status:
            (item.status as string) === "completed"
              ? "completed"
              : (item.status as string) === "failed"
                ? "failed"
                : (item.status as string) === "declined"
                  ? "denied"
                  : "running",
          output: (item.aggregatedOutput as string) || "",
          exitCode: (item.exitCode as number) ?? null,
          durationMs: (item.durationMs as number) ?? null,
          timestamp: ts,
        };
      case "fileChange":
        return {
          type: "file_change",
          id,
          changes: ((item.changes as Array<Record<string, unknown>>) || []).map((change) => ({
            path: (change.path as string) || "",
            kind: ((change.kind as Record<string, string>)?.type || "update") as "add" | "delete" | "update",
            diff: (change.diff as string) || "",
          })),
          status:
            (item.status as string) === "completed"
              ? "completed"
              : (item.status as string) === "failed"
                ? "failed"
                : (item.status as string) === "declined"
                  ? "denied"
                  : "running",
          timestamp: ts,
        };
      default:
        return null;
    }
  }, []);

  const launchSession = useCallback(
    (
      workspace: string,
      prompt?: string,
      opts: { skipThreadStart?: boolean; historyThreadId?: string } = {}
    ) => {
      const clientRequestId = startSession(workspace, {
        model,
        reasoningEffort: reasoning,
        prompt,
        approvalPolicy,
        skipThreadStart: opts.skipThreadStart,
      });

      if (!clientRequestId) {
        setAppError("WebSocket 尚未连接，无法启动会话");
        return;
      }

      const pendingSessionId = getPendingSessionId(clientRequestId);
      const pendingItems: ConversationItem[] = [
        createSystemMessage(
          opts.skipThreadStart
            ? `正在连接到 ${workspace} 并准备恢复历史线程...`
            : `正在连接到 ${workspace}...`
        ),
      ];
      if (prompt) pendingItems.push(createUserMessage(prompt));

      if (opts.skipThreadStart && opts.historyThreadId) {
        pendingStartActionsRef.current[clientRequestId] = {
          type: "resume_history",
          threadId: opts.historyThreadId,
          workspace,
        };
      }

      setSessionsById((prev) => ({
        ...prev,
        [pendingSessionId]: createSessionBucket(pendingSessionId, workspace, {
          items: pendingItems,
          turnActive: Boolean(prompt),
          lastActiveAt: Date.now(),
          status: "starting",
          clientRequestId,
        }),
      }));
      setVisibleSessionId(pendingSessionId);
      if (opts.historyThreadId) {
        setHistoryView({ threadId: opts.historyThreadId, loading: true });
      } else {
        setHistoryView(null);
      }
      setSelectedWorkspace(workspace);
      setAppError(null);
    },
    [approvalPolicy, model, reasoning, startSession]
  );

  useEffect(() => {
    return addHandler((msg) => {
      const sessionId = msg.sessionId as string | undefined;

      switch (msg.type) {
        case "sessions_list": {
          setInitialSessionsLoaded(true);

          const sessions = ((msg.sessions as WsSessionSummary[]) || []).filter(
            (session) => session.id && session.status !== "closed"
          );
          const sorted = [...sessions].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          const currentSessions = sessionsRef.current;
          const nextSessions: Record<string, SessionBucket> = {};
          const liveSessionIds = new Set(sorted.map((session) => session.id));

          for (const [existingSessionId, session] of Object.entries(currentSessions)) {
            if (isPendingSessionId(existingSessionId)) {
              nextSessions[existingSessionId] = session;
            } else if (!liveSessionIds.has(existingSessionId)) {
              clearThreadRefresh(existingSessionId);
            }
          }

          for (const session of sorted) {
            const existing = currentSessions[session.id];
            nextSessions[session.id] = existing
              ? {
                  ...existing,
                  workspace: session.workspace,
                  threadId: session.threadId,
                  status: mapSessionStatus(session.status),
                  lastActiveAt:
                    existing.lastActiveAt || new Date(session.createdAt).getTime() || Date.now(),
                }
              : createSessionBucket(session.id, session.workspace, {
                  threadId: session.threadId,
                  status: mapSessionStatus(session.status),
                  lastActiveAt: new Date(session.createdAt).getTime() || Date.now(),
                });
          }

          setSessionsById(nextSessions);
          setVisibleSessionId((prev) => {
            if (prev && nextSessions[prev]) return prev;
            return pickVisibleSessionId(nextSessions);
          });

          for (const session of sorted) {
            attachSession(session.id);
            listThreads(session.id);
          }

          if (!selectedWorkspace) {
            const preferredWorkspace =
              sorted.find((session) => session.workspace && !isRootWorkspace(session.workspace))?.workspace ||
              sorted[0]?.workspace ||
              "";
            if (preferredWorkspace) {
              setSelectedWorkspace(preferredWorkspace);
            }
          }

          if (sorted[0]) {
            send({ type: "list_skills", sessionId: sorted[0].id });
          }
          break;
        }

        case "session_started": {
          const actualSessionId = msg.sessionId as string;
          const workspace = (msg.workspace as string) || "";
          const threadId = (msg.threadId as string) || null;
          const clientRequestId = msg.clientRequestId as string | undefined;
          const pendingSessionId = clientRequestId ? getPendingSessionId(clientRequestId) : null;
          const pendingAction = clientRequestId ? pendingStartActionsRef.current[clientRequestId] : null;
          const pendingThreadTransition = pendingThreadTransitionsRef.current[actualSessionId] || null;
          const now = Date.now();

          setSessionsById((prev) => {
            const existing =
              (pendingSessionId && prev[pendingSessionId]) || prev[actualSessionId] || createSessionBucket(actualSessionId, workspace);
            const next = { ...prev };
            if (pendingSessionId) delete next[pendingSessionId];
            next[actualSessionId] = {
              ...existing,
              sessionId: actualSessionId,
              workspace,
              threadId,
              items: pendingThreadTransition ? pendingThreadTransition.nextItems : existing.items,
              turnActive: pendingThreadTransition ? pendingThreadTransition.nextTurnActive : existing.turnActive,
              status: "running",
              lastError: null,
              lastActiveAt: now,
              clientRequestId: undefined,
            };
            return next;
          });

          if (pendingThreadTransition) {
            delete pendingThreadTransitionsRef.current[actualSessionId];
          }

          setVisibleSessionId((prev) => {
            if (!prev || prev === pendingSessionId) return actualSessionId;
            return prev;
          });
          setSelectedWorkspace(workspace);

          if (clientRequestId) {
            delete pendingStartActionsRef.current[clientRequestId];
          }

          if (pendingAction?.type === "resume_history") {
            resumeThread(actualSessionId, pendingAction.threadId);
          } else {
            listThreads(actualSessionId);
            send({ type: "list_skills", sessionId: actualSessionId });
          }
          loadHistoryCollections();
          setAppError(null);
          break;
        }

        case "session_start_failed": {
          const clientRequestId = msg.clientRequestId as string | undefined;
          const pendingSessionId = clientRequestId ? getPendingSessionId(clientRequestId) : null;
          const fallbackSessionId = pendingSessionId
            ? pickVisibleSessionId(sessionsRef.current, pendingSessionId)
            : pickVisibleSessionId(sessionsRef.current);

          if (clientRequestId) {
            delete pendingStartActionsRef.current[clientRequestId];
          }

          if (pendingSessionId) {
            setSessionsById((prev) => {
              const next = { ...prev };
              delete next[pendingSessionId];
              return next;
            });
          }

          setVisibleSessionId((prev) => (prev === pendingSessionId ? fallbackSessionId : prev));
          setAppError(msg.message as string);
          break;
        }

        case "threads_list": {
          if (!sessionId) break;

          const threads = ((msg.threads as Array<Record<string, unknown>>) || []).map((thread) => ({
            id: thread.id as string,
            preview: (thread.preview as string) || "",
            name: (thread.name as string) || null,
            cwd: (thread.cwd as string) || "",
            updatedAt: (thread.updatedAt as number) || 0,
            agentNickname: (thread.agentNickname as string) || null,
            agentRole: (thread.agentRole as string) || null,
            status: (thread.status as string) || "",
          }));

          updateSession(sessionId, (session) => ({
            ...session,
            savedThreads: threads,
            lastActiveAt: Date.now(),
          }));
          break;
        }

        case "thread_resumed": {
          if (!sessionId) break;

          const thread = msg.thread as Record<string, unknown>;
          if (!thread) break;

          const turns = (thread.turns as Array<Record<string, unknown>>) || [];
          const restored: ConversationItem[] = [];
          for (const turn of turns) {
            const turnItems = (turn.items as Array<Record<string, unknown>>) || [];
            for (const item of turnItems) {
              const converted = threadItemToConversation(item);
              if (converted) restored.push(converted);
            }
          }

          updateSession(sessionId, (session) => ({
            ...session,
            threadId: (thread.id as string) || session.threadId,
            workspace: (thread.cwd as string) || session.workspace,
            items: restored,
            turnActive: false,
            status: "running",
            lastActiveAt: Date.now(),
          }));
          setHistoryView(null);
          setSelectedWorkspace((thread.cwd as string) || sessionsRef.current[sessionId]?.workspace || "");
          loadHistoryCollections();
          scheduleThreadRefresh(sessionId, 150);
          break;
        }

        case "task_update": {
          if (!sessionId) break;
          const turnId = msg.turnId as string;
          const explanation = (msg.explanation as string) || "";
          const plan = (msg.plan as Array<Record<string, unknown>>) || [];
          updateSessionItem(sessionId, `task-${turnId}`, () => ({
            type: "task_update",
            id: `task-${turnId}`,
            explanation,
            steps: plan.map((step) => ({
              step: (step.step as string) || "",
              status: ((step.status as string) || "pending") as "pending" | "inProgress" | "completed",
            })),
            timestamp: Date.now(),
          }));
          break;
        }

        case "plan_delta": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "task_update") {
              return { ...prev, explanation: prev.explanation + delta };
            }
            return {
              type: "task_update",
              id: itemId,
              explanation: delta,
              steps: [],
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "agent_text": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "agent_text") {
              return { ...prev, content: prev.content + delta, streaming: true };
            }
            return {
              type: "agent_text",
              id: itemId,
              content: delta,
              streaming: true,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "reasoning": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "reasoning") {
              return { ...prev, content: prev.content + delta, streaming: true };
            }
            return {
              type: "reasoning",
              id: itemId,
              content: delta,
              summary: "",
              streaming: true,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "reasoning_summary": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "reasoning") {
              return { ...prev, summary: prev.summary + delta };
            }
            return {
              type: "reasoning",
              id: itemId,
              content: "",
              summary: delta,
              streaming: true,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "command_approval_request": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "command_call") {
              return {
                ...prev,
                status: "pending",
                requestId,
                command: (msg.command as string) || prev.command,
              };
            }
            return {
              type: "command_call",
              id: itemId,
              command: (msg.command as string) || "",
              cwd: msg.cwd as string,
              status: "pending",
              output: "",
              exitCode: null,
              durationMs: null,
              requestId,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "command_output": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "command_call") {
              return {
                ...prev,
                output: prev.output + delta,
                status:
                  prev.status === "pending" || prev.status === "approved" ? "running" : prev.status,
              };
            }
            return {
              type: "command_call",
              id: itemId,
              command: "",
              status: "running",
              output: delta,
              exitCode: null,
              durationMs: null,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "file_change_approval_request": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateSessionItem(sessionId, itemId, (prev) => {
            if (prev && prev.type === "file_change") {
              return { ...prev, status: "pending", requestId };
            }
            return {
              type: "file_change",
              id: itemId,
              changes: [],
              status: "pending",
              requestId,
              timestamp: Date.now(),
            };
          });
          break;
        }

        case "permission_request": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateSessionItem(sessionId, itemId, () => ({
            type: "permission_request",
            id: itemId,
            reason: (msg.reason as string) || "",
            permissions: (msg.permissions as Record<string, unknown>) || {},
            status: "pending",
            requestId,
            timestamp: Date.now(),
          }));
          break;
        }

        case "user_input_request": {
          if (!sessionId) break;
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          const questions = ((msg.questions as Array<Record<string, unknown>>) || []).map((question) => ({
            id: (question.id as string) || "",
            header: (question.header as string) || "",
            question: (question.question as string) || "",
            isOther: Boolean(question.isOther),
            isSecret: Boolean(question.isSecret),
            options: ((question.options as Array<Record<string, unknown>>) || []).map((option) => ({
              label: (option.label as string) || "",
              description: (option.description as string) || "",
            })),
          }));

          updateSessionItem(sessionId, itemId, () => ({
            type: "user_input_request",
            id: itemId,
            questions,
            status: "pending",
            requestId,
            timestamp: Date.now(),
          }));
          break;
        }

        case "item_started": {
          if (!sessionId) break;
          const item = msg.item as Record<string, unknown>;
          const itemType = item.type as string;
          const itemId = item.id as string;

          if (itemType === "commandExecution") {
            updateSessionItem(sessionId, itemId, () => ({
              type: "command_call",
              id: itemId,
              command: (item.command as string) || "",
              cwd: item.cwd as string,
              status: "running",
              output: "",
              exitCode: null,
              durationMs: null,
              timestamp: Date.now(),
            }));
          } else if (itemType === "fileChange") {
            const changes = (item.changes as Array<{ path: string; kind: { type: string }; diff: string }>) || [];
            updateSessionItem(sessionId, itemId, () => ({
              type: "file_change",
              id: itemId,
              changes: changes.map((change) => ({
                path: change.path,
                kind: change.kind.type as "add" | "delete" | "update",
                diff: change.diff || "",
              })),
              status: "running",
              timestamp: Date.now(),
            }));
          }
          break;
        }

        case "item_completed": {
          if (!sessionId) break;
          const item = msg.item as Record<string, unknown>;
          const itemType = item.type as string;
          const itemId = item.id as string;

          if (itemType === "agentMessage") {
            updateSessionItem(sessionId, itemId, (prev) => {
              if (prev && prev.type === "agent_text") {
                return { ...prev, content: (item.text as string) || prev.content, streaming: false };
              }
              return {
                type: "agent_text",
                id: itemId,
                content: (item.text as string) || "",
                streaming: false,
                timestamp: Date.now(),
              };
            });
          } else if (itemType === "reasoning") {
            updateSessionItem(sessionId, itemId, (prev) => {
              if (prev && prev.type === "reasoning") {
                return { ...prev, streaming: false };
              }
              return {
                type: "reasoning",
                id: itemId,
                content: ((item.content as string[]) || []).join(""),
                summary: ((item.summary as string[]) || []).join(""),
                streaming: false,
                timestamp: Date.now(),
              };
            });
          } else if (itemType === "commandExecution") {
            const status = item.status as string;
            updateSessionItem(sessionId, itemId, (prev) => {
              if (prev && prev.type === "command_call") {
                return {
                  ...prev,
                  status:
                    status === "completed"
                      ? "completed"
                      : status === "failed"
                        ? "failed"
                        : status === "declined"
                          ? "denied"
                          : prev.status,
                  output: (item.aggregatedOutput as string) || prev.output,
                  exitCode: item.exitCode as number | null,
                  durationMs: item.durationMs as number | null,
                  command: (item.command as string) || prev.command,
                };
              }
              return {
                type: "command_call",
                id: itemId,
                command: (item.command as string) || "",
                status: "completed",
                output: (item.aggregatedOutput as string) || "",
                exitCode: item.exitCode as number | null,
                durationMs: item.durationMs as number | null,
                timestamp: Date.now(),
              };
            });
          } else if (itemType === "fileChange") {
            const status = item.status as string;
            const changes = (item.changes as Array<{ path: string; kind: { type: string }; diff: string }>) || [];
            updateSessionItem(sessionId, itemId, (prev) => {
              if (prev && prev.type === "file_change") {
                return {
                  ...prev,
                  status:
                    status === "completed"
                      ? "completed"
                      : status === "failed"
                        ? "failed"
                        : status === "declined"
                          ? "denied"
                          : prev.status,
                  changes:
                    changes.length > 0
                      ? changes.map((change) => ({
                          path: change.path,
                          kind: change.kind.type as "add" | "delete" | "update",
                          diff: change.diff || "",
                        }))
                      : prev.changes,
                };
              }
              return {
                type: "file_change",
                id: itemId,
                changes: changes.map((change) => ({
                  path: change.path,
                  kind: change.kind.type as "add" | "delete" | "update",
                  diff: change.diff || "",
                })),
                status: "completed",
                timestamp: Date.now(),
              };
            });
          }
          break;
        }

        case "turn_started":
          if (sessionId) {
            updateSession(sessionId, (session) => ({
              ...session,
              turnActive: true,
              lastActiveAt: Date.now(),
              status: "running",
            }));
          }
          break;

        case "turn_completed":
          if (sessionId) {
            updateSession(sessionId, (session) => ({
              ...session,
              turnActive: false,
              lastActiveAt: Date.now(),
            }));
            scheduleThreadRefresh(sessionId);
            loadHistoryCollections();
          }
          break;

        case "thread_started":
          if (sessionId) {
            scheduleThreadRefresh(sessionId, 200);
          }
          break;

        case "session_closed": {
          if (!sessionId) break;

          const fallbackSessionId = pickVisibleSessionId(sessionsRef.current, sessionId);
          clearThreadRefresh(sessionId);
          delete pendingThreadTransitionsRef.current[sessionId];

          setSessionsById((prev) => {
            const next = { ...prev };
            delete next[sessionId];
            return next;
          });
          setVisibleSessionId((prev) => (prev === sessionId ? fallbackSessionId : prev));
          loadHistoryCollections();

          const exitCode = msg.exitCode as number;
          if (exitCode !== 0 && !fallbackSessionId) {
            setAppError(`Codex 异常退出 (code ${exitCode})`);
          }
          break;
        }

        case "session_killed": {
          if (!sessionId) break;

          const fallbackSessionId = pickVisibleSessionId(sessionsRef.current, sessionId);
          clearThreadRefresh(sessionId);
          delete pendingThreadTransitionsRef.current[sessionId];

          setSessionsById((prev) => {
            const next = { ...prev };
            delete next[sessionId];
            return next;
          });
          setVisibleSessionId((prev) => (prev === sessionId ? fallbackSessionId : prev));
          loadHistoryCollections();
          break;
        }

        case "skills_list": {
          const data = msg.data as {
            data?: Array<{ skills?: Array<{ name: string; description: string; shortDescription?: string; enabled?: boolean }> }>;
          };
          const allSkills = (data?.data || []).flatMap((entry) => entry.skills || []);
          setSkills(allSkills.filter((skill) => (skill as Record<string, unknown>).enabled !== false));
          break;
        }

        case "token_usage":
          if (sessionId) {
            const usage = msg.tokenUsage as Record<string, unknown>;
            const total = (usage?.total as Record<string, number>) || {};
            updateSession(sessionId, (session) => ({
              ...session,
              tokenUsage: {
                totalTokens: total.totalTokens || 0,
                inputTokens: total.inputTokens || 0,
                outputTokens: total.outputTokens || 0,
                contextWindow: (usage?.modelContextWindow as number) || 0,
              },
            }));
          }
          break;

        case "error": {
          const errMsg = msg.message as string;
          if (
            sessionId &&
            errMsg?.startsWith("Failed to create thread:") &&
            restorePendingThreadTransition(sessionId, errMsg)
          ) {
            setAppError(errMsg);
            break;
          }

          if (errMsg?.includes("resume thread") || errMsg?.includes("no rollout found")) {
            if (errMsg.includes("resume thread")) {
              setHistoryView((prev) => (prev ? { ...prev, loading: false } : prev));
              setAppError(errMsg);
            } else {
              console.warn("[ClawPhone] Thread resume failed:", errMsg);
            }
            break;
          }

          if (sessionId && sessionsRef.current[sessionId]) {
            updateSession(sessionId, (session) => ({
              ...session,
              lastError: errMsg,
              turnActive: errMsg.startsWith("Failed to send initial prompt:")
                ? false
                : session.turnActive,
              items: [...session.items, createSystemMessage(`Error: ${errMsg}`)],
              lastActiveAt: Date.now(),
            }));
          } else {
            setAppError(errMsg);
          }
          break;
        }

        case "thread_resume_unavailable": {
          const threadId = msg.threadId as string;
          const thread = (msg.thread as HistoryThreadSnapshot | null) || null;
          const message = (msg.message as string) || "该历史线程无法精确恢复，已回退为只读快照。";

          if (thread) {
            upsertHistorySnapshot(thread);
            setSelectedWorkspace(thread.workspace || selectedWorkspace);
          } else if (threadId) {
            void loadHistoryThread(threadId);
          }

          setHistoryView({ threadId, loading: false });
          setAppError(message);
          break;
        }

        case "server_request":
          if (sessionId && sessionsRef.current[sessionId]) {
            updateSession(sessionId, (session) => ({
              ...session,
              items: [
                ...session.items,
                createSystemMessage(`Unhandled request: ${String(msg.method || "unknown")}`),
              ],
            }));
          }
          break;
      }
    });
  }, [
    addHandler,
    attachSession,
    beginThreadTransition,
    clearThreadRefresh,
    listThreads,
    loadHistoryCollections,
    loadHistoryThread,
    restorePendingThreadTransition,
    resumeThread,
    scheduleThreadRefresh,
    selectedWorkspace,
    send,
    threadItemToConversation,
    upsertHistorySnapshot,
    updateSession,
    updateSessionItem,
  ]);

  useEffect(() => {
    if (!connected) return;

    listSessions();
    void loadHistoryCollections();

    const liveSessions = Object.values(sessionsRef.current).filter(
      (session) => !isPendingSessionId(session.sessionId) && session.status !== "closed"
    );

    for (const session of liveSessions) {
      attachSession(session.sessionId);
      scheduleThreadRefresh(session.sessionId, 120);
    }

    if (skills.length === 0 && liveSessions[0]) {
      send({ type: "list_skills", sessionId: liveSessions[0].sessionId });
    }
  }, [
    attachSession,
    connected,
    listSessions,
    loadHistoryCollections,
    scheduleThreadRefresh,
    send,
    skills.length,
  ]);

  useEffect(() => {
    if (visibleSessionId && !sessionsById[visibleSessionId]) {
      setVisibleSessionId(pickVisibleSessionId(sessionsById));
    }
  }, [sessionsById, visibleSessionId]);

  const visibleSession = visibleSessionId ? sessionsById[visibleSessionId] || null : null;
  const visibleHistoryThread = historyView
    ? historySnapshots[historyView.threadId] ||
      historyThreads.find((thread) => thread.id === historyView.threadId) ||
      null
    : null;
  const visibleWorkspace =
    visibleHistoryThread?.workspace || visibleSession?.workspace || selectedWorkspace || "";
  const visibleItems = historyView
    ? convertHistoryItems((visibleHistoryThread as HistoryThreadSnapshot | null)?.items)
    : visibleSession?.items || [];
  const visibleTurnActive = historyView ? false : Boolean(visibleSession?.turnActive);
  const visibleTokenUsage = historyView ? null : visibleSession?.tokenUsage;

  const workspaceHistory: WorkspaceHistoryEntry[] = useMemo(() => {
    const map = new Map<string, WorkspaceHistoryEntry>();

    for (const workspace of historyWorkspaces) {
      map.set(workspace.workspace, {
        workspace: workspace.workspace,
        lastOpenedAt: workspace.updatedAt * 1000,
        lastTitle: workspace.title,
      });
    }

    for (const session of Object.values(sessionsById)) {
      if (!session.workspace || session.status === "closed") continue;
      const existing = map.get(session.workspace);
      const nextEntry: WorkspaceHistoryEntry = {
        workspace: session.workspace,
        lastOpenedAt: Math.max(existing?.lastOpenedAt || 0, session.lastActiveAt),
        lastSessionId: session.sessionId,
        lastTitle: getSessionTitle(session) || existing?.lastTitle || getWorkspaceName(session.workspace),
      };
      map.set(session.workspace, nextEntry);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (isRootWorkspace(a.workspace) !== isRootWorkspace(b.workspace)) {
        return isRootWorkspace(a.workspace) ? 1 : -1;
      }
      return b.lastOpenedAt - a.lastOpenedAt;
    });
  }, [historyWorkspaces, sessionsById]);

  const historyThreadsForDrawer = useMemo(
    () =>
      historyThreads.map((thread) => ({
        ...thread,
        active: historyView?.threadId === thread.id,
        timeAgo: formatTimeAgo(thread.updatedAt),
      })),
    [historyThreads, historyView]
  );

  const activeSessions = Object.values(sessionsById)
    .filter((session) => session.status !== "closed")
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
    .map((session) => ({
      id: session.sessionId,
      workspace: session.workspace,
      title: getSessionTitle(session) || getWorkspaceName(session.workspace),
      status: session.status,
      turnActive: session.turnActive,
      active: session.sessionId === visibleSessionId,
      timeAgo: formatTimeAgo(Math.floor(session.lastActiveAt / 1000)),
    }));

  const handleSend = useCallback(
    (text: string, isPlanMode?: boolean) => {
      if (!visibleSession || visibleSession.status !== "running" || historyView) return;

      const usePlan = isPlanMode ?? planMode;

      updateSession(visibleSession.sessionId, (session) => ({
        ...session,
        items: [...session.items, createUserMessage(usePlan ? `[计划] ${text}` : text)],
        turnActive: true,
        lastActiveAt: Date.now(),
      }));

      sendMessage(visibleSession.sessionId, text, {
        model,
        reasoningEffort: reasoning,
        collaborationMode: usePlan ? "plan" : undefined,
      });
    },
    [historyView, model, planMode, reasoning, sendMessage, updateSession, visibleSession]
  );

  const handleStart = useCallback(
    (workspace: string, prompt?: string) => {
      launchSession(workspace, prompt);
    },
    [launchSession]
  );

  const handleApprove = useCallback(
    (requestId: number) => {
      if (!visibleSession) return;

      updateSession(visibleSession.sessionId, (session) => ({
        ...session,
        items: session.items.map((item) => {
          if (
            (item.type === "command_call" || item.type === "file_change") &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            return { ...item, status: "running" as const, requestId: undefined };
          }
          return item;
        }),
      }));

      approve(visibleSession.sessionId, requestId);
    },
    [approve, updateSession, visibleSession]
  );

  const handleDeny = useCallback(
    (requestId: number) => {
      if (!visibleSession) return;

      let shouldRejectGenericRequest = false;

      updateSession(visibleSession.sessionId, (session) => ({
        ...session,
        items: session.items.map((item) => {
          if (item.type === "permission_request" && item.requestId === requestId && item.status === "pending") {
            shouldRejectGenericRequest = true;
            return { ...item, status: "denied", requestId: undefined };
          }
          if (item.type === "user_input_request" && item.requestId === requestId && item.status === "pending") {
            shouldRejectGenericRequest = true;
            return { ...item, status: "denied", requestId: undefined };
          }
          if (
            (item.type === "command_call" || item.type === "file_change") &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            return { ...item, status: "denied" as const, requestId: undefined };
          }
          return item;
        }),
      }));

      if (shouldRejectGenericRequest) {
        rejectRequest(visibleSession.sessionId, requestId);
      } else {
        deny(visibleSession.sessionId, requestId);
      }
    },
    [deny, rejectRequest, updateSession, visibleSession]
  );

  const handleApprovePermission = useCallback(
    (requestId: number, scope: "turn" | "session") => {
      if (!visibleSession) return;

      updateSession(visibleSession.sessionId, (session) => ({
        ...session,
        items: session.items.map((item) => {
          if (item.type === "permission_request" && item.requestId === requestId && item.status === "pending") {
            return { ...item, status: "approved", requestId: undefined };
          }
          return item;
        }),
      }));

      grantPermissions(visibleSession.sessionId, requestId, scope);
    },
    [grantPermissions, updateSession, visibleSession]
  );

  const handleSubmitUserInput = useCallback(
    (requestId: number, answers: Record<string, string[]>) => {
      if (!visibleSession) return;

      updateSession(visibleSession.sessionId, (session) => ({
        ...session,
        items: session.items.map((item) => {
          if (item.type === "user_input_request" && item.requestId === requestId && item.status === "pending") {
            return { ...item, status: "submitted", answers, requestId: undefined };
          }
          return item;
        }),
      }));

      submitUserInput(visibleSession.sessionId, requestId, answers);
    },
    [submitUserInput, updateSession, visibleSession]
  );

  const findExistingSessionForWorkspace = useCallback((workspace: string) => {
    return Object.values(sessionsRef.current)
      .filter((session) => session.workspace === workspace && session.status !== "closed")
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)[0];
  }, []);

  const handleOpenWorkspace = useCallback(
    (workspace: string) => {
      const existingSession = findExistingSessionForWorkspace(workspace);
      setSelectedWorkspace(workspace);
      setAppError(null);

      if (existingSession) {
        setVisibleSessionId(existingSession.sessionId);
        setHistoryView(null);
        return;
      }

      setHistoryView(null);
      setVisibleSessionId(null);
    },
    [findExistingSessionForWorkspace]
  );

  const handleSelectHistoryThread = useCallback(
    async (threadId: string) => {
      const summary = historyThreads.find((thread) => thread.id === threadId);
      if (!summary) return;

      setSelectedWorkspace(summary.workspace || selectedWorkspace);
      setHistoryView({ threadId, loading: summary.state === "resumable" });
      setAppError(null);

      const snapshot = await loadHistoryThread(threadId);
      if (summary.state !== "resumable" || !summary.workspace) {
        setHistoryView({ threadId, loading: false });
        setVisibleSessionId(null);
        return;
      }

      const existingSession = findExistingSessionForWorkspace(summary.workspace);
      if (existingSession) {
        setVisibleSessionId(existingSession.sessionId);
        resumeThread(existingSession.sessionId, threadId);
        return;
      }

      launchSession(summary.workspace, undefined, {
        skipThreadStart: true,
        historyThreadId: threadId,
      });

      if (snapshot) {
        upsertHistorySnapshot(snapshot);
      }
    },
    [
      findExistingSessionForWorkspace,
      historyThreads,
      launchSession,
      loadHistoryThread,
      resumeThread,
      selectedWorkspace,
      upsertHistorySnapshot,
    ]
  );

  const handleContinueHistory = useCallback(
    async (threadId: string) => {
      let payload: HistoryContinuePayload;
      try {
        payload = await api.continueHistoryThread(threadId);
      } catch (err) {
        setAppError((err as Error).message || "生成继续上下文失败");
        return;
      }

      const existingSession = findExistingSessionForWorkspace(payload.workspace);
      setSelectedWorkspace(payload.workspace);
      setHistoryView(null);
      setAppError(null);

      if (existingSession) {
        setVisibleSessionId(existingSession.sessionId);
        const transitionStarted = beginThreadTransition(existingSession.sessionId, {
          interimMessage: "正在基于历史快照开启新线程...",
          nextItems: [createUserMessage(payload.prompt)],
          nextTurnActive: true,
        });
        if (!transitionStarted) {
          setAppError("无法为当前会话创建新线程");
          return;
        }

        send({
          type: "new_thread",
          sessionId: existingSession.sessionId,
          workspace: payload.workspace,
          approvalPolicy,
          prompt: payload.prompt,
          model,
          reasoningEffort: reasoning,
        });
        return;
      }

      launchSession(payload.workspace, payload.prompt);
    },
    [
      approvalPolicy,
      beginThreadTransition,
      findExistingSessionForWorkspace,
      launchSession,
      model,
      reasoning,
      send,
    ]
  );

  const handleCloseSession = useCallback(
    (sessionId: string) => {
      if (visibleSessionId === sessionId) {
        setVisibleSessionId(pickVisibleSessionId(sessionsRef.current, sessionId));
      }
      clearThreadRefresh(sessionId);
      killSession(sessionId);
    },
    [clearThreadRefresh, killSession, visibleSessionId]
  );

  const showStartScreen =
    !visibleSession &&
    !historyView &&
    Object.keys(sessionsById).length === 0 &&
    historyThreads.length === 0 &&
    (historyLoaded || !connected);

  if (showStartScreen) {
    if (connected && (!initialSessionsLoaded || historyLoading)) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <span
              className="spinner"
              style={{
                width: 24,
                height: 24,
                display: "inline-block",
                borderRadius: "50%",
                border: "2px solid var(--border-default)",
                borderTopColor: "var(--accent-cyan)",
              }}
            />
            <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
              正在连接...
            </p>
          </div>
        </div>
      );
    }

    return (
      <StartScreen
        connected={connected}
        onStart={handleStart}
        lastError={appError}
        workspaceHistory={workspaceHistory}
      />
    );
  }

  return (
    <MainLayout
      leftDrawer={
        <LeftDrawer
          activeSessions={activeSessions}
          projectHistory={workspaceHistory}
          historyThreads={historyThreadsForDrawer}
          activeHistoryThreadId={historyView?.threadId}
          workspace={visibleWorkspace}
          onSelectSession={(sessionId) => {
            const session = sessionsRef.current[sessionId];
            if (session?.workspace) setSelectedWorkspace(session.workspace);
            setHistoryView(null);
            setVisibleSessionId(sessionId);
          }}
          onCloseSession={handleCloseSession}
          onSelectHistoryThread={handleSelectHistoryThread}
          onNewThread={() => {
            if (visibleSession && visibleSession.status === "running") {
              setHistoryView(null);
              const transitionStarted = beginThreadTransition(visibleSession.sessionId, {
                interimMessage: "正在创建新线程...",
                nextItems: [],
              });
              if (!transitionStarted) {
                setAppError("无法创建新线程");
                return;
              }
              send({ type: "new_thread", sessionId: visibleSession.sessionId, workspace: visibleWorkspace, approvalPolicy });
            } else if (visibleWorkspace) {
              launchSession(visibleWorkspace);
            }
          }}
          onSwitchWorkspace={handleOpenWorkspace}
          onThemeChange={changeTheme}
          theme={theme}
        />
      }
      rightDrawer={<RightDrawer workspace={visibleWorkspace} />}
    >
      <TopBar title={visibleHistoryThread?.title || getWorkspaceName(visibleWorkspace)} hasChanges={false}>
        {visibleTokenUsage && visibleTokenUsage.contextWindow > 0 && (
          <ContextHud
            totalTokens={visibleTokenUsage.totalTokens}
            inputTokens={visibleTokenUsage.inputTokens}
            outputTokens={visibleTokenUsage.outputTokens}
            contextWindow={visibleTokenUsage.contextWindow}
          />
        )}
      </TopBar>
      <TabBar active={tab} onChange={setTab} />

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "tasks" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <TasksView
              items={visibleItems}
              turnActive={visibleTurnActive}
              historyThread={visibleHistoryThread}
              historyLoading={Boolean(historyView?.loading)}
              onContinueHistory={
                visibleHistoryThread?.workspace
                  ? () => handleContinueHistory(visibleHistoryThread.id)
                  : undefined
              }
              onApprove={handleApprove}
              onDeny={handleDeny}
              onApprovePermission={handleApprovePermission}
              onSubmitUserInput={handleSubmitUserInput}
            />
          </div>
        )}
        {tab === "files" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <FilesView workspace={visibleWorkspace} />
          </div>
        )}
        {tab === "changes" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <ChangesView workspace={visibleWorkspace} />
          </div>
        )}
      </div>

      <InputArea
        onSend={handleSend}
        disabled={
          !connected ||
          Boolean(historyView) ||
          !visibleSession ||
          visibleSession.status !== "running" ||
          !visibleSession.threadId
        }
        turnActive={visibleTurnActive}
        workspace={visibleWorkspace}
        skills={skills}
        onInterrupt={() => {
          if (visibleSession) interrupt(visibleSession.sessionId);
        }}
        onSlashCommand={(command) => {
          if (!visibleSession) return;

          switch (command) {
            case "clear":
              updateSession(visibleSession.sessionId, (session) => ({ ...session, items: [] }));
              break;
            case "compact":
              send({ type: "compact_thread", sessionId: visibleSession.sessionId });
              break;
            case "undo":
              send({ type: "rollback_thread", sessionId: visibleSession.sessionId });
              break;
            case "diff":
            case "status":
              setTab("changes");
              break;
            case "skills":
              send({ type: "list_skills", sessionId: visibleSession.sessionId });
              break;
            case "history":
            case "resume":
              listThreads(visibleSession.sessionId);
              break;
            case "review":
              send({ type: "review_start", sessionId: visibleSession.sessionId });
              break;
            case "fork":
              send({ type: "fork_thread", sessionId: visibleSession.sessionId });
              break;
            case "name": {
              const name = prompt("为当前线程命名:");
              if (name) send({ type: "set_thread_name", sessionId: visibleSession.sessionId, name });
              break;
            }
            case "help":
              updateSession(visibleSession.sessionId, (s) => ({
                ...s,
                items: [...s.items, createSystemMessage(
                  "命令列表:\n/mode — 切换计划模式\n/model — 切换模型\n/approval — 切换审批策略\n/compact — 压缩上下文\n/clear — 清空对话\n/undo — 撤销上一轮\n/diff — 查看变更\n/review — 代码审查\n/fork — 分叉线程\n/name — 命名线程\n/skills — 列出技能"
                )],
              }));
              break;
            default:
              // Skills and other commands → send as message to Codex
              if (command.startsWith("approval:")) {
                setApprovalPolicy(command.slice("approval:".length));
              } else {
                handleSend(`/${command}`, false);
              }
              break;
          }
        }}
        model={model}
        reasoning={reasoning}
        planMode={planMode}
        onPlanModeChange={setPlanMode}
        onModelChange={setModel}
        onReasoningChange={setReasoning}
      />
      <StatusBar
        workspace={visibleWorkspace}
        permission={approvalPolicy}
        onPermissionChange={setApprovalPolicy}
      />
    </MainLayout>
  );
}

export function App() {
  const [authenticated, setAuthenticated] = useState(hasToken());

  if (!authenticated) {
    return <LoginScreen onLogin={() => setAuthenticated(true)} />;
  }

  return <AuthenticatedApp />;
}
