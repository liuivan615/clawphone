import { useState } from "react";
import type { TaskUpdateItem } from "../lib/conversation-types";

interface Props {
  item: TaskUpdateItem;
}

export function TaskUpdateCard({ item }: Props) {
  const [expanded, setExpanded] = useState(true);

  const total = item.steps.length;
  const completed = item.steps.filter((s) => s.status === "completed").length;

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-default)",
      }}
    >
      {/* Header — clickable to collapse */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
        style={{ borderBottom: expanded ? "1px solid var(--border-subtle)" : "none" }}
      >
        {/* Icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" className="shrink-0">
          <path d="M3 4h8M3 7h5M3 10h6" />
          <circle cx="11" cy="7" r="1.5" fill="none" />
          <circle cx="11" cy="10" r="1.5" fill="none" />
        </svg>

        <span className="text-xs font-medium flex-1" style={{ color: "var(--text-primary)" }}>
          共 {total} 个任务，已经完成 {completed} 个
        </span>

        {/* Progress bar (mini) */}
        {total > 0 && (
          <div
            className="w-12 h-1.5 rounded-full overflow-hidden shrink-0"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${(completed / total) * 100}%`,
                background: completed === total ? "var(--accent-green)" : "var(--accent-cyan)",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        )}

        {/* Expand/collapse */}
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"
          className="shrink-0"
          style={{ transition: "transform 0.15s ease", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}
        >
          <path d="M3 4.5l3 3 3-3" />
        </svg>
      </div>

      {/* Task list */}
      {expanded && item.steps.length > 0 && (
        <div className="px-3 py-2 space-y-1.5">
          {item.steps.map((step, index) => {
            const isCompleted = step.status === "completed";
            const isInProgress = step.status === "inProgress";

            return (
              <div key={`${item.id}-${index}`} className="flex items-start gap-2.5">
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="var(--accent-green)">
                      <circle cx="7" cy="7" r="6" />
                      <path d="M4.5 7l2 2 3.5-3.5" stroke="var(--bg-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  ) : isInProgress ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" className="spinner-slow">
                      <circle cx="7" cy="7" r="5.5" fill="none" stroke="var(--accent-cyan)" strokeWidth="1.5" strokeDasharray="20 14" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <circle cx="7" cy="7" r="5.5" stroke="var(--text-tertiary)" strokeWidth="1.2" />
                    </svg>
                  )}
                </div>

                {/* Step number + text */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-xs leading-relaxed"
                    style={{
                      color: isCompleted ? "var(--text-tertiary)" : isInProgress ? "var(--text-primary)" : "var(--text-secondary)",
                      textDecoration: isCompleted ? "line-through" : "none",
                    }}
                  >
                    <span style={{ color: "var(--text-tertiary)", marginRight: "4px" }}>{index + 1}.</span>
                    {step.step}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Explanation at bottom if present */}
      {expanded && item.explanation && (
        <div
          className="px-3 py-2 text-[11px] leading-relaxed"
          style={{
            color: "var(--text-tertiary)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {item.explanation}
        </div>
      )}
    </div>
  );
}
