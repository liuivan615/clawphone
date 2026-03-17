import { useState, useRef, useEffect, useCallback } from "react";

interface Props {
  connected: boolean;
  activeSession: string | null;
  output: string[];
  onStart: (workspace: string, prompt?: string) => void;
  onSendInput: (input: string) => void;
  onSendKey: (key: string) => void;
  onKill: () => void;
}

const RECENT_DIRS = [
  "D:\\clawd",
  "D:\\clawphone",
  "C:\\Users\\IVAN\\Desktop",
];

export function ChatPage({
  connected,
  activeSession,
  output,
  onStart,
  onSendInput,
  onSendKey,
  onKill,
}: Props) {
  const [workspace, setWorkspace] = useState("");
  const [prompt, setPrompt] = useState("");
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace.trim()) return;
    onStart(workspace.trim(), prompt.trim() || undefined);
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendInput(input + "\r");
    setInput("");
  };

  // No active session — show start form
  if (!activeSession) {
    return (
      <div className="flex flex-col h-full p-4">
        <h2 className="text-lg font-bold text-neutral-200 mb-4">Start Codex</h2>

        <form onSubmit={handleStart} className="space-y-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Workspace Directory
            </label>
            <input
              type="text"
              value={workspace}
              onChange={(e) => setWorkspace(e.target.value)}
              placeholder="D:\your-project"
              className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 text-sm font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Quick directory buttons */}
          <div className="flex flex-wrap gap-2">
            {RECENT_DIRS.map((dir) => (
              <button
                key={dir}
                type="button"
                onClick={() => setWorkspace(dir)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  workspace === dir
                    ? "bg-emerald-600 text-white"
                    : "bg-neutral-800 text-neutral-400 active:bg-neutral-700"
                }`}
              >
                {dir.split("\\").pop()}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">
              Initial Prompt (optional)
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Fix the bug in auth.ts"
              rows={3}
              className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 text-sm focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!connected || !workspace.trim()}
            className="w-full py-3 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 active:bg-emerald-700 transition-colors"
          >
            {connected ? "Launch Codex" : "Not Connected..."}
          </button>
        </form>
      </div>
    );
  }

  // Active session — show terminal output
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800 bg-neutral-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono text-neutral-400 truncate max-w-[200px]">
            {activeSession}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => onSendKey("ctrl+c")}
            className="px-2 py-1 rounded text-xs bg-neutral-800 text-neutral-400 active:bg-neutral-700"
          >
            Ctrl+C
          </button>
          <button
            onClick={onKill}
            className="px-2 py-1 rounded text-xs bg-red-900/50 text-red-400 active:bg-red-900"
          >
            Kill
          </button>
        </div>
      </div>

      {/* Terminal output */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed bg-neutral-950"
      >
        {output.length === 0 ? (
          <p className="text-neutral-600">Starting Codex...</p>
        ) : (
          output.map((line, i) => (
            <pre key={i} className="whitespace-pre-wrap text-neutral-200 break-all">
              {line}
            </pre>
          ))
        )}
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2 px-3 py-2 border-t border-neutral-800 bg-neutral-900">
        <button
          onClick={() => onSendKey("y")}
          className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700"
        >
          Yes (y)
        </button>
        <button
          onClick={() => onSendKey("n")}
          className="px-4 py-2 rounded-lg border border-red-700 text-red-400 text-sm font-medium active:bg-red-900/30"
        >
          No (n)
        </button>
        <button
          onClick={() => onSendKey("enter")}
          className="px-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-sm active:bg-neutral-700"
        >
          Enter
        </button>
      </div>

      {/* Text input */}
      <form
        onSubmit={handleSend}
        className="flex gap-2 p-3 border-t border-neutral-800 bg-neutral-950"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type input for Codex..."
          className="flex-1 px-4 py-2.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-100 placeholder-neutral-600 text-sm font-mono focus:outline-none focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="px-5 py-2.5 rounded-full bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 active:bg-emerald-700"
        >
          Send
        </button>
      </form>
    </div>
  );
}
