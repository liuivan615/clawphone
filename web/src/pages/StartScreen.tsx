import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface DirEntry {
  name: string;
  path: string;
  isGitRepo: boolean;
}

interface Props {
  connected: boolean;
  onStart: (workspace: string, prompt?: string) => void;
  lastError?: string | null;
}

export function StartScreen({ connected, onStart, lastError }: Props) {
  const [workspace, setWorkspace] = useState("");
  const [prompt, setPrompt] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [browsePath, setBrowsePath] = useState("D:\\");
  const [dirs, setDirs] = useState<DirEntry[]>([]);
  const [drives, setDrives] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Load saved recent dirs from localStorage
  const [recentDirs, setRecentDirs] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("clawphone_recent_dirs") || "[]");
    } catch {
      return [];
    }
  });

  const saveRecent = useCallback((dir: string) => {
    setRecentDirs((prev) => {
      const updated = [dir, ...prev.filter((d) => d !== dir)].slice(0, 10);
      localStorage.setItem("clawphone_recent_dirs", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Browse directories
  const loadDir = useCallback(async (path: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/browse?path=${encodeURIComponent(path)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      const data = await res.json();
      setBrowsePath(data.path);
      setDirs(data.dirs || []);
    } catch {
      setDirs([]);
    }
    setLoading(false);
  }, []);

  // Load drives on first browse
  const openBrowser = useCallback(async () => {
    setBrowsing(true);
    if (drives.length === 0) {
      try {
        const res = await fetch("/api/drives", {
          headers: { Authorization: `Bearer ${api.token}` },
        });
        const data = await res.json();
        setDrives(data.drives || []);
      } catch {
        setDrives(["C:\\", "D:\\"]);
      }
    }
    await loadDir(browsePath);
  }, [drives, browsePath, loadDir]);

  // Navigate up
  const goUp = useCallback(() => {
    const parts = browsePath.replace(/\\$/, "").split("\\");
    if (parts.length <= 1) return;
    parts.pop();
    const parent = parts.join("\\") + "\\";
    loadDir(parent);
  }, [browsePath, loadDir]);

  // Select directory and close browser
  const selectDir = useCallback((path: string) => {
    setWorkspace(path);
    setBrowsing(false);
    saveRecent(path);
  }, [saveRecent]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace.trim()) return;
    saveRecent(workspace.trim());
    onStart(workspace.trim(), prompt.trim() || undefined);
  };

  // Auto-select if only one recent
  useEffect(() => {
    if (!workspace && recentDirs.length > 0) {
      // Don't auto-select, let user choose
    }
  }, []);

  if (browsing) {
    return (
      <div className="flex flex-col h-full page-enter">
        {/* Browser header */}
        <div
          className="flex items-center gap-2 px-3 h-12 shrink-0 border-b"
          style={{ background: "var(--bg-secondary)", borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={() => setBrowsing(false)}
            className="w-8 h-8 flex items-center justify-center rounded-lg btn-press"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 4l-4 4 4 4" />
            </svg>
          </button>
          <h2 className="text-sm font-semibold flex-1 truncate" style={{ color: "var(--text-primary)" }}>
            选择文件夹
          </h2>
          <button
            onClick={() => selectDir(browsePath)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-press"
            style={{ background: "var(--accent-cyan)", color: "var(--text-inverse)" }}
          >
            选择此目录
          </button>
        </div>

        {/* Current path + up button */}
        <div
          className="flex items-center gap-2 px-3 py-2 border-b"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <button
            onClick={goUp}
            className="w-7 h-7 flex items-center justify-center rounded-md btn-press shrink-0"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M6 9V3M3 5.5L6 3l3 2.5" />
            </svg>
          </button>
          <span
            className="text-xs truncate flex-1"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
          >
            {browsePath}
          </span>
        </div>

        {/* Drive buttons */}
        {drives.length > 1 && (
          <div className="flex gap-1.5 px-3 py-2 border-b" style={{ borderColor: "var(--border-subtle)" }}>
            {drives.map((d) => (
              <button
                key={d}
                onClick={() => loadDir(d)}
                className="px-2.5 py-1 rounded-md text-xs font-medium btn-press"
                style={{
                  background: browsePath.startsWith(d) ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
                  color: browsePath.startsWith(d) ? "var(--accent-cyan)" : "var(--text-secondary)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {d.replace("\\", "")}
              </button>
            ))}
          </div>
        )}

        {/* Directory list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <span className="spinner" />
            </div>
          ) : dirs.length === 0 ? (
            <div className="py-8 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
              没有子目录
            </div>
          ) : (
            dirs.map((d) => (
              <div
                key={d.path}
                className="flex items-center gap-2.5 px-3 py-2.5 border-b cursor-pointer"
                style={{ borderColor: "var(--border-subtle)" }}
                onClick={() => loadDir(d.path)}
                onDoubleClick={() => selectDir(d.path)}
              >
                {/* Folder icon */}
                <svg width="16" height="16" viewBox="0 0 16 16" fill={d.isGitRepo ? "var(--accent-cyan)" : "var(--text-tertiary)"} className="shrink-0">
                  <path d="M1.5 3A1.5 1.5 0 013 1.5h3.172a1.5 1.5 0 011.06.44l.829.828a.5.5 0 00.353.147H13A1.5 1.5 0 0114.5 4.5v7.5a1.5 1.5 0 01-1.5 1.5H3A1.5 1.5 0 011.5 12V3z" />
                </svg>
                <span
                  className="text-sm flex-1 truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {d.name}
                </span>
                {d.isGitRepo && (
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                    style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)" }}
                  >
                    Git
                  </span>
                )}
                {/* Select button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    selectDir(d.path);
                  }}
                  className="px-2 py-1 rounded-md text-[10px] font-medium btn-press shrink-0"
                  style={{ background: "var(--bg-tertiary)", color: "var(--accent-cyan)" }}
                >
                  选择
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full px-5">
      <div className="w-full max-w-md space-y-5 page-enter">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="relative inline-block">
            <div
              className="logo-breathe absolute inset-0 blur-2xl rounded-full"
              style={{ background: "var(--accent-cyan)", opacity: 0.15 }}
            />
            <h1
              className="relative text-3xl font-bold tracking-tight"
              style={{ color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}
            >
              ClawPhone
            </h1>
          </div>
          <p className="text-sm mt-2" style={{ color: "var(--text-tertiary)" }}>
            在你的项目上启动 Codex
          </p>
        </div>

        {/* Selected workspace display */}
        {workspace ? (
          <div
            className="flex items-center gap-2 px-4 py-3 rounded-xl border"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--accent-cyan-mid)",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="var(--accent-cyan)" className="shrink-0">
              <path d="M1.5 3A1.5 1.5 0 013 1.5h3.172a1.5 1.5 0 011.06.44l.829.828a.5.5 0 00.353.147H13A1.5 1.5 0 0114.5 4.5v7.5a1.5 1.5 0 01-1.5 1.5H3A1.5 1.5 0 011.5 12V3z" />
            </svg>
            <span
              className="text-sm flex-1 truncate"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
            >
              {workspace}
            </span>
            <button
              onClick={() => setWorkspace("")}
              className="text-xs btn-press"
              style={{ color: "var(--text-tertiary)" }}
            >
              更换
            </button>
          </div>
        ) : (
          <>
            {/* Browse button */}
            <button
              onClick={openBrowser}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed btn-press"
              style={{
                borderColor: "var(--border-strong)",
                color: "var(--text-secondary)",
                background: "var(--bg-secondary)",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M2 4.5A1.5 1.5 0 013.5 3h3.379a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H14.5A1.5 1.5 0 0116 6.5V13a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 012 13V4.5z" />
                <path d="M9 8v4M7 10h4" />
              </svg>
              <span className="text-sm font-medium">添加项目文件夹</span>
            </button>

            {/* Recent directories */}
            {recentDirs.length > 0 && (
              <div>
                <div className="text-xs font-medium mb-2" style={{ color: "var(--text-tertiary)" }}>
                  最近使用
                </div>
                <div className="space-y-1">
                  {recentDirs.map((dir) => (
                    <button
                      key={dir}
                      onClick={() => {
                        setWorkspace(dir);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left btn-press"
                      style={{ background: "var(--bg-secondary)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--text-tertiary)" className="shrink-0">
                        <path d="M1 2.5A1.5 1.5 0 012.5 1h2.672a1.5 1.5 0 011.06.44l.597.596a.5.5 0 00.354.147H11.5A1.5 1.5 0 0113 3.5V11a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 011 11V2.5z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                          {dir.split("\\").pop() || dir}
                        </div>
                        <div
                          className="text-[10px] truncate"
                          style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}
                        >
                          {dir}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Prompt */}
        {workspace && (
          <div>
            <label
              className="block text-xs font-medium mb-2"
              style={{ color: "var(--text-secondary)" }}
            >
              初始提示
              <span style={{ color: "var(--text-tertiary)" }}>（可选）</span>
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="例如：修复 auth.ts 中的认证问题"
              rows={3}
              autoFocus
              className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none"
              style={{
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                borderColor: "var(--border-default)",
                fontFamily: "var(--font-ui)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-cyan)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
            />
          </div>
        )}

        {/* Error from last session */}
        {lastError && (
          <div
            className="px-3.5 py-2.5 rounded-xl text-xs font-medium"
            style={{
              background: "var(--accent-red-dim)",
              color: "var(--accent-red)",
              border: "1px solid rgba(248, 113, 113, 0.2)",
            }}
          >
            {lastError}
          </div>
        )}

        {/* Launch button */}
        {workspace && (
          <button
            onClick={() => handleStart({ preventDefault: () => {} } as React.FormEvent)}
            disabled={!connected || !workspace.trim()}
            className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 btn-glow btn-press"
            style={{
              background: "var(--accent-cyan)",
              color: "var(--text-inverse)",
            }}
          >
            {connected ? "启动 Codex" : "连接中..."}
          </button>
        )}
      </div>
    </div>
  );
}
