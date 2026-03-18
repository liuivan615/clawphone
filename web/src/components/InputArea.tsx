import { useState, useRef, useCallback } from "react";
import { Dropdown } from "./Dropdown";
import { SlashCommandPalette } from "./SlashCommandPalette";
import { api } from "../lib/api";

interface Skill {
  name: string;
  description: string;
  shortDescription?: string;
}

interface Props {
  onSend: (message: string, planMode?: boolean) => void;
  disabled?: boolean;
  turnActive?: boolean;
  workspace?: string;
  skills?: Skill[];
  onInterrupt?: () => void;
  onSlashCommand?: (command: string) => void;
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
  workspace,
  skills = [],
  onInterrupt,
  onSlashCommand,
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
  const [attachedFiles, setAttachedFiles] = useState<Array<{ path: string; name: string }>>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showApprovalPicker, setShowApprovalPicker] = useState(false);
  const [pickerFiles, setPickerFiles] = useState<string[]>([]);
  const [pickerDirs, setPickerDirs] = useState<Array<{ name: string; path: string }>>([]);
  const [pickerPath, setPickerPath] = useState(workspace || "");

  const loadPickerDir = useCallback(async (path: string) => {
    setPickerPath(path);
    try {
      const [dirsRes, filesRes] = await Promise.all([
        fetch(`/api/browse?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${api.token}` } }),
        fetch(`/api/files?path=${encodeURIComponent(path)}`, { headers: { Authorization: `Bearer ${api.token}` } }),
      ]);
      const dirsData = await dirsRes.json();
      const filesData = await filesRes.json();
      setPickerDirs(dirsData.dirs || []);
      setPickerFiles(filesData.files || []);
    } catch {
      setPickerDirs([]);
      setPickerFiles([]);
    }
  }, []);

  const attachFile = useCallback((filePath: string) => {
    const name = filePath.split("\\").pop() || filePath;
    setAttachedFiles((prev) => {
      if (prev.some((f) => f.path === filePath)) return prev;
      return [...prev, { path: filePath, name }];
    });
    setShowFilePicker(false);
  }, []);

  const removeAttachment = useCallback((path: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.path !== path));
  }, []);

  const handleSubmit = useCallback(() => {
    const msg = text.trim();
    if (!msg || disabled) return;

    // Prepend attached file references
    let fullMsg = msg;
    if (attachedFiles.length > 0) {
      const refs = attachedFiles.map((f) => `@${f.path}`).join("\n");
      fullMsg = `${refs}\n\n${msg}`;
    }

    onSend(fullMsg, planMode);
    setText("");
    setAttachedFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [text, disabled, onSend, planMode, attachedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);

    // Detect slash commands
    if (val.startsWith("/")) {
      setShowSlashMenu(true);
      setSlashFilter(val.slice(1));
    } else {
      setShowSlashMenu(false);
      setSlashFilter("");
    }

    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const handleSlashSelect = (command: string) => {
    setShowSlashMenu(false);
    setText("");

    switch (command) {
      case "mode":
        onPlanModeChange?.(!planMode);
        break;
      case "model":
        setShowModelPicker(true);
        break;
      case "approval":
        setShowApprovalPicker(true);
        break;
      case "clear":
        onSlashCommand?.("clear");
        break;
      default:
        onSlashCommand?.(command);
        break;
    }
  };

  return (
    <div className="shrink-0 border-t glass" style={{ borderColor: "var(--border-subtle)" }}>
      {/* Model + Reasoning row */}
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
        <button
          className="w-7 h-7 flex items-center justify-center rounded-lg interactive btn-press"
          style={{ color: showFilePicker ? "var(--accent-cyan)" : "var(--text-tertiary)" }}
          title="附加文件"
          onClick={() => {
            setShowFilePicker((v) => !v);
            if (!showFilePicker) loadPickerDir(workspace || pickerPath);
          }}
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

      {/* File picker dropdown */}
      {showFilePicker && (
        <div
          className="mx-3 mb-1 rounded-lg overflow-hidden"
          style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", maxHeight: "200px", overflowY: "auto" }}
        >
          {/* Path + up */}
          <div className="flex items-center gap-1 px-2 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <button
              onClick={() => {
                const parts = pickerPath.replace(/\\$/, "").split("\\");
                if (parts.length > 1) { parts.pop(); loadPickerDir(parts.join("\\") + "\\"); }
              }}
              className="text-[10px] px-1.5 py-0.5 rounded btn-press"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}
            >
              ..
            </button>
            <span className="text-[10px] truncate flex-1" style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
              {pickerPath}
            </span>
          </div>
          {/* Dirs */}
          {pickerDirs.slice(0, 5).map((d) => (
            <button
              key={d.path}
              onClick={() => loadPickerDir(d.path)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px]"
              style={{ color: "var(--text-secondary)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--text-tertiary)"><path d="M1 2a1 1 0 011-1h1.5a1 1 0 01.7.3l.5.5a1 1 0 00.7.3H8a1 1 0 011 1V8a1 1 0 01-1 1H2a1 1 0 01-1-1V2z"/></svg>
              {d.name}
            </button>
          ))}
          {/* Files */}
          {pickerFiles.slice(0, 10).map((f) => (
            <button
              key={f}
              onClick={() => attachFile(pickerPath + "\\" + f)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px]"
              style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--text-tertiary)" strokeWidth="1"><path d="M6 1H2.5A1 1 0 001.5 2v6a1 1 0 001 1h5a1 1 0 001-1V3.5L6 1z"/><path d="M6 1v2.5h2.5"/></svg>
              {f}
            </button>
          ))}
        </div>
      )}

      {/* Attached files */}
      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-1">
          {attachedFiles.map((f) => (
            <span
              key={f.path}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px]"
              style={{ background: "var(--accent-cyan-dim)", color: "var(--accent-cyan)", fontFamily: "var(--font-mono)" }}
            >
              @{f.name}
              <button onClick={() => removeAttachment(f.path)} className="opacity-60 hover:opacity-100">x</button>
            </span>
          ))}
        </div>
      )}

      {/* Inline model picker */}
      {showModelPicker && (
        <div className="mx-3 mb-1 rounded-lg overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-lg)", animation: "dropdownIn 0.2s cubic-bezier(0.25, 1, 0.5, 1) both" }}>
          <div className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>切换模型</span>
          </div>
          {MODEL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setLocalModel(opt.value);
                onModelChange?.(opt.value);
                setShowModelPicker(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs"
              style={{
                background: opt.value === localModel ? "var(--accent-cyan-dim)" : "transparent",
                color: opt.value === localModel ? "var(--accent-cyan)" : "var(--text-primary)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {opt.label}
              {opt.value === localModel && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" className="ml-auto">
                  <path d="M2 5l2.5 2.5L8 3" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Inline approval picker */}
      {showApprovalPicker && (
        <div className="mx-3 mb-1 rounded-lg overflow-hidden" style={{ background: "var(--bg-secondary)", border: "1px solid var(--border-default)", boxShadow: "var(--shadow-lg)", animation: "dropdownIn 0.2s cubic-bezier(0.25, 1, 0.5, 1) both" }}>
          <div className="px-3 py-1.5" style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            <span className="text-[10px] font-medium" style={{ color: "var(--text-tertiary)" }}>审批策略</span>
          </div>
          {[
            { value: "on-request", label: "默认权限", desc: "每次工具调用需审批" },
            { value: "on-failure", label: "失败时审批", desc: "仅失败时请求审批" },
            { value: "never", label: "完全访问", desc: "自动批准所有操作" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onSlashCommand?.(`approval:${opt.value}`);
                setShowApprovalPicker(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left"
              style={{ background: "transparent", color: "var(--text-primary)" }}
            >
              <div className="flex-1">
                <div className="text-xs font-medium">{opt.label}</div>
                <div className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Slash command palette */}
      <SlashCommandPalette
        visible={showSlashMenu}
        filter={slashFilter}
        skills={skills}
        onSelect={handleSlashSelect}
        onClose={() => setShowSlashMenu(false)}
      />

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
