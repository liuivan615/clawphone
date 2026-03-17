import { useState, useRef, useEffect } from "react";

interface Option {
  value: string;
  label: string;
}

interface Props {
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  variant?: "default" | "accent";
}

export function Dropdown({ value, options, onChange, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler as EventListener);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler as EventListener);
    };
  }, [open]);

  const isAccent = variant === "accent";

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 btn-press"
        style={{
          background: isAccent ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
          color: isAccent ? "var(--accent-cyan)" : "var(--text-secondary)",
          fontFamily: isAccent ? "var(--font-ui)" : "var(--font-mono)",
          transition: "all var(--dur-fast) ease",
          border: open ? `1px solid ${isAccent ? "var(--accent-cyan-mid)" : "var(--border-strong)"}` : "1px solid transparent",
        }}
      >
        {currentLabel}
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{
            transition: "transform var(--dur-fast) ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>

      {/* Menu */}
      {open && (
        <div
          className="absolute bottom-full left-0 mb-1.5 min-w-[140px] py-1 rounded-xl overflow-hidden z-50"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            animation: "dropdownIn 0.18s var(--ease-spring) both",
          }}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className="w-full text-left px-3.5 py-2 text-xs font-medium flex items-center justify-between"
                style={{
                  color: selected ? "var(--accent-cyan)" : "var(--text-primary)",
                  background: selected ? "var(--accent-cyan-dim)" : "transparent",
                  transition: "all var(--dur-fast) ease",
                  fontFamily: isAccent ? "var(--font-ui)" : "var(--font-mono)",
                }}
                onMouseEnter={(e) => {
                  if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = selected ? "var(--accent-cyan-dim)" : "transparent";
                }}
              >
                {opt.label}
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 6l3 3 5-5" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
