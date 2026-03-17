import { useState } from "react";

interface Props {
  connected: boolean;
  onStart: (workspace: string, prompt?: string) => void;
  recentDirs?: string[];
  lastError?: string | null;
}

export function StartScreen({ connected, onStart, recentDirs = [], lastError }: Props) {
  const [workspace, setWorkspace] = useState("");
  const [prompt, setPrompt] = useState("");

  const defaultDirs = recentDirs.length > 0 ? recentDirs : [
    "D:\\clawd",
    "D:\\clawphone",
    "C:\\Users\\IVAN\\Desktop",
  ];

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace.trim()) return;
    onStart(workspace.trim(), prompt.trim() || undefined);
  };

  return (
    <div className="flex items-center justify-center h-full px-5">
      <form onSubmit={handleStart} className="w-full max-w-md space-y-5 page-enter">
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

        {/* Workspace */}
        <div>
          <label
            className="block text-xs font-medium mb-2"
            style={{ color: "var(--text-secondary)" }}
          >
            工作目录
          </label>
          <input
            type="text"
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            placeholder="D:\你的项目"
            autoFocus
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-colors"
            style={{
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              borderColor: "var(--border-default)",
              fontFamily: "var(--font-mono)",
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-cyan)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
          />
        </div>

        {/* Quick dirs */}
        <div className="flex flex-wrap gap-2">
          {defaultDirs.map((dir) => (
            <button
              key={dir}
              type="button"
              onClick={() => setWorkspace(dir)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: workspace === dir ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
                color: workspace === dir ? "var(--accent-cyan)" : "var(--text-tertiary)",
                fontFamily: "var(--font-mono)",
                borderLeft: workspace === dir ? "2px solid var(--accent-cyan)" : "2px solid transparent",
              }}
            >
              {dir.split("\\").pop() || dir}
            </button>
          ))}
        </div>

        {/* Prompt */}
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
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none resize-none transition-colors"
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
        <button
          type="submit"
          disabled={!connected || !workspace.trim()}
          className="w-full py-3.5 rounded-xl text-sm font-semibold disabled:opacity-40 btn-glow btn-press"
          style={{
            background: "var(--accent-cyan)",
            color: "var(--text-inverse)",
          }}
        >
          {connected ? "启动 Codex" : "连接中..."}
        </button>
      </form>
    </div>
  );
}
