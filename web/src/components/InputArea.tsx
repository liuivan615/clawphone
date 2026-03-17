import { useState, useRef, useCallback } from "react";
import { Dropdown } from "./Dropdown";

interface Props {
  onSend: (message: string, planMode?: boolean) => void;
  disabled?: boolean;
  turnActive?: boolean;
  onInterrupt?: () => void;
  model?: string;
  reasoning?: string;
  planMode?: boolean;
  onPlanModeChange?: (enabled: boolean) => void;
  onModelChange?: (model: string) => void;
  onReasoningChange?: (level: string) => void;
}

const MODEL_OPTIONS = [
  { value: "gpt-5.4", label: "GPT-5.4" },
  { value: "gpt-5.3-codex", label: "GPT-5.3-Codex" },
  { value: "gpt-5.2-codex", label: "GPT-5.2-Codex" },
  { value: "gpt-5.2", label: "GPT-5.2" },
  { value: "gpt-5.1-codex-max", label: "GPT-5.1-Codex-Max" },
  { value: "gpt-5.1-codex-mini", label: "GPT-5.1-Codex-Mini" },
];

const REASONING_OPTIONS = [
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "xhigh", label: "超高" },
];

export function InputArea({
  onSend,
  disabled,
  turnActive,
  onInterrupt,
  model = "gpt-5.4",
  reasoning = "xhigh",
  planMode = false,
  onPlanModeChange,
  onModelChange,
  onReasoningChange,
}: Props) {
  const [text, setText] = useState("");
  const [localModel, setLocalModel] = useState(model);
  const [localReasoning, setLocalReasoning] = useState(reasoning);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = useCallback(() => {
    const msg = text.trim();
    if (!msg || disabled) return;
    onSend(msg, planMode);
    setText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend, planMode]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  return (
    <div className="shrink-0 border-t glass" style={{ borderColor: "var(--border-subtle)" }}>
      {/* Model + Reasoning row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg interactive btn-press"
          style={{ color: "var(--text-tertiary)" }}
          title="附加文件"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M7 1v12M1 7h12" />
          </svg>
        </button>

        <Dropdown
          value={localModel}
          options={MODEL_OPTIONS}
          onChange={(v) => {
            setLocalModel(v);
            onModelChange?.(v);
          }}
        />

        <Dropdown
          value={localReasoning}
          options={REASONING_OPTIONS}
          onChange={(v) => {
            setLocalReasoning(v);
            onReasoningChange?.(v);
          }}
          variant="accent"
        />

        {/* Plan mode toggle */}
        <button
          onClick={() => onPlanModeChange?.(!planMode)}
          className="h-7 px-2.5 rounded-lg text-xs font-medium flex items-center gap-1.5 btn-press"
          style={{
            background: planMode ? "var(--accent-cyan)" : "var(--bg-tertiary)",
            color: planMode ? "var(--text-inverse)" : "var(--text-tertiary)",
            transition: "all var(--dur-fast) ease",
          }}
          title="计划模式 (Shift+Tab 切换)"
        >
          {planMode && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <circle cx="5" cy="5" r="4" />
            </svg>
          )}
          计划
        </button>
      </div>

      {/* Input row */}
      <div className="flex items-end gap-2 px-3 pb-2.5">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? "正在启动 Codex..." : "向 Codex 提问..."}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl px-4 py-2.5 text-sm leading-relaxed outline-none placeholder:opacity-40 disabled:opacity-40"
          style={{
            background: "var(--bg-secondary)",
            color: "var(--text-primary)",
            border: "1px solid var(--border-default)",
            fontFamily: "var(--font-ui)",
            maxHeight: "120px",
            transition: "border-color var(--dur-fast) ease, box-shadow var(--dur-fast) ease",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-cyan)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--accent-cyan-dim)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border-default)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
        {turnActive ? (
          <button
            onClick={onInterrupt}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl btn-press"
            style={{
              background: "var(--accent-red)",
              color: "var(--text-inverse)",
            }}
            title="停止"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <rect x="2" y="2" width="10" height="10" rx="2" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={disabled || !text.trim()}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-xl disabled:opacity-30 btn-glow btn-press"
            style={{
              background: text.trim() ? "var(--accent-cyan)" : "var(--bg-tertiary)",
              color: text.trim() ? "var(--text-inverse)" : "var(--text-tertiary)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor">
              <path d="M3.5 14.5l11-5.5-11-5.5v4.5l7 1-7 1z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
