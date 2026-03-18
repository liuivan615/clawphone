import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";

const PERMISSION_OPTIONS = [
  { value: "on-request", label: "默认权限", icon: "shield", color: "var(--text-secondary)" },
  { value: "on-failure", label: "失败时审批", icon: "shield", color: "var(--accent-cyan)" },
  { value: "never", label: "完全访问权限", icon: "shield-warn", color: "var(--accent-amber)" },
];

interface BranchInfo {
  name: string;
  current: boolean;
}

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

        {/* Branch selector */}
        <BranchSelector branch={branch || "master"} workspace={workspace} />
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

function BranchSelector({ branch, workspace }: { branch: string; workspace?: string }) {
  const [open, setOpen] = useState(false);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [currentBranch, setCurrentBranch] = useState(branch);
  const [newBranchName, setNewBranchName] = useState("");
  const [creating, setCreating] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setCurrentBranch(branch); }, [branch]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const loadBranches = useCallback(async () => {
    if (!workspace) return;
    try {
      const res = await fetch(`/api/git/branches?cwd=${encodeURIComponent(workspace)}`, {
        headers: { Authorization: `Bearer ${api.token}` },
      });
      const data = await res.json();
      if (data.error) {
        setBranchError(data.error);
        return;
      }

      setBranches(data.branches || []);
      const cur = (data.branches || []).find((b: BranchInfo) => b.current);
      if (cur) setCurrentBranch(cur.name);
      setBranchError(null);
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : String(err));
    }
  }, [workspace]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  const switchBranch = async (name: string) => {
    if (!workspace) return;
    try {
      const res = await fetch("/api/git/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.token}` },
        body: JSON.stringify({ cwd: workspace, branch: name }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setCurrentBranch(data.branch || name);
      setBranchError(null);
      await loadBranches();
      setOpen(false);
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : String(err));
    }
  };

  const createBranch = async () => {
    if (!workspace || !newBranchName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/git/branch/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${api.token}` },
        body: JSON.stringify({ cwd: workspace, name: newBranchName.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      setCurrentBranch(data.branch || newBranchName.trim());
      setNewBranchName("");
      setBranchError(null);
      await loadBranches();
      setOpen(false);
    } catch (err) {
      setBranchError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) {
            setBranchError(null);
            void loadBranches();
          }
        }}
        className="flex items-center gap-1 btn-press"
        style={{ color: "var(--text-secondary)" }}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="3" cy="2.5" r="1.2" /><circle cx="3" cy="7.5" r="1.2" /><circle cx="7" cy="5" r="1.2" />
          <path d="M3 3.7V6.3M4.2 7.1 5.8 5.6" />
        </svg>
        {currentBranch}
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s ease" }}
        >
          <path d="M1.5 3l2.5 2.5L6.5 3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1.5 min-w-[180px] py-1 rounded-xl overflow-hidden z-50"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border-default)",
            boxShadow: "var(--shadow-lg)",
            animation: "dropdownIn 0.18s var(--ease-spring) both",
            maxHeight: "250px",
            overflowY: "auto",
          }}
        >
          {branches.filter((b) => !b.name.startsWith("remotes/")).map((b) => (
            <button
              key={b.name}
              onClick={() => switchBranch(b.name)}
              className="w-full text-left px-3 py-1.5 text-[11px] flex items-center gap-2"
              style={{
                color: b.name === currentBranch ? "var(--accent-cyan)" : "var(--text-primary)",
                background: b.name === currentBranch ? "var(--accent-cyan-dim)" : "transparent",
                fontFamily: "var(--font-mono)",
              }}
            >
              {b.name}
              {b.name === currentBranch && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--accent-cyan)" strokeWidth="2" strokeLinecap="round" className="ml-auto">
                  <path d="M1 4l2 2 3.5-3.5" />
                </svg>
              )}
            </button>
          ))}

          {/* Create new branch */}
          <div className="border-t px-2 py-1.5" style={{ borderColor: "var(--border-subtle)" }}>
            <div className="flex gap-1">
              <input
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="新分支名..."
                className="flex-1 px-2 py-1 rounded text-[10px] outline-none"
                style={{ background: "var(--bg-primary)", color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}
                onKeyDown={(e) => { if (e.key === "Enter") createBranch(); }}
              />
              <button
                onClick={createBranch}
                disabled={creating || !newBranchName.trim()}
                className="px-2 py-1 rounded text-[10px] font-medium btn-press disabled:opacity-30"
                style={{ background: "var(--accent-cyan)", color: "var(--text-inverse)" }}
              >
                +
              </button>
            </div>
            {branchError && (
              <div className="mt-2 text-[10px] leading-relaxed" style={{ color: "var(--accent-red)" }}>
                {branchError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
