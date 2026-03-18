import { useLayout } from "./MainLayout";

interface Props {
  title: string;
  hasChanges?: boolean;
  children?: React.ReactNode;
}

export function TopBar({ title, hasChanges, children }: Props) {
  const { toggleLeft, toggleRight } = useLayout();

  return (
    <header
      className="flex items-center gap-3 px-5 h-16 shrink-0"
      style={{
        background: "var(--bg-root)",
        borderBottom: "1px solid var(--border-subtle)",
        paddingTop: "var(--safe-top)",
      }}
    >
      {/* Hamburger */}
      <button
        onClick={toggleLeft}
        className="lg:hidden w-9 h-9 flex items-center justify-center interactive btn-press"
        style={{ color: "var(--text-primary)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square">
          <line x1="3" y1="6" x2="17" y2="6" />
          <line x1="3" y1="10" x2="17" y2="10" />
          <line x1="3" y1="14" x2="11" y2="14" />
        </svg>
      </button>

      {/* Title */}
      <h1 className="flex-1 text-lg font-serif tracking-wide truncate" style={{ color: "var(--text-primary)" }}>
        {title}
      </h1>

      {/* Context HUD slot */}
      {children}

      {/* Diff panel toggle */}
      <button
        onClick={toggleRight}
        className="xl:hidden relative w-9 h-9 flex items-center justify-center interactive btn-press"
        style={{ color: "var(--text-primary)" }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square">
          <rect x="3" y="3" width="14" height="14" />
          <line x1="11" y1="3" x2="11" y2="17" />
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
