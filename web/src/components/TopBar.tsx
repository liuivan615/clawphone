import { useLayout } from "./MainLayout";

interface Props {
  title: string;
  hasChanges?: boolean;
}

export function TopBar({ title, hasChanges }: Props) {
  const { toggleLeft, toggleRight } = useLayout();

  return (
    <header
      className="flex items-center gap-2 px-3 h-12 shrink-0 border-b glass"
      style={{
        borderColor: "var(--border-subtle)",
        paddingTop: "var(--safe-top)",
      }}
    >
      {/* Hamburger */}
      <button
        onClick={toggleLeft}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg interactive btn-press"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <line x1="2" y1="4" x2="16" y2="4" />
          <line x1="2" y1="9" x2="16" y2="9" />
          <line x1="2" y1="14" x2="12" y2="14" />
        </svg>
      </button>

      {/* Title */}
      <h1 className="flex-1 text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>

      {/* Diff panel toggle */}
      <button
        onClick={toggleRight}
        className="xl:hidden relative w-9 h-9 flex items-center justify-center rounded-lg interactive btn-press"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <rect x="2" y="2" width="14" height="14" rx="2" />
          <line x1="10" y1="2" x2="10" y2="16" />
        </svg>
        {hasChanges && (
          <span
            className="badge-pulse absolute top-1 right-1 w-2 h-2 rounded-full"
            style={{ background: "var(--accent-amber)" }}
          />
        )}
      </button>
    </header>
  );
}
