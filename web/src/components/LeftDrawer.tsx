import { useMemo, useState } from "react";
import type { HistoryThreadState } from "../lib/types";
import type { WorkspaceHistoryEntry } from "../lib/workspace-history";

interface ActiveSession {
  id: string;
  workspace: string;
  title: string;
  status: "starting" | "running" | "closed" | "error";
  turnActive: boolean;
  active: boolean;
  timeAgo: string;
}

interface HistoryThreadEntry {
  id: string;
  title: string;
  preview: string;
  workspace: string;
  updatedAt: number;
  timeAgo: string;
  active: boolean;
  state: HistoryThreadState;
  hasSnapshot: boolean;
  resumeReason?: string;
}

interface Props {
  activeSessions: ActiveSession[];
  projectHistory: WorkspaceHistoryEntry[];
  historyThreads: HistoryThreadEntry[];
  activeHistoryThreadId?: string | null;
  workspace?: string;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onSelectHistoryThread: (id: string) => void;
  onNewThread: () => void;
  onSwitchWorkspace?: (path: string) => void;
  onThemeChange: (theme: string) => void;
  theme: string;
}

const THEMES = [
  { value: "dark", label: "默认深色" },
  { value: "light", label: "浅色" },
  { value: "one-dark", label: "One Dark" },
  { value: "dracula", label: "Dracula" },
  { value: "github-dark", label: "GitHub Dark" },
];

function getWorkspaceName(workspace: string): string {
  return workspace.split("\\").pop() || workspace || "未知工作区";
}

function getHistoryStateBadge(state: HistoryThreadState) {
  switch (state) {
    case "resumable":
      return {
        label: "可恢复",
        background: "var(--accent-cyan-dim)",
        color: "var(--accent-cyan)",
      };
    case "snapshot_only":
      return {
        label: "快照",
        background: "var(--accent-amber-dim)",
        color: "var(--accent-amber)",
      };
    default:
      return {
        label: "元数据",
        background: "var(--bg-tertiary)",
        color: "var(--text-tertiary)",
      };
  }
}

