import { useState, useRef, useEffect } from "react";

const PERMISSION_OPTIONS = [
  { value: "on-request", label: "默认权限", icon: "shield", color: "var(--text-secondary)" },
  { value: "never", label: "完全访问权限", icon: "shield-warn", color: "var(--accent-amber)" },
];

interface Props {
  permission?: string;
  branch?: string;
  workspace?: string;
  onPermissionChange?: (value: string) => void;
}

export function StatusBar({
  permission = "on-request",
  branch = "master",
  workspace,
  onPermissionChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = PERMISSION_OPTIONS.find((o) => o.value === permission) || PERMISSION_OPTIONS[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

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
        {/* Permission selector */}
        <div ref={ref} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 btn-press"
            style={{ color: current.color }}
          >
            {current.icon === "shield-warn" ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M6 1L1.5 3v3c0 2.5 1.9 4.6 4.5 5 2.6-.4 4.5-2.5 4.5-5V3L6 1zm-.5 3h1v3h-1V4zm0 4h1v1h-1V8z"/>
              </svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M5 1a2 2 0 0 0-2 2v1H2.5a.5.5 0 0 0-.5.5v4a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-4a.5.5 0 0 0-.5-.5H7V3a2 2 0 0 0-2-2zm1 3H4V3a1 1 0 1 1 2 0v1z"/>
              </svg>
            )}
            {current.label}
            <svg
              width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              style={{ transition: "transform 0.15s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              <path d="M1.5 3l2.5 2.5L6.5 3" />
            </svg>
          </button>

          {/* Dropdown menu */}
          {open && (
            <div
              className="absolute bottom-full left-0 mb-1.5 min-w-[160px] py-1 rounded-xl overflow-hidden z-50"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid var(--border-default)",
                boxShadow: "var(--shadow-lg)",
                animation: "dropdownIn 0.18s var(--ease-spring) both",
              }}
            >
              {PERMISSION_OPTIONS.map((opt) => {
                const selected = opt.value === permission;
                return (
                  <button
                    key={opt.value}
                    onClick={() => {
                      onPermissionChange?.(opt.value);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2"
                    style={{
                      color: selected ? opt.color : "var(--text-primary)",
                      background: selected ? "var(--bg-hover)" : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = selected ? "var(--bg-hover)" : "transparent";
                    }}
                  >
                    {opt.icon === "shield-warn" ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill={opt.color}>
                        <path d="M6 1L1.5 3v3c0 2.5 1.9 4.6 4.5 5 2.6-.4 4.5-2.5 4.5-5V3L6 1zm-.5 3h1v3h-1V4zm0 4h1v1h-1V8z"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill={opt.color}>
                        <path d="M6 1.5a2.25 2.25 0 0 0-2.25 2.25V5h-.5a.75.75 0 0 0-.75.75v4.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-4.5A.75.75 0 0 0 8.75 5h-.5V3.75A2.25 2.25 0 0 0 6 1.5zm1.25 3.5h-2.5V3.75a1.25 1.25 0 1 1 2.5 0V5z"/>
                      </svg>
                    )}
                    {opt.label}
                    {selected && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={opt.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto">
                        <path d="M1.5 5l2.5 2.5 4.5-4.5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

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
