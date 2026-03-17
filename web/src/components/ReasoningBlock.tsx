import { useState } from "react";
import type { ReasoningItem } from "../lib/conversation-types";

interface Props {
  item: ReasoningItem;
}

export function ReasoningBlock({ item }: Props) {
  const [expanded, setExpanded] = useState(false);

  const hasSummary = item.summary.length > 0;
  const hasContent = item.content.length > 0;

  return (
    <div
      className="mx-3 my-1.5 rounded-lg overflow-hidden cursor-pointer"
      onClick={() => setExpanded((v) => !v)}
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-subtle)",
        opacity: item.streaming ? 1 : 0.7,
      }}
    >
      <div className="flex items-center gap-2 px-3 py-1.5">
        {/* Thinking icon */}
        {item.streaming ? (
          <span className="spinner" style={{ width: "12px", height: "12px" }} />
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="6" cy="6" r="4.5" />
            <path d="M6 4v2.5l1.5 1" />
          </svg>
        )}

        <span
          className="text-[11px] font-medium"
          style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-ui)" }}
        >
          {item.streaming ? "正在思考..." : "思考过程"}
        </span>

        {/* Expand chevron */}
        {(hasSummary || hasContent) && !item.streaming && (
          <svg
            width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round"
            className="ml-auto"
            style={{ transition: "transform 0.15s ease", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M2 3.5l3 3 3-3" />
          </svg>
        )}
      </div>

      {/* Summary (always shown when available) */}
      {hasSummary && (
        <div
          className="px-3 pb-1.5 text-[11px] leading-relaxed"
          style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-ui)" }}
        >
          {item.summary}
        </div>
      )}

      {/* Streaming content */}
      {item.streaming && hasContent && (
        <div
          className="px-3 pb-2 text-[11px] leading-relaxed"
          style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}
        >
          {item.content.slice(-200)}
        </div>
      )}

      {/* Full content (expanded) */}
      {expanded && !item.streaming && hasContent && (
        <div
          className="px-3 pb-2 text-[11px] leading-relaxed overflow-y-auto"
          style={{
            color: "var(--text-tertiary)",
            fontFamily: "var(--font-mono)",
            maxHeight: "200px",
            borderTop: "1px solid var(--border-subtle)",
            paddingTop: "8px",
          }}
        >
          {item.content}
        </div>
      )}
    </div>
  );
}