export function LeftDrawer({
  activeSessions,
  projectHistory,
  historyThreads,
  activeHistoryThreadId,
  workspace,
  onSelectSession,
  onCloseSession,
  onSelectHistoryThread,
  onNewThread,
  onSwitchWorkspace,
  onThemeChange,
  theme,
}: Props) {
  const [search, setSearch] = useState("");
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);

  const filteredThreads = useMemo(() => {
    return historyThreads.filter((thread) => {
      if (workspace && thread.workspace && thread.workspace !== workspace) {
        return false;
      }
      if (!search.trim()) return true;

      const haystack = [thread.title, thread.preview, thread.workspace].join("\n").toLowerCase();
      return haystack.includes(search.trim().toLowerCase());
    });
  }, [historyThreads, search, workspace]);

  const groupedThreads = useMemo(() => {
    return filteredThreads.reduce<Record<string, HistoryThreadEntry[]>>((acc, thread) => {
      const key = thread.workspace || "未知工作区";
      if (!acc[key]) acc[key] = [];
      acc[key].push(thread);
      return acc;
    }, {});
  }, [filteredThreads]);

  const currentDirName = workspace ? getWorkspaceName(workspace) : "选择工作区";

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-3 pt-3 pb-1">
        <button
          onClick={() => setShowWorkspacePicker((value) => !value)}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left btn-press"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--accent-cyan)" className="shrink-0">
            <path d="M1 2.5A1.5 1.5 0 012.5 1h2.672a1.5 1.5 0 011.06.44l.597.596a.5.5 0 00.354.147H11.5A1.5 1.5 0 0113 3.5V11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 11V2.5z" />
          </svg>
          <span className="text-xs font-medium flex-1 truncate" style={{ color: "var(--text-primary)" }}>
            {currentDirName}
          </span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            style={{ transform: showWorkspacePicker ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        </button>

        {showWorkspacePicker && (
          <div
            className="mt-1.5 rounded-lg overflow-hidden"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)" }}
          >
            {projectHistory.length === 0 ? (
              <div className="px-3 py-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                暂无工作区
              </div>
            ) : (
              projectHistory.map((entry) => {
                const isCurrent = entry.workspace === workspace;
                return (
                  <button
                    key={entry.workspace}
                    onClick={() => {
                      onSwitchWorkspace?.(entry.workspace);
                      setShowWorkspacePicker(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left"
                    style={{
                      background: isCurrent ? "var(--accent-cyan-dim)" : "transparent",
                      color: isCurrent ? "var(--accent-cyan)" : "var(--text-primary)",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill={isCurrent ? "var(--accent-cyan)" : "var(--text-tertiary)"}>
                      <path d="M1 2A1 1 0 012 1h2.172a1 1 0 01.707.293l.414.414A1 1 0 006 2h4a1 1 0 011 1v6.5a1 1 0 01-1 1H2a1 1 0 01-1-1V2z" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium truncate">
                        {entry.lastTitle || getWorkspaceName(entry.workspace)}
                      </div>
                      <div className="text-[9px] truncate" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                        {entry.workspace}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-2 shrink-0">
        <button
          onClick={onNewThread}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 1v10M1 6h10" />
          </svg>
          新线程
        </button>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="text-[10px] font-medium px-2 mb-1.5" style={{ color: "var(--text-tertiary)" }}>
          活动会话
        </div>
        <div className="space-y-1">
          {activeSessions.length === 0 ? (
            <div className="px-2 py-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              暂无活动会话
            </div>
          ) : (
            activeSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className="w-full text-left px-2 py-2 rounded-lg flex items-start gap-2"
                style={{
                  background: session.active ? "var(--accent-cyan-dim)" : "transparent",
                  borderLeft: session.active ? "2px solid var(--accent-cyan)" : "2px solid transparent",
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {session.status === "starting" || session.turnActive ? (
                    <svg width="12" height="12" viewBox="0 0 12 12" className="spinner-slow">
                      <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.3" strokeDasharray="16 12" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="4.5" stroke={session.active ? "var(--accent-cyan)" : "var(--text-tertiary)"} strokeWidth="1.2" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: session.active ? "var(--accent-cyan)" : "var(--text-primary)" }}>
                    {session.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[9px] truncate" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                      {getWorkspaceName(session.workspace)}
                    </span>
                    <span className="text-[9px] ml-auto" style={{ color: "var(--text-tertiary)" }}>
                      {session.timeAgo}
                    </span>
                  </div>
                </div>
                {session.status !== "starting" && (
                  <span
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseSession(session.id);
                    }}
                    className="text-[10px] px-1 rounded shrink-0"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="px-3 py-2 shrink-0">
        <div className="text-[10px] font-medium px-2 mb-1.5" style={{ color: "var(--text-tertiary)" }}>
          工作区
        </div>
        <div className="space-y-1">
          {projectHistory.length === 0 ? (
            <div className="px-2 py-2 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              暂无工作区
            </div>
          ) : (
            projectHistory.map((entry) => (
              <button
                key={entry.workspace}
                onClick={() => onSwitchWorkspace?.(entry.workspace)}
                className="w-full text-left px-2 py-2 rounded-lg"
                style={{
                  background: entry.workspace === workspace ? "var(--bg-hover)" : "transparent",
                }}
              >
                <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {entry.lastTitle || getWorkspaceName(entry.workspace)}
                </div>
                <div className="text-[9px] truncate mt-0.5" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
                  {entry.workspace}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <div className="px-3 py-2 shrink-0">
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="搜索电脑历史..."
          className="w-full h-8 px-3 rounded-lg text-xs border-0 outline-none"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-ui)",
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-2 py-1 text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          电脑历史
        </div>

        {Object.entries(groupedThreads).map(([groupWorkspace, items]) => (
          <div key={groupWorkspace} className="mb-3">
            <div className="flex items-center gap-1.5 px-2 py-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--text-tertiary)" className="shrink-0">
                <path d="M1 2a1 1 0 011-1h2.172a1 1 0 01.707.293l.414.414A1 1 0 006 2h4a1 1 0 011 1v6.5a1 1 0 01-1 1H2a1 1 0 01-1-1V2z" />
              </svg>
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-tertiary)" }}>
                {getWorkspaceName(groupWorkspace)}
              </span>
            </div>

            {items.map((thread) => {
              const badge = getHistoryStateBadge(thread.state);
              return (
                <button
                  key={thread.id}
                  onClick={() => onSelectHistoryThread(thread.id)}
                  className="w-full text-left px-2 py-2 rounded-lg mb-1"
                  style={{
                    background: thread.active || activeHistoryThreadId === thread.id ? "var(--accent-cyan-dim)" : "transparent",
                    borderLeft:
                      thread.active || activeHistoryThreadId === thread.id
                        ? "2px solid var(--accent-cyan)"
                        : "2px solid transparent",
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>
                        {thread.title || "未命名"}
                      </div>
                      <div className="text-[10px] mt-0.5 line-clamp-2" style={{ color: "var(--text-tertiary)" }}>
                        {thread.preview || thread.resumeReason || "没有可预览的历史内容。"}
                      </div>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: badge.background, color: badge.color }}
                    >
                      {badge.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>
                      {thread.timeAgo}
                    </span>
                    {thread.hasSnapshot && (
                      <span className="text-[9px]" style={{ color: "var(--accent-cyan)" }}>
                        可预览
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ))}

        {filteredThreads.length === 0 && (
          <div className="text-center py-12 text-xs" style={{ color: "var(--text-tertiary)" }}>
            暂无电脑历史
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 py-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="text-[10px] font-medium px-2 mb-1.5" style={{ color: "var(--text-tertiary)" }}>
          主题
        </div>
        <div className="flex flex-wrap gap-1">
          {THEMES.map((entry) => (
            <button
              key={entry.value}
              onClick={() => onThemeChange(entry.value)}
              className="px-2 py-1 rounded-md text-[10px] font-medium btn-press transition-all"
              style={{
                background: theme === entry.value ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
                color: theme === entry.value ? "var(--accent-cyan)" : "var(--text-tertiary)",
                border: theme === entry.value ? "1px solid var(--accent-cyan-mid)" : "1px solid transparent",
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
