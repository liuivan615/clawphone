import { useState } from "react";
import type { FileChangeItem } from "../lib/conversation-types";

interface Props {
  item: FileChangeItem;
  onApprove?: (requestId: number) => void;
  onDeny?: (requestId: number) => void;
}

const KIND_LABELS: Record<string, string> = {
  add: "新增",
  delete: "删除",
  update: "修改",
};

export function FileChangeCard({ item, onApprove, onDeny }: Props) {
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  const isPending = item.status === "pending";
  const isDenied = item.status === "denied";

  // Count additions/deletions across all changes
  const stats = item.changes.reduce(
    (acc, c) => {
      const lines = c.diff.split("\n");
      for (const line of lines) {
        if (line.startsWith("+") && !line.startsWith("+++")) acc.add++;
        if (line.startsWith("-") && !line.startsWith("---")) acc.del++;
      }
      return acc;
    },
    { add: 0, del: 0 }
  );

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${isPending ? "var(--accent-amber-mid)" : "var(--border-default)"}`,
        opacity: isDenied ? 0.6 : 1,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 1H3.5A1.5 1.5 0 002 2.5v9A1.5 1.5 0 003.5 13h7a1.5 1.5 0 001.5-1.5V5L8 1z" />
          <path d="M8 1v4h4" />
        </svg>
        <span className="text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>
          {item.changes.length} 个文件已更改
        </span>
        {stats.add > 0 && (
          <span className="text-[10px] font-mono" style={{ color: "var(--diff-add-text)" }}>+{stats.add}</span>
        )}
        {stats.del > 0 && (
          <span className="text-[10px] font-mono" style={{ color: "var(--diff-del-text)" }}>-{stats.del}</span>
        )}
      </div>

      {/* File list */}
      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {item.changes.slice(0, 8).map((change) => {
          const isExpanded = expandedFile === change.path;
          const fileName = change.path.split("/").pop() || change.path;

          const lines = change.diff.split("\n");
          const fileAdd = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
          const fileDel = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;

          return (
            <div key={change.path}>
              <div
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer"
                onClick={() => setExpandedFile(isExpanded ? null : change.path)}
                style={{ background: isExpanded ? "var(--bg-hover)" : "transparent" }}
              >
                <span
                  className="text-[10px] px-1 rounded font-medium"
                  style={{
                    background:
                      change.kind === "add" ? "var(--diff-add-bg)" :
                      change.kind === "delete" ? "var(--diff-del-bg)" :
                      "var(--accent-cyan-dim)",
                    color:
                      change.kind === "add" ? "var(--diff-add-text)" :
                      change.kind === "delete" ? "var(--diff-del-text)" :
                      "var(--accent-cyan)",
                  }}
                >
                  {KIND_LABELS[change.kind] || change.kind}
                </span>
                <span
                  className="text-xs truncate flex-1"
                  style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
                  title={change.path}
                >
                  {fileName}
                </span>
                {fileAdd > 0 && (
                  <span className="text-[10px] font-mono" style={{ color: "var(--diff-add-text)" }}>+{fileAdd}</span>
                )}
                {fileDel > 0 && (
                  <span className="text-[10px] font-mono" style={{ color: "var(--diff-del-text)" }}>-{fileDel}</span>
                )}
              </div>

              {isExpanded && change.diff && (
                <div
                  className="px-3 py-2 text-[11px] leading-relaxed overflow-x-auto"
                  style={{
                    background: "var(--bg-primary)",
                    fontFamily: "var(--font-mono)",
                    maxHeight: "250px",
                    overflowY: "auto",
                  }}
                >
                  {change.diff.split("\n").map((line, i) => {
                    let color = "var(--text-secondary)";
                    let bg = "transparent";
                    if (line.startsWith("+")) {
                      color = "var(--diff-add-text)";
                      bg = "var(--diff-add-bg)";
                    } else if (line.startsWith("-")) {
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
        {item.changes.length > 8 && (
          <div className="px-3 py-1.5 text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            ...还有 {item.changes.length - 8} 个文件
          </div>
        )}
      </div>

      {/* Approval buttons */}
      {isPending && item.requestId !== undefined && (
        <div
          className="flex items-center gap-2 px-3 py-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={() => onDeny?.(item.requestId!)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--accent-red)",
              border: "1px solid var(--accent-red-dim)",
            }}
          >
            拒绝
          </button>
          <button
            onClick={() => onApprove?.(item.requestId!)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--accent-cyan)",
              color: "var(--text-inverse)",
            }}
          >
            允许
          </button>
        </div>
      )}
    </div>
  );
}
