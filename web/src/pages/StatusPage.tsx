import { useEffect } from "react";
import { useStatusStore } from "../stores/status";
import { StatusBadge } from "../components/StatusBadge";

export function StatusPage() {
  const { status, loading, error, refresh } = useStatusStore();

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-neutral-200">System Status</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-xs text-emerald-400 active:text-emerald-300 disabled:opacity-50"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-950/30 border border-red-800 text-red-400 text-sm">
          {error}
        </div>
      )}

      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
        Required
      </h3>
      <div className="space-y-2">
        <StatusBadge
          label="Codex API"
          online={status?.gateway.online ?? false}
          detail={status?.gateway.online ? "Connected" : "Check ~/.codex/auth.json"}
        />
      </div>

      <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-4">
        Optional
      </h3>
      <div className="space-y-2">
        <StatusBadge
          label="LM Studio (local model)"
          online={status?.lmstudio.online ?? false}
          detail={status?.lmstudio.online ? status.lmstudio.model : "Not required for Codex"}
        />
        <StatusBadge
          label="Tailscale (remote access)"
          online={status?.tailscale.online ?? false}
          detail={status?.tailscale.online ? status.tailscale.ip : "Only needed for phone access"}
        />
        <StatusBadge
          label="App Bridge (Phase 2)"
          online={status?.bridge.online ?? false}
          detail={
            status?.bridge.online
              ? `${status.bridge.windows.length} window(s)`
              : "Not yet implemented"
          }
        />
      </div>

      {status && (
        <div className="mt-6 space-y-2">
          <div className="flex justify-between px-4 py-2 text-xs text-neutral-500">
            <span>Active Sessions</span>
            <span className="text-neutral-300">{status.activeSessions}</span>
          </div>
          <div className="flex justify-between px-4 py-2 text-xs text-neutral-500">
            <span>Pending Approvals</span>
            <span className="text-neutral-300">{status.pendingApprovals}</span>
          </div>
          <div className="flex justify-between px-4 py-2 text-xs text-neutral-500">
            <span>Last Activity</span>
            <span className="text-neutral-300">
              {new Date(status.lastActivity).toLocaleTimeString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
