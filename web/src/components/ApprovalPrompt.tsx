interface Props {
  id: string;
  tool: string;
  command?: string;
  description?: string;
  onApprove: () => void;
  onDeny: () => void;
  status?: "pending" | "approved" | "denied";
}

export function ApprovalPrompt({
  tool,
  command,
  description,
  onApprove,
  onDeny,
  status = "pending",
}: Props) {
  const isPending = status === "pending";

  return (
    <div
      className="fade-in mx-3 my-2 rounded-xl border overflow-hidden"
      style={{
        borderColor: isPending ? "var(--accent-amber)" : "var(--border-default)",
        background: isPending ? "var(--accent-amber-dim)" : "var(--bg-secondary)",
        opacity: isPending ? 1 : 0.6,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          className="w-5 h-5 flex items-center justify-center rounded-md text-[10px]"
          style={{ background: "var(--bg-tertiary)", color: "var(--accent-amber)" }}
        >
          ⚡
        </span>
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
        >
          {tool}
        </span>
        {!isPending && (
          <span
            className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full"
            style={{
              background: status === "approved" ? "var(--accent-green-dim)" : "var(--accent-red-dim)",
              color: status === "approved" ? "var(--accent-green)" : "var(--accent-red)",
            }}
          >
            {status === "approved" ? "已允许" : "已拒绝"}
          </span>
        )}
      </div>

      {/* Command/description */}
      {command && (
        <pre
          className="mx-3 mb-2 px-3 py-2 rounded-lg text-xs overflow-x-auto"
          style={{
            background: "var(--bg-root)",
            color: "var(--text-primary)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {command}
        </pre>
      )}
      {description && !command && (
        <p className="mx-3 mb-2 text-xs" style={{ color: "var(--text-secondary)" }}>
          {description}
        </p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <button
            onClick={onDeny}
            className="flex-1 py-2.5 text-xs font-medium border-r transition-colors"
            style={{
              borderColor: "var(--border-subtle)",
              color: "var(--accent-red)",
              background: "transparent",
            }}
          >
            拒绝
          </button>
          <button
            onClick={onApprove}
            className="flex-1 py-2.5 text-xs font-medium transition-colors"
            style={{
              color: "var(--accent-green)",
              background: "transparent",
            }}
          >
            允许
          </button>
        </div>
      )}
    </div>
  );
}
