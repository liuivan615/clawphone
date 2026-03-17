import { useState, useCallback, useEffect } from "react";
import { hasToken } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import type { ConversationItem } from "./lib/conversation-types";
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

type Tab = "tasks" | "files" | "changes";

// Theme management
const VALID_THEMES = ["dark", "light", "one-dark", "dracula", "github-dark"];

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
  } = useWebSocket();

  // Session state
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string>("");
  const [lastError, setLastError] = useState<string | null>(null);

  // Conversation state
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [turnActive, setTurnActive] = useState(false);

  // Thread history (from Codex App Server persistence)
  interface ThreadSummary {
    id: string;
    preview: string;
    name: string | null;
    cwd: string;
    updatedAt: number;
  }
  const [savedThreads, setSavedThreads] = useState<ThreadSummary[]>([]);

  // Model/reasoning/permission
  const [model, setModel] = useState("gpt-5.4");
  const [reasoning, setReasoning] = useState("xhigh");
  const [approvalPolicy, setApprovalPolicy] = useState("on-request");
  const [planMode, setPlanMode] = useState(false);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clawphone_theme", theme);
  }, [theme]);

  const changeTheme = useCallback((t: string) => {
    setTheme(t as typeof theme);
  }, []);

  // ── Helper: find or create item by id ──
  const updateItem = useCallback(
    (itemId: string, updater: (prev: ConversationItem | undefined) => ConversationItem) => {
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = updater(prev[idx]);
          return updated;
        }
        // Item not found, create it
        return [...prev, updater(undefined)];
      });
    },
    []
  );

  // ── Convert Codex ThreadItem to our ConversationItem ──
  const threadItemToConversation = (item: Record<string, unknown>): ConversationItem | null => {
    const type = item.type as string;
    const id = item.id as string;
    const ts = Date.now();

    switch (type) {
      case "userMessage": {
        const content = (item.content as Array<Record<string, unknown>>) || [];
        const text = content.map((c) => (c.text as string) || "").join("\n");
        return { type: "user_message", id, text, timestamp: ts };
      }
      case "agentMessage":
        return { type: "agent_text", id, content: (item.text as string) || "", streaming: false, timestamp: ts };
      case "plan":
        return {
          type: "task_update",
          id,
          explanation: (item.text as string) || "",
          steps: [],
          timestamp: ts,
        };
      case "reasoning": {
        const summary = ((item.summary as string[]) || []).join("");
        const content = ((item.content as string[]) || []).join("");
        return { type: "reasoning", id, content, summary, streaming: false, timestamp: ts };
      }
      case "commandExecution":
        return {
          type: "command_call", id,
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
      case "fileChange": {
        const changes = ((item.changes as Array<Record<string, unknown>>) || []).map((c) => ({
          path: (c.path as string) || "",
          kind: ((c.kind as Record<string, string>)?.type || "update") as "add" | "delete" | "update",
          diff: (c.diff as string) || "",
        }));
        return {
          type: "file_change", id, changes,
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
      }
      default:
        return null;
    }
  };

  // ── WebSocket event handler ──
  useEffect(() => {
    return addHandler((msg) => {
      switch (msg.type) {
        case "session_started":
          setActiveSessionId(msg.sessionId as string);
          setThreadId(msg.threadId as string);
          setWorkspace((msg.workspace as string) || "");
          setSavedThreads((prev) =>
            prev.some((thread) => thread.id === (msg.threadId as string))
              ? prev
              : [
                  {
                    id: msg.threadId as string,
                    preview: "",
                    name: null,
                    cwd: (msg.workspace as string) || "",
                    updatedAt: Math.floor(Date.now() / 1000),
                  },
                  ...prev,
                ]
          );
          setLastError(null);
          break;

        // ── Thread history from Codex persistence ──
        case "threads_list": {
          const threads = (msg.threads as Array<Record<string, unknown>>) || [];
          setSavedThreads(
            threads.map((t) => ({
              id: t.id as string,
              preview: (t.preview as string) || "",
              name: (t.name as string) || null,
              cwd: (t.cwd as string) || "",
              updatedAt: (t.updatedAt as number) || 0,
            }))
          );
          break;
        }

        case "thread_resumed": {
          const thread = msg.thread as Record<string, unknown>;
          if (!thread) break;
          setThreadId(thread.id as string);
          setWorkspace((thread.cwd as string) || "");
          // Convert thread turns/items into ConversationItems
          const turns = (thread.turns as Array<Record<string, unknown>>) || [];
          const restored: ConversationItem[] = [];
          for (const turn of turns) {
            const turnItems = (turn.items as Array<Record<string, unknown>>) || [];
            for (const item of turnItems) {
              const converted = threadItemToConversation(item);
              if (converted) restored.push(converted);
            }
          }
          setItems(restored);
          setTurnActive(false);
          break;
        }

        case "task_update": {
          const turnId = msg.turnId as string;
          const explanation = (msg.explanation as string) || "";
          const plan = (msg.plan as Array<Record<string, unknown>>) || [];
          updateItem(`task-${turnId}`, () => ({
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
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateItem(itemId, (prev) => {
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

        // ── Agent text streaming ──
        case "agent_text": {
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateItem(itemId, (prev) => {
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

        // ── Reasoning ──
        case "reasoning": {
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateItem(itemId, (prev) => {
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
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateItem(itemId, (prev) => {
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

        // ── Command execution ──
        case "command_approval_request": {
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateItem(itemId, (prev) => {
            if (prev && prev.type === "command_call") {
              return { ...prev, status: "pending", requestId, command: (msg.command as string) || prev.command };
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
          const itemId = msg.itemId as string;
          const delta = msg.delta as string;
          updateItem(itemId, (prev) => {
            if (prev && prev.type === "command_call") {
              return { ...prev, output: prev.output + delta, status: prev.status === "pending" || prev.status === "approved" ? "running" : prev.status };
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

        // ── File change ──
        case "file_change_approval_request": {
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateItem(itemId, (prev) => {
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
          const itemId = msg.itemId as string;
          const requestId = msg.requestId as number;
          updateItem(itemId, () => ({
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

          updateItem(itemId, () => ({
            type: "user_input_request",
            id: itemId,
            questions,
            status: "pending",
            requestId,
            timestamp: Date.now(),
          }));
          break;
        }

        // ── Item lifecycle ──
        case "item_started": {
          const item = msg.item as Record<string, unknown>;
          const itemType = item.type as string;
          const itemId = item.id as string;

          if (itemType === "commandExecution") {
            updateItem(itemId, () => ({
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
            updateItem(itemId, () => ({
              type: "file_change",
              id: itemId,
              changes: changes.map((c) => ({
                path: c.path,
                kind: c.kind.type as "add" | "delete" | "update",
                diff: c.diff || "",
              })),
              status: "running" as const,
              timestamp: Date.now(),
            }));
          }
          break;
        }

        case "item_completed": {
          const item = msg.item as Record<string, unknown>;
          const itemType = item.type as string;
          const itemId = item.id as string;

          if (itemType === "agentMessage") {
            updateItem(itemId, (prev) => {
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
            updateItem(itemId, (prev) => {
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
            updateItem(itemId, (prev) => {
              if (prev && prev.type === "command_call") {
                return {
                  ...prev,
                  status: status === "completed" ? "completed" : status === "failed" ? "failed" : status === "declined" ? "denied" : prev.status,
                  output: (item.aggregatedOutput as string) || prev.output,
                  exitCode: item.exitCode as number | null,
                  durationMs: item.durationMs as number | null,
                  command: (item.command as string) || prev.command,
                };
              }
              return prev || {
                type: "command_call" as const,
                id: itemId,
                command: (item.command as string) || "",
                status: "completed" as const,
                output: (item.aggregatedOutput as string) || "",
                exitCode: item.exitCode as number | null,
                durationMs: item.durationMs as number | null,
                timestamp: Date.now(),
              };
            });
          } else if (itemType === "fileChange") {
            const status = item.status as string;
            const changes = (item.changes as Array<{ path: string; kind: { type: string }; diff: string }>) || [];
            updateItem(itemId, (prev) => {
              if (prev && prev.type === "file_change") {
                return {
                  ...prev,
                  status: status === "completed" ? "completed" : status === "failed" ? "failed" : status === "declined" ? "denied" : prev.status,
                  changes: changes.length > 0 ? changes.map((c) => ({
                    path: c.path,
                    kind: c.kind.type as "add" | "delete" | "update",
                    diff: c.diff || "",
                  })) : prev.changes,
                };
              }
              return prev || {
                type: "file_change" as const,
                id: itemId,
                changes: changes.map((c) => ({
                  path: c.path,
                  kind: c.kind.type as "add" | "delete" | "update",
                  diff: c.diff || "",
                })),
                status: "completed" as const,
                timestamp: Date.now(),
              };
            });
          }
          break;
        }

        // ── Turn lifecycle ──
        case "turn_started":
          setTurnActive(true);
          break;

        case "turn_completed":
          setTurnActive(false);
          break;

        // ── Session lifecycle ──
        case "session_closed": {
          const exitCode = msg.exitCode as number;
          setItems((prev) => [
            ...prev,
            {
              type: "system",
              id: `exit-${Date.now()}`,
              content: `Codex 已退出 (code ${exitCode})`,
              timestamp: Date.now(),
            },
          ]);
          if (exitCode !== 0) {
            setLastError(`Codex 异常退出 (code ${exitCode})`);
          }
          setActiveSessionId(null);
          setTurnActive(false);
          break;
        }

        case "session_killed":
          setActiveSessionId(null);
          setTurnActive(false);
          break;

        case "error":
          setLastError(msg.message as string);
          setItems((prev) => [
            ...prev,
            {
              type: "system",
              id: `err-${Date.now()}`,
              content: `Error: ${msg.message}`,
              timestamp: Date.now(),
            },
          ]);
          break;

        case "server_request":
          setItems((prev) => [
            ...prev,
            {
              type: "system",
              id: `srv-${Date.now()}`,
              content: `Unhandled request: ${String(msg.method || "unknown")}`,
              timestamp: Date.now(),
            },
          ]);
          break;
      }
    });
  }, [addHandler, updateItem]);

  // ── Handle sending a message ──
  const handleSend = useCallback(
    (text: string, isPlanMode?: boolean) => {
      if (!activeSessionId) return;

      const usePlan = isPlanMode ?? planMode;

      // Add user message to items
      setItems((prev) => [
        ...prev,
        {
          type: "user_message",
          id: `user-${Date.now()}`,
          text: usePlan ? `[计划] ${text}` : text,
          timestamp: Date.now(),
        },
      ]);

      sendMessage(text, {
        model,
        reasoningEffort: reasoning,
        collaborationMode: usePlan ? "plan" : undefined,
      });
      setTurnActive(true);
    },
    [activeSessionId, sendMessage, model, reasoning, planMode]
  );

  // ── Handle starting a session ──
  const handleStart = useCallback(
    (ws: string, prompt?: string) => {
      setItems([]);
      setLastError(null);
      setTurnActive(Boolean(prompt));

      // If prompt provided, add it as user message immediately
      if (prompt) {
        setItems([
          {
            type: "user_message",
            id: `user-${Date.now()}`,
            text: prompt,
            timestamp: Date.now(),
          },
        ]);
      }

      startSession(ws, { model, reasoningEffort: reasoning, prompt, approvalPolicy });
    },
    [startSession, model, reasoning, approvalPolicy]
  );

  // ── Handle approval — update UI immediately, don't wait for server ──
  const handleApprove = useCallback(
    (requestId: number) => {
      // Instantly update matching item to "approved" → show spinner
      setItems((prev) =>
        prev.map((item) => {
          if (
            (item.type === "command_call" || item.type === "file_change") &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            return { ...item, status: "running" as const, requestId: undefined };
          }
          return item;
        })
      );
      approve(requestId);
    },
    [approve]
  );

  const handleDeny = useCallback(
    (requestId: number) => {
      let shouldRejectGenericRequest = false;

      // Instantly update matching item to a terminal local state
      setItems((prev) =>
        prev.map((item) => {
          if (
            item.type === "permission_request" &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            shouldRejectGenericRequest = true;
            return { ...item, status: "denied", requestId: undefined };
          }
          if (
            item.type === "user_input_request" &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
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
        })
      );
      if (shouldRejectGenericRequest) {
        rejectRequest(requestId);
      } else {
        deny(requestId);
      }
    },
    [deny, rejectRequest]
  );

  const handleApprovePermission = useCallback(
    (requestId: number, scope: "turn" | "session") => {
      setItems((prev) =>
        prev.map((item) => {
          if (
            item.type === "permission_request" &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            return { ...item, status: "approved", requestId: undefined };
          }
          return item;
        })
      );
      grantPermissions(requestId, scope);
    },
    [grantPermissions]
  );

  const handleSubmitUserInput = useCallback(
    (requestId: number, answers: Record<string, string[]>) => {
      setItems((prev) =>
        prev.map((item) => {
          if (
            item.type === "user_input_request" &&
            item.requestId === requestId &&
            item.status === "pending"
          ) {
            return { ...item, status: "submitted", answers, requestId: undefined };
          }
          return item;
        })
      );
      submitUserInput(requestId, answers);
    },
    [submitUserInput]
  );

  // ── Handle resuming a saved thread ──
  const handleResumeThread = useCallback(
    (savedThreadId: string) => {
      if (!activeSessionId) return;
      resumeThread(savedThreadId);
    },
    [activeSessionId, resumeThread]
  );

  // Build thread list for left drawer from saved threads
  const threads = (() => {
    const result: Array<{ id: string; title: string; project: string; timeAgo: string; active: boolean }> = [];

    // Group saved threads by cwd (project)
    for (const t of savedThreads) {
      const project = t.cwd.split("\\").pop() || t.cwd;
      const title = t.name || t.preview.slice(0, 40) || "未命名";
      const ago = formatTimeAgo(t.updatedAt);
      result.push({
        id: t.id,
        title,
        project,
        timeAgo: ago,
        active: t.id === threadId,
      });
    }

    return result;
  })();

  // No active session → show start screen
  if (!activeSessionId) {
    return <StartScreen connected={connected} onStart={handleStart} lastError={lastError} />;
  }

  return (
    <MainLayout
      leftDrawer={
        <LeftDrawer
          threads={threads}
          activeThreadId={threadId || undefined}
          onSelectThread={(id) => handleResumeThread(id)}
          onNewThread={() => {
            killSession();
            setActiveSessionId(null);
            setThreadId(null);
            setItems([]);
          }}
          onThemeChange={changeTheme}
          theme={theme}
        />
      }
      rightDrawer={<RightDrawer workspace={workspace} />}
    >
      <TopBar title={workspace.split("\\").pop() || "Codex"} hasChanges={false} />
      <TabBar active={tab} onChange={setTab} />

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "tasks" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <TasksView
              items={items}
              turnActive={turnActive}
              onApprove={handleApprove}
              onDeny={handleDeny}
              onApprovePermission={handleApprovePermission}
              onSubmitUserInput={handleSubmitUserInput}
            />
          </div>
        )}
        {tab === "files" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <FilesView workspace={workspace} />
          </div>
        )}
        {tab === "changes" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <ChangesView workspace={workspace} />
          </div>
        )}
      </div>

      <InputArea
        onSend={handleSend}
        disabled={!connected || !activeSessionId}
        turnActive={turnActive}
        onInterrupt={interrupt}
        model={model}
        reasoning={reasoning}
        planMode={planMode}
        onPlanModeChange={setPlanMode}
        onModelChange={setModel}
        onReasoningChange={setReasoning}
      />
      <StatusBar workspace={workspace} permission={approvalPolicy} onPermissionChange={setApprovalPolicy} />
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
