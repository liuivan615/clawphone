import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

interface Props {
  workspace: string;
  onClose?: () => void;
}

export function RightDrawer({ workspace, onClose }: Props) {
  const [files, setFiles] = useState<GitFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [totalAdd, setTotalAdd] = useState(0);
  const [totalDel, setTotalDel] = useState(0);

  const fetchStatus = useCallback(async () => {
    if (!workspace) {
      setFiles([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/git/status?cwd=${encodeURIComponent(workspace)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      const data = await res.json();
      if (data.error) {
        setFiles([]);
        setTotalAdd(0);
        setTotalDel(0);
        setError(data.error);
      } else {
        setFiles(data.files || []);
        setTotalAdd(data.totalAdditions || 0);
        setTotalDel(data.totalDeletions || 0);
      }
    } catch {
      setFiles([]);
      setTotalAdd(0);
      setTotalDel(0);
      setError("无法获取 Git 状态");
    } finally {
      setLoading(false);
    }
  }, [workspace]);

  useEffect(() => {
    fetchStatus();
    // Refresh every 10s
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const loadDiff = useCallback(async (path: string) => {
    setFileDiff("加载中...");
    try {
      const res = await fetch(
        `/api/git/diff?cwd=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&mode=all`,
        { headers: { Authorization: `Bearer ${api.token}` } }
      );
      const data = await res.json();
      setFileDiff(data.error ? `（无法获取差异: ${data.error}）` : data.diff || "（无差异）");
    } catch {
      setFileDiff("加载失败");
    }
  }, [workspace]);

  const handleExpand = (path: string) => {
    if (expandedFile === path) {
      setExpandedFile(null);
    } else {
      setExpandedFile(path);
      loadDiff(path);
    }
  };

  const handleStageAll = async () => {
    await fetch("/api/git/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.token}` },
      body: JSON.stringify({ cwd: workspace, all: true }),
    });
    fetchStatus();
  };

  const STATUS_LABELS: Record<string, string> = {
    M: "M", A: "A", D: "D", "??": "U", R: "R",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            工作区更改
          </span>
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
            style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}
          >
            {files.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={fetchStatus}
            className="w-7 h-7 flex items-center justify-center rounded-md btn-press"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M1 6a5 5 0 019.3-2.5M11 6a5 5 0 01-9.3 2.5" />
              <path d="M10.5 1v2.5H8M1.5 11V8.5H4" />
            </svg>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="xl:hidden w-7 h-7 flex items-center justify-center rounded-md btn-press"
              style={{ color: "var(--text-tertiary)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M3 3l8 8M11 3l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="spinner" />
          </div>
        ) : error ? (
          <div className="px-4 py-8 text-xs leading-relaxed" style={{ color: "var(--accent-red)" }}>
            {error}
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: "var(--text-tertiary)" }}>
            暂无变更
          </div>
        ) : (
          files.map((file) => {
            const isExpanded = expandedFile === file.path;
            const fileName = file.path.split("/").pop() || file.path;
            return (
              <div key={file.path}>
                <div
                  className="flex items-center gap-2 px-3 py-2 border-b cursor-pointer"
                  style={{
                    borderColor: "var(--border-subtle)",
                    background: isExpanded ? "var(--bg-hover)" : "transparent",
                  }}
                  onClick={() => handleExpand(file.path)}
                >
                  <span
                    className="text-[10px] w-4 text-center font-bold shrink-0"
                    style={{
                      color:
                        file.status === "??" || file.status === "A" ? "var(--diff-add-text)" :
                        file.status === "D" ? "var(--diff-del-text)" :
                        "var(--accent-cyan)",
                    }}
                  >
                    {STATUS_LABELS[file.status] || file.status}
                  </span>
                  <span
                    className="text-xs truncate flex-1"
                    style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
                    title={file.path}
                  >
                    {fileName}
                  </span>
                  {file.staged && (
                    <span className="text-[9px] px-1 rounded" style={{ background: "var(--accent-green-dim)", color: "var(--accent-green)" }}>
                      已暂存
                    </span>
                  )}
                </div>

                {/* Inline diff */}
                {isExpanded && (
                  <div
                    className="px-2 py-2 text-[11px] leading-relaxed overflow-x-auto"
                    style={{
                      background: "var(--bg-primary)",
                      fontFamily: "var(--font-mono)",
                      maxHeight: "300px",
                      overflowY: "auto",
                      borderBottom: "1px solid var(--border-subtle)",
                    }}
                  >
                    {fileDiff.split("\n").map((line, i) => {
                      let color = "var(--text-secondary)";
                      let bg = "transparent";
                      if (line.startsWith("+") && !line.startsWith("+++")) {
                        color = "var(--diff-add-text)"; bg = "var(--diff-add-bg)";
                      } else if (line.startsWith("-") && !line.startsWith("---")) {
                        color = "var(--diff-del-text)"; bg = "var(--diff-del-bg)";
                      } else if (line.startsWith("@@")) {
                        color = "var(--accent-cyan)";
                      }
                      return (
                        <div key={i} style={{ color, background: bg }} className="whitespace-pre">{line}</div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {!error && files.length > 0 && (
        <div className="shrink-0 p-3 border-t space-y-2" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="text-[11px] text-center" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            {files.length} 个文件 &middot;{" "}
            <span style={{ color: "var(--diff-add-text)" }}>+{totalAdd}</span>{" "}
            <span style={{ color: "var(--diff-del-text)" }}>-{totalDel}</span>
          </div>
          <button
            onClick={handleStageAll}
            className="w-full py-2 rounded-lg text-xs font-medium btn-press"
            style={{ background: "var(--accent-cyan)", color: "var(--text-inverse)" }}
          >
            暂存全部
          </button>
        </div>
      )}
    </div>
  );
}
