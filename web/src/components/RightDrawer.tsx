interface ChangedFile {
  path: string;
  additions: number;
  deletions: number;
}

interface Props {
  files: ChangedFile[];
  onClose?: () => void;
}

export function RightDrawer({ files, onClose }: Props) {
  const total = files.reduce(
    (acc, f) => ({ add: acc.add + f.additions, del: acc.del + f.deletions }),
    { add: 0, del: 0 }
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-12 shrink-0 border-b"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            未暂存
          </span>
          <span
            className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
            style={{ background: "var(--accent-amber-dim)", color: "var(--accent-amber)" }}
          >
            {files.length}
          </span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="xl:hidden w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto">
        {files.length === 0 ? (
          <div className="text-center py-12 text-xs" style={{ color: "var(--text-tertiary)" }}>
            暂无变更
          </div>
        ) : (
          files.map((file) => (
            <div
              key={file.path}
              className="flex items-center justify-between px-4 py-2.5 border-b cursor-pointer transition-colors"
              style={{ borderColor: "var(--border-subtle)" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                className="text-xs truncate flex-1 mr-2"
                style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
              >
                {file.path}
              </span>
              <span className="shrink-0 text-[10px] font-mono flex gap-1.5">
                <span style={{ color: "var(--accent-green)" }}>+{file.additions}</span>
                <span style={{ color: "var(--accent-red)" }}>-{file.deletions}</span>
              </span>
            </div>
          ))
        )}
      </div>

      {/* Summary + Actions */}
      {files.length > 0 && (
        <div
          className="shrink-0 p-3 border-t space-y-2"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="text-[11px] text-center" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
            {files.length} file(s) &middot;{" "}
            <span style={{ color: "var(--accent-green)" }}>+{total.add}</span>{" "}
            <span style={{ color: "var(--accent-red)" }}>-{total.del}</span>
          </div>
          <div className="flex gap-2">
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium border transition-colors"
              style={{
                borderColor: "var(--border-default)",
                color: "var(--text-secondary)",
                background: "transparent",
              }}
            >
              还原全部
            </button>
            <button
              className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                background: "var(--accent-cyan)",
                color: "var(--text-inverse)",
              }}
            >
              暂存全部
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
