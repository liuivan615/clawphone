import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface GitFile {
  path: string;
  status: string;
  staged: boolean;
}

interface GitStatus {
  branch: string;
  files: GitFile[];
  totalFiles: number;
  totalAdditions: number;
  totalDeletions: number;
  error?: string;
}

interface Props {
  workspace: string;
}

type CommitAction = "commit" | "commit-push" | "commit-pr";

export function ChangesView({ workspace }: Props) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [commitMsg, setCommitMsg] = useState("");
  const [includeUnstaged, setIncludeUnstaged] = useState(true);
  const [commitAction, setCommitAction] = useState<CommitAction>("commit");
  const [committing, setCommitting] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);
  const [commitResult, setCommitResult] = useState<string | null>(null);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<string>("");

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/git/status?cwd=${encodeURIComponent(workspace)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      const data = await res.json();
      setStatus(data);
    } catch {
      setStatus(null);
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const loadFileDiff = useCallback(async (path: string, mode: "working" | "staged" | "all" | "untracked") => {
    setFileDiff("加载中...");
    try {
      const res = await fetch(
        `/api/git/diff?cwd=${encodeURIComponent(workspace)}&path=${encodeURIComponent(path)}&mode=${mode}`,
        { headers: { Authorization: `Bearer ${api.token}` } }
      );
      const data = await res.json();
      setFileDiff(data.error ? `（无法获取差异: ${data.error}）` : data.diff || "（无差异）");
    } catch {
      setFileDiff("加载失败");
    }
  }, [workspace]);

  const handleExpandFile = useCallback((file: GitFile) => {
    if (expandedFile === file.path) {
      setExpandedFile(null);
    } else {
      setExpandedFile(file.path);
    }
  }, [expandedFile]);

  useEffect(() => {
    if (!expandedFile || !status) return;

    const expanded = status.files.find((file) => file.path === expandedFile);
    if (!expanded) return;

    const mode =
      expanded.status === "??"
        ? "untracked"
        : includeUnstaged
        ? "all"
        : expanded.staged
        ? "staged"
        : "working";

    void loadFileDiff(expanded.path, mode);
  }, [expandedFile, includeUnstaged, loadFileDiff, status]);

  const handleCommit = useCallback(async () => {
    setCommitting(true);
    setCommitResult(null);
    try {
      // Commit
      const commitRes = await fetch("/api/git/commit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${api.token}`,
        },
        body: JSON.stringify({
          cwd: workspace,
          message: commitMsg || undefined,
          includeUnstaged,
        }),
      });
      const commitData = await commitRes.json();

      if (commitData.error) {
        setCommitResult(`提交失败: ${commitData.error}`);
        setCommitting(false);
        return;
      }

      // Push if requested
      if (commitAction === "commit-push" || commitAction === "commit-pr") {
        const pushRes = await fetch("/api/git/push", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api.token}`,
          },
          body: JSON.stringify({ cwd: workspace }),
        });
        const pushData = await pushRes.json();
        if (pushData.error) {
          setCommitResult(`已提交 (${commitData.hash}) 但推送失败: ${pushData.error}`);
          setCommitting(false);
          fetchStatus();
          return;
        }
      }

      // Create PR if requested
      if (commitAction === "commit-pr") {
        const prRes = await fetch("/api/git/pr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${api.token}`,
          },
          body: JSON.stringify({
            cwd: workspace,
            title: commitMsg || undefined,
          }),
        });
        const prData = await prRes.json();
        if (prData.error) {
          setCommitResult(`已提交并推送 (${commitData.hash})，但创建 PR 失败: ${prData.error}`);
          setCommitting(false);
          fetchStatus();
          return;
        }
        setCommitResult(`已创建 PR: ${prData.url}`);
        setCommitMsg("");
        fetchStatus();
        setCommitting(false);
        return;
      }

      setCommitResult(
        commitAction === "commit"
          ? `已提交 ${commitData.hash}`
          : `已提交并推送 ${commitData.hash}`
      );
      setCommitMsg("");
      fetchStatus();
    } catch (err) {
      setCommitResult(`错误: ${err instanceof Error ? err.message : err}`);
    }
    setCommitting(false);
  }, [workspace, commitMsg, includeUnstaged, commitAction, fetchStatus]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="spinner" />
      </div>
    );
  }

  if (!status || status.error) {
    return (
      <div className="flex items-center justify-center h-full px-6">
        <p className="text-sm text-center" style={{ color: "var(--text-tertiary)" }}>
          {status?.error || "无法获取 Git 状态"}
        </p>
      </div>
    );
  }

  if (status.totalFiles === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" className="mb-3">
          <circle cx="16" cy="16" r="12" />
          <path d="M12 16l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>没有待提交的更改</p>
      </div>
    );
  }

  const STATUS_LABELS: Record<string, string> = {
    M: "修改",
    A: "新增",
    D: "删除",
    "??": "未跟踪",
    R: "重命名",
    U: "冲突",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Commit panel */}
      <div className="shrink-0 px-4 py-3 border-b" style={{ borderColor: "var(--border-subtle)" }}>
        {/* Header: branch + stats */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>提交更改</div>
          <div className="flex items-center gap-2 text-xs" style={{ fontFamily: "var(--font-mono)" }}>
            <span style={{ color: "var(--text-secondary)" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" className="inline mr-1">
                <circle cx="3" cy="2.5" r="1.2" /><circle cx="3" cy="7.5" r="1.2" /><circle cx="7" cy="5" r="1.2" />
                <path d="M3 3.7V6.3M4.2 7.1 5.8 5.6" />
              </svg>
              {status.branch}
            </span>
            <span style={{ color: "var(--text-tertiary)" }}>{status.totalFiles} 个文件</span>
            <span style={{ color: "var(--diff-add-text)" }}>+{status.totalAdditions}</span>
            <span style={{ color: "var(--diff-del-text)" }}>-{status.totalDeletions}</span>
          </div>
        </div>

        {/* Include unstaged toggle */}
        <label className="flex items-center gap-2 mb-3 cursor-pointer">
          <div
            className="w-9 h-5 rounded-full relative transition-colors"
            style={{ background: includeUnstaged ? "var(--accent-cyan)" : "var(--bg-tertiary)" }}
            onClick={() => setIncludeUnstaged((v) => !v)}
          >
            <div
              className="absolute top-0.5 w-4 h-4 rounded-full transition-transform"
              style={{
                background: "white",
                transform: includeUnstaged ? "translateX(18px)" : "translateX(2px)",
              }}
            />
          </div>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>包含取消暂存的更改</span>
        </label>

        {/* Commit message */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>提交消息</span>
          <button
            onClick={async () => {
              setGeneratingMsg(true);
              try {
                const res = await fetch("/api/git/ai-commit-msg", {
                  method: "POST",
                  headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.token}` },
                  body: JSON.stringify({ cwd: workspace }),
                });
                const data = await res.json();
                if (data.message) setCommitMsg(data.message);
              } catch { /* ignore */ }
              setGeneratingMsg(false);
            }}
            disabled={generatingMsg}
            className="text-[10px] px-2 py-0.5 rounded-md btn-press"
            style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)" }}
          >
            {generatingMsg ? "生成中..." : "AI 生成"}
          </button>
        </div>
        <textarea
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          placeholder="留空以自动生成提交消息"
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-xs border outline-none resize-none mb-3"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            borderColor: "var(--border-default)",
            fontFamily: "var(--font-ui)",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent-cyan)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border-default)")}
        />

        {/* Actions */}
        <div className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>后续步骤</div>
        <div className="space-y-1 mb-3">
          {([
            { value: "commit" as const, icon: "⊙", label: "提交", sub: "" },
            { value: "commit-push" as const, icon: "↑", label: "提交并推送", sub: "" },
            { value: "commit-pr" as const, icon: "◉", label: "提交并创建 PR", sub: "需要 GitHub CLI" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => setCommitAction(opt.value)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left"
              style={{
                background: commitAction === opt.value ? "var(--bg-hover)" : "transparent",
                color: "var(--text-primary)",
              }}
            >
              <span className="text-sm" style={{ color: "var(--text-tertiary)", width: "20px", textAlign: "center" }}>
                {opt.icon}
              </span>
              <div className="flex-1">
                <div className="text-xs font-medium">{opt.label}</div>
                {opt.sub && <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{opt.sub}</div>}
              </div>
              {commitAction === opt.value && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 7l3 3 5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>

        {/* Result message */}
        {commitResult && (
          <div
            className="px-3 py-2 rounded-lg text-xs mb-2"
            style={{
              background: commitResult.includes("失败") || commitResult.includes("错误")
                ? "var(--accent-red-dim)" : "var(--accent-green-dim)",
              color: commitResult.includes("失败") || commitResult.includes("错误")
                ? "var(--accent-red)" : "var(--accent-green)",
            }}
          >
            {commitResult}
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleCommit}
          disabled={committing}
          className="w-full py-2.5 rounded-lg text-xs font-semibold btn-press disabled:opacity-40"
          style={{ background: "var(--accent-cyan)", color: "var(--text-inverse)" }}
        >
          {committing ? "提交中..." : "继续"}
        </button>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {status.files.map((file) => {
          const isExpanded = expandedFile === file.path;
          const fileName = file.path.split("/").pop() || file.path;

          return (
            <div key={file.path}>
              <div
                className="flex items-center gap-2 px-4 py-2 border-b cursor-pointer"
                style={{ borderColor: "var(--border-subtle)", background: isExpanded ? "var(--bg-hover)" : "transparent" }}
                onClick={() => handleExpandFile(file)}
              >
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0"
                  style={{
                    background:
                      file.status === "??" || file.status === "A" ? "var(--diff-add-bg)" :
                      file.status === "D" ? "var(--diff-del-bg)" :
                      "var(--accent-cyan-dim)",
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
                <svg
                  width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"
                  style={{ transition: "transform 0.15s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                >
                  <path d="M2 3.5l3 3 3-3" />
                </svg>
              </div>

              {/* Inline diff */}
              {isExpanded && (
                <div
                  className="px-4 py-2 text-[11px] leading-relaxed overflow-x-auto"
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
                      color = "var(--diff-add-text)";
                      bg = "var(--diff-add-bg)";
                    } else if (line.startsWith("-") && !line.startsWith("---")) {
                      color = "var(--diff-del-text)";
                      bg = "var(--diff-del-bg)";
                    } else if (line.startsWith("@@")) {
                      color = "var(--accent-cyan)";
                    }
                    return (
                      <div key={i} style={{ color, background: bg }} className="whitespace-pre">
                        {line}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
