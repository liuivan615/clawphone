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

export function LeftDrawer({
  threads,
  activeThreadId,
  onSelectThread,
  onNewThread,
  onThemeChange,
  theme,
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

        {/* Theme icon (decorative) */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--text-tertiary)" className="shrink-0">
          <path d="M8 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-1 0v-1A.5.5 0 0 1 8 1zM8 4.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/>
        </svg>
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

      {/* Theme selector */}
      <div
        className="shrink-0 px-3 py-2 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="text-[10px] font-medium px-2 mb-1.5" style={{ color: "var(--text-tertiary)" }}>主题</div>
        <div className="flex flex-wrap gap-1">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => onThemeChange(t.value)}
              className="px-2 py-1 rounded-md text-[10px] font-medium btn-press transition-all"
              style={{
                background: theme === t.value ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
                color: theme === t.value ? "var(--accent-cyan)" : "var(--text-tertiary)",
                border: theme === t.value ? "1px solid var(--accent-cyan-mid)" : "1px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
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
