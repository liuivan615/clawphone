interface Props {
  permission?: string;
  branch?: string;
  workspace?: string;
}

export function StatusBar({ permission = "完全访问", branch = "master", workspace }: Props) {
  return (
    <div
      className="flex items-center justify-between px-3 h-8 shrink-0 border-t text-[11px]"
      style={{
        background: "var(--bg-secondary)",
        borderColor: "var(--border-subtle)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Permission */}
        <span className="flex items-center gap-1" style={{ color: "var(--accent-green)" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M5 1a2 2 0 0 0-2 2v1H2.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5H7V3a2 2 0 0 0-2-2zm1 3H4V3a1 1 0 1 1 2 0v1z"/>
          </svg>
          {permission}
        </span>

        {/* Branch */}
        <span className="flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="3" cy="2.5" r="1.2" />
            <circle cx="3" cy="7.5" r="1.2" />
            <circle cx="7" cy="5" r="1.2" />
            <path d="M3 3.7V6.3M4.2 7.1 5.8 5.6" />
          </svg>
          {branch}
        </span>
      </div>

      {/* Workspace path */}
      {workspace && (
        <span
          className="truncate max-w-[180px]"
          style={{ color: "var(--text-tertiary)" }}
        >
          {workspace}
        </span>
      )}
    </div>
  );
}
