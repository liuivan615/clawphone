import { useState } from "react";

interface Thread {
  id: string;
  title: string;
  project: string;
  timeAgo: string;
  additions?: number;
  deletions?: number;
  active?: boolean;
}

interface Props {
  threads: Thread[];
  activeThreadId?: string;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onToggleTheme: () => void;
  isDark: boolean;
}

export function LeftDrawer({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onToggleTheme,
  isDark,
}: Props) {
  const [search, setSearch] = useState("");

  // Group threads by project
  const grouped = threads.reduce<Record<string, Thread[]>>((acc, t) => {
    if (!acc[t.project]) acc[t.project] = [];
    acc[t.project].push(t);
    return acc;
  }, {});

  const filtered = search
    ? threads.filter((t) =>
        t.title.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button
          onClick={onNewThread}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: "var(--accent-cyan-dim)",
            color: "var(--accent-cyan)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 1v10M1 6h10" />
          </svg>
          新线程
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg"
          style={{ color: "var(--text-tertiary)" }}
        >
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1zm0 11a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 12zm7-4a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1a.5.5 0 0 1 .5.5zM3 8a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1 0-1h1A.5.5 0 0 1 3 8zm9.95-3.54a.5.5 0 0 1 0 .71l-.71.7a.5.5 0 1 1-.7-.7l.7-.71a.5.5 0 0 1 .71 0zM4.46 11.54a.5.5 0 0 1 0 .71l-.7.7a.5.5 0 0 1-.71-.7l.7-.71a.5.5 0 0 1 .71 0zm8.49 1.41a.5.5 0 0 1-.71 0l-.7-.7a.5.5 0 0 1 .7-.71l.71.7a.5.5 0 0 1 0 .71zM4.46 4.46a.5.5 0 0 1-.71 0l-.7-.7a.5.5 0 1 1 .7-.71l.71.7a.5.5 0 0 1 0 .71zM8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 1a7 7 0 1 0 8.4 8.4A5.5 5.5 0 0 1 6 1z"/>
            </svg>
          )}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索线程..."
          className="w-full h-8 px-3 rounded-lg text-xs border-0 outline-none"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-ui)",
          }}
        />
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {filtered
          ? filtered.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                active={t.id === activeThreadId}
                onClick={() => onSelectThread(t.id)}
              />
            ))
          : Object.entries(grouped).map(([project, items]) => (
              <div key={project} className="mb-3">
                <div
                  className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}
                >
                  {project}
                </div>
                {items.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === activeThreadId}
                    onClick={() => onSelectThread(t.id)}
                  />
                ))}
              </div>
            ))}

        {threads.length === 0 && (
          <div
            className="text-center py-12 text-xs"
            style={{ color: "var(--text-tertiary)" }}
          >
            暂无线程
          </div>
        )}
      </div>

      {/* Settings */}
      <div
        className="shrink-0 px-3 py-2 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <button
          className="flex items-center gap-2 w-full px-2 py-2 rounded-lg text-xs transition-colors"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
            <circle cx="7" cy="7" r="2" />
            <path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1 2.8 11.2" />
          </svg>
          设置
        </button>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: Thread;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-2 py-2 rounded-lg mb-0.5 transition-colors"
      style={{
        background: active ? "var(--accent-cyan-dim)" : "transparent",
        borderLeft: active ? "2px solid var(--accent-cyan)" : "2px solid transparent",
      }}
    >
      <div
        className="text-xs font-medium truncate"
        style={{ color: active ? "var(--accent-cyan)" : "var(--text-primary)" }}
      >
        {thread.title}
      </div>
      <div className="flex items-center gap-2 mt-0.5">
        {(thread.additions !== undefined || thread.deletions !== undefined) && (
          <span className="text-[10px] font-mono" style={{ color: "var(--text-tertiary)" }}>
            {thread.additions !== undefined && (
              <span style={{ color: "var(--accent-green)" }}>+{thread.additions}</span>
            )}
            {thread.deletions !== undefined && (
              <span style={{ color: "var(--accent-red)" }}> -{thread.deletions}</span>
            )}
          </span>
        )}
        <span className="text-[10px] ml-auto" style={{ color: "var(--text-tertiary)" }}>
          {thread.timeAgo}
        </span>
      </div>
    </button>
  );
}
