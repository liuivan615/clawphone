interface Props {
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  contextWindow: number;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function ContextHud({ totalTokens, contextWindow }: Props) {
  if (!contextWindow || contextWindow === 0) return null;

  const pct = Math.min((totalTokens / contextWindow) * 100, 100);
  const remaining = contextWindow - totalTokens;

  // Color based on usage
  const barColor =
    pct > 85 ? "var(--accent-red)" :
    pct > 65 ? "var(--accent-amber)" :
    "var(--accent-cyan)";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1 rounded-lg"
      style={{ background: "var(--bg-tertiary)" }}
      title={`已用 ${formatTokens(totalTokens)} / ${formatTokens(contextWindow)} tokens（${pct.toFixed(0)}%）`}
    >
      {/* Mini bar */}
      <div
        className="w-16 h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--bg-hover)" }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: barColor,
            transition: "width 0.5s cubic-bezier(0.25, 1, 0.5, 1), background 0.3s ease",
          }}
        />
      </div>

      {/* Text */}
      <span className="text-[9px] font-medium" style={{ color: barColor, fontFamily: "var(--font-mono)" }}>
        {formatTokens(remaining)}
      </span>
    </div>
  );
}
