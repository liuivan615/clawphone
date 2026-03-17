import { useApprovalsStore } from "../stores/approvals";

type Tab = "chat" | "approvals" | "bridge" | "status";

interface Props {
  active: Tab;
  onChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: "chat", label: "Chat", icon: "M" },
  { id: "approvals", label: "Approvals", icon: "A" },
  { id: "bridge", label: "Bridge", icon: "B" },
  { id: "status", label: "Status", icon: "S" },
];

export function BottomNav({ active, onChange }: Props) {
  const pendingCount = useApprovalsStore((s) => s.pendingCount());

  return (
    <nav
      className="flex border-t border-neutral-800 bg-neutral-950"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`relative flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
            active === tab.id
              ? "text-emerald-400"
              : "text-neutral-500 active:text-neutral-300"
          }`}
        >
          <span className="text-lg font-mono font-bold">{tab.icon}</span>
          <span>{tab.label}</span>
          {tab.id === "approvals" && pendingCount > 0 && (
            <span className="badge-pulse absolute top-1 right-1/4 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {pendingCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
