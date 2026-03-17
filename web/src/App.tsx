import { useState, useCallback, useEffect } from "react";
import { hasToken } from "./lib/api";
import { useWebSocket } from "./hooks/useWebSocket";
import { LoginScreen } from "./components/LoginScreen";
import { MainLayout } from "./components/MainLayout";
import { TopBar } from "./components/TopBar";
import { TabBar } from "./components/TabBar";
import { InputArea } from "./components/InputArea";
import { StatusBar } from "./components/StatusBar";
import { LeftDrawer } from "./components/LeftDrawer";
import { RightDrawer } from "./components/RightDrawer";
import { TasksView } from "./pages/TasksView";
import { StartScreen } from "./pages/StartScreen";

type Tab = "tasks" | "files" | "changes";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

// Theme management
function getInitialTheme(): "dark" | "light" {
  const saved = localStorage.getItem("clawphone_theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [theme, setTheme] = useState<"dark" | "light">(getInitialTheme);
  const { connected, addHandler, startCodex, sendInput, sendKey, killCodex } = useWebSocket();

  // Codex state
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Theme
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("clawphone_theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  // WebSocket message handler
  useEffect(() => {
    return addHandler((msg) => {
      switch (msg.type) {
        case "codex_started":
          setActiveSession(msg.sessionId as string);
          setWorkspace(msg.workspace as string || "");
          setMessages([]);
          setStreamingContent("");
          setIsStreaming(false);
          break;

        case "codex_output": {
          const clean = msg.clean as string;
          setStreamingContent((prev) => {
            let result = prev + clean;
            // Handle \r: for lines containing carriage returns, keep only the last segment
            // This collapses spinner frames (|, /, -, \) into one update
            const lines = result.split("\n");
            const processed = lines.map((line) => {
              if (line.includes("\r")) {
                const parts = line.split("\r").filter(Boolean);
                const last = parts[parts.length - 1] || "";
                // If the last part is just a spinner char, collapse to empty
                if (/^[\s|/\\─-]{0,2}$/.test(last.trim())) return "";
                return last;
              }
              return line;
            });
            return processed.join("\n");
          });
          setIsStreaming(true);
          break;
        }

        case "codex_exit": {
          const exitCode = msg.exitCode as number;
          // Flush streaming content as a final message
          setStreamingContent((prev) => {
            if (prev) {
              setMessages((msgs) => [
                ...msgs,
                { id: `out-${Date.now()}`, role: "assistant", content: prev },
              ]);
            }
            return "";
          });
          setIsStreaming(false);
          setMessages((msgs) => [
            ...msgs,
            { id: `exit-${Date.now()}`, role: "system", content: `Codex 已退出 (code ${exitCode})` },
          ]);
          if (exitCode !== 0) {
            setLastError(`Codex 异常退出 (code ${exitCode})`);
          }
          setActiveSession(null);
          break;
        }

        case "codex_killed":
          setActiveSession(null);
          setIsStreaming(false);
          break;

        case "error":
          setLastError(msg.message as string);
          setMessages((msgs) => [
            ...msgs,
            { id: `err-${Date.now()}`, role: "system", content: `Error: ${msg.message}` },
          ]);
          setIsStreaming(false);
          break;
      }
    });
  }, [addHandler]);

  // Handle sending a message to Codex
  const handleSend = useCallback(
    (message: string) => {
      if (!activeSession) return;

      // Flush streaming content first
      if (streamingContent) {
        setMessages((msgs) => [
          ...msgs,
          { id: `out-${Date.now()}`, role: "assistant", content: streamingContent },
        ]);
        setStreamingContent("");
      }

      // Add user message
      setMessages((msgs) => [
        ...msgs,
        { id: `user-${Date.now()}`, role: "user", content: message },
      ]);

      // Send to Codex process
      sendInput(message + "\r");
      setIsStreaming(true);
      setStreamingContent("");
    },
    [activeSession, streamingContent, sendInput]
  );

  const handleStart = useCallback(
    (ws: string, prompt?: string) => {
      setMessages([]);
      setStreamingContent("");
      setLastError(null);
      startCodex(ws, prompt);
    },
    [startCodex]
  );

  // Mock thread data (will be real in Phase 2)
  const threads = activeSession
    ? [
        {
          id: activeSession,
          title: workspace.split("\\").pop() || "Session",
          project: workspace.split("\\").slice(-2, -1)[0] || "Project",
          timeAgo: "now",
          active: true,
        },
      ]
    : [];

  // No active session → show start screen
  if (!activeSession) {
    return <StartScreen connected={connected} onStart={handleStart} lastError={lastError} />;
  }

  return (
    <MainLayout
      leftDrawer={
        <LeftDrawer
          threads={threads}
          activeThreadId={activeSession || undefined}
          onSelectThread={() => {}}
          onNewThread={() => {
            killCodex();
            setActiveSession(null);
          }}
          onToggleTheme={toggleTheme}
          isDark={theme === "dark"}
        />
      }
      rightDrawer={<RightDrawer files={[]} />}
    >
      <TopBar title={workspace.split("\\").pop() || "Codex"} hasChanges={false} />
      <TabBar active={tab} onChange={setTab} />

      {/* Tab content with crossfade */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === "tasks" && (
          <div className="tab-enter flex-1 flex flex-col overflow-hidden">
            <TasksView
              messages={messages}
              streamingContent={streamingContent}
              isStreaming={isStreaming}
            />
          </div>
        )}
        {tab === "files" && (
          <div className="tab-enter flex-1 flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
            <p className="text-sm">文件浏览器 — 开发中</p>
          </div>
        )}
        {tab === "changes" && (
          <div className="tab-enter flex-1 flex items-center justify-center" style={{ color: "var(--text-tertiary)" }}>
            <p className="text-sm">Git 变更 — 开发中</p>
          </div>
        )}
      </div>

      <InputArea onSend={handleSend} disabled={!connected || !activeSession} />
      <StatusBar workspace={workspace} />
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
