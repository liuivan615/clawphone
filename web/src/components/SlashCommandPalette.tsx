import { useState, useEffect } from "react";

interface Skill {
  name: string;
  description: string;
  shortDescription?: string;
}

// All Codex CLI built-in commands
const BUILTIN_COMMANDS = [
  { name: "mode", description: "切换协作模式 (plan ↔ default)", icon: "⚙" },
  { name: "model", description: "查看或切换当前模型", icon: "M" },
  { name: "approval", description: "更改审批策略", icon: "🔒" },
  { name: "help", description: "显示帮助信息", icon: "?" },
  { name: "skills", description: "列出所有可用技能", icon: "✦" },
  { name: "compact", description: "压缩上下文以释放空间", icon: "⊟" },
  { name: "clear", description: "清空当前对话", icon: "✕" },
  { name: "undo", description: "撤销上一轮对话", icon: "↩" },
  { name: "diff", description: "查看当前 Git 变更", icon: "±" },
  { name: "status", description: "查看 Git 状态", icon: "⊙" },
  { name: "review", description: "开始代码审查", icon: "👁" },
  { name: "fork", description: "从当前线程创建分支", icon: "⑃" },
  { name: "resume", description: "恢复之前的线程", icon: "▶" },
  { name: "history", description: "查看对话历史", icon: "⏱" },
  { name: "name", description: "为当前线程命名", icon: "✎" },
];

interface Props {
  visible: boolean;
  filter: string; // text after "/"
  skills: Skill[];
  onSelect: (command: string) => void;
  onClose: () => void;
}

export function SlashCommandPalette({ visible, filter, skills, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build full command list
  const allCommands = [
    ...BUILTIN_COMMANDS.map((c) => ({ ...c, type: "builtin" as const })),
    ...skills.map((s) => ({
      name: s.name,
      description: s.shortDescription || s.description,
      icon: "S",
      type: "skill" as const,
    })),
  ];

  const filtered = filter
    ? allCommands.filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
    : allCommands;

  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      className="mx-3 mb-1 rounded-lg overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: "1px solid var(--border-default)",
        boxShadow: "var(--shadow-lg)",
        maxHeight: "240px",
        overflowY: "auto",
        animation: "dropdownIn 0.2s cubic-bezier(0.25, 1, 0.5, 1) both",
      }}
    >
      <div className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
        <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>
          命令
        </span>
      </div>
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd.name)}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
          style={{
            background: i === selectedIndex ? "var(--bg-hover)" : "transparent",
            color: "var(--text-primary)",
          }}
          onMouseEnter={() => setSelectedIndex(i)}
        >
          {/* Icon */}
          <div
            className="w-6 h-6 flex items-center justify-center rounded-md shrink-0 text-[10px] font-bold"
            style={{
              background: cmd.type === "skill" ? "var(--accent-cyan-dim)" : "var(--bg-tertiary)",
              color: cmd.type === "skill" ? "var(--accent-cyan)" : "var(--text-secondary)",
            }}
          >
            {cmd.type === "skill" ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3">
                <path d="M6 1l1.5 3.5L11 6l-3.5 1.5L6 11 4.5 7.5 1 6l3.5-1.5z" strokeLinejoin="round" />
              </svg>
            ) : (
              cmd.icon
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium">
              <span style={{ color: "var(--accent-cyan)" }}>/</span>
              {cmd.name}
            </div>
            <div className="text-[10px] truncate" style={{ color: "var(--text-tertiary)" }}>
              {cmd.description}
            </div>
          </div>

          {cmd.type === "skill" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)" }}>
              技能
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
