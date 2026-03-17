type Tab = "tasks" | "files" | "changes";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
  changesCount?: number;
}

const tabs: { id: Tab; label: string }[] = [
  { id: "tasks", label: "对话" },
  { id: "files", label: "文件" },
  { id: "changes", label: "变更" },
];

export function TabBar({ active, onChange, changesCount }: Props) {
  return (
    <div
      className="flex items-center gap-0.5 px-3 h-10 shrink-0 border-b"
      style={{ background: "var(--bg-primary)", borderColor: "var(--border-subtle)" }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="relative px-3.5 py-1.5 rounded-lg text-xs font-medium btn-press"
            style={{
              color: isActive ? "var(--accent-cyan)" : "var(--text-tertiary)",
              background: isActive ? "var(--accent-cyan-dim)" : "transparent",
              transition: "all var(--dur-fast) ease",
            }}
          >
            {tab.label}
            {tab.id === "changes" && changesCount !== undefined && changesCount > 0 && (
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  background: "var(--accent-amber-dim)",
                  color: "var(--accent-amber)",
                }}
              >
                {changesCount}
              </span>
            )}
            {/* Active indicator line */}
            {isActive && (
              <span
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full"
                style={{
                  background: "var(--accent-cyan)",
                  transition: "all var(--dur-normal) var(--ease-spring)",
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
