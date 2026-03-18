import { useState, useEffect, useRef } from "react";
import type { CommandCallItem } from "../lib/conversation-types";

interface Props {
  item: CommandCallItem;
  onApprove?: (requestId: number) => void;
  onDeny?: (requestId: number) => void;
}

const STATUS_LABELS: Record<string, string> = {
  pending: "等待审批",
  approved: "已允许",
  denied: "已拒绝",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
};

export function CommandCallCard({ item, onApprove, onDeny }: Props) {
  const [expanded, setExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevStatus = useRef(item.status);

  // Auto-collapse when completed/failed
  useEffect(() => {
    if (
      (item.status === "completed" || item.status === "failed" || item.status === "denied") &&
      prevStatus.current !== item.status
    ) {
      // Delay collapse slightly so user sees the result flash
      const timer = setTimeout(() => setExpanded(false), 600);
      return () => clearTimeout(timer);
    }
    prevStatus.current = item.status;
  }, [item.status]);

  const isPending = item.status === "pending";
  const isRunning = item.status === "running";
  const isCompleted = item.status === "completed";
  const isFailed = item.status === "failed";
  const isDenied = item.status === "denied";

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${isPending ? "var(--accent-amber-mid)" : "var(--border-default)"}`,
        opacity: isDenied ? 0.6 : 1,
        transition: "opacity 0.3s ease, border-color 0.3s ease",
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Icon */}
        <div
          className="w-6 h-6 flex items-center justify-center rounded-md shrink-0"
          style={{
            background: isPending ? "var(--accent-amber-dim)" : "var(--bg-tertiary)",
            color: isPending ? "var(--accent-amber)" : "var(--text-secondary)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <polyline points="4,2 4,12" />
            <polyline points="4,4 10,4 10,8 4,8" />
          </svg>
        </div>

        <span
          className="text-xs font-semibold"
          style={{ color: "var(--text-secondary)", fontFamily: "var(--font-ui)" }}
        >
          Bash
        </span>

        {/* Status badge */}
        {!isPending && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              background: isCompleted
                ? "var(--accent-green-dim)"
                : isFailed || isDenied
                ? "var(--accent-red-dim)"
                : isRunning
                ? "var(--accent-cyan-dim)"
                : "var(--bg-tertiary)",
              color: isCompleted
                ? "var(--accent-green)"
                : isFailed || isDenied
                ? "var(--accent-red)"
                : isRunning
                ? "var(--accent-cyan)"
                : "var(--text-tertiary)",
              transition: "all 0.3s ease",
            }}
          >
            {STATUS_LABELS[item.status] || item.status}
          </span>
        )}

        {/* Duration */}
        {item.durationMs !== null && (
          <span className="text-[10px] ml-auto" style={{ color: "var(--text-tertiary)" }}>
            {item.durationMs < 1000 ? `${item.durationMs}ms` : `${(item.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}

        {/* Expand chevron */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"
          style={{
            transition: "transform 0.35s cubic-bezier(0.25, 1, 0.5, 1)",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            marginLeft: item.durationMs !== null ? "0" : "auto",
          }}
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </div>

      {/* Collapsible content with smooth animation */}
      <div
        ref={contentRef}
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 0.4s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          {/* Command */}
          <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
            <pre
              className="text-xs leading-relaxed whitespace-pre-wrap break-all"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
            >
              {item.command}
            </pre>
          </div>

          {/* Output */}
          {item.output && (
            <div
              className="px-3 py-2 text-xs leading-relaxed overflow-x-auto"
              style={{
                background: "var(--bg-primary)",
                borderTop: "1px solid var(--border-subtle)",
                color: "var(--text-secondary)",
                fontFamily: "var(--font-mono)",
                maxHeight: "300px",
                overflowY: "auto",
              }}
            >
              <pre className="whitespace-pre-wrap break-all">{item.output}</pre>
            </div>
          )}

          {/* Spinner for running */}
          {isRunning && !item.output && (
            <div className="px-3 py-2" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <div className="flex items-center gap-2">
                <span className="spinner" />
                <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>执行中...</span>
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}
