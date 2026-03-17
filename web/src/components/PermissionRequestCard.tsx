import type { PermissionRequestItem } from "../lib/conversation-types";

interface Props {
  item: PermissionRequestItem;
  onApprove: (requestId: number, scope: "turn" | "session") => void;
  onDeny: (requestId: number) => void;
}

function summarizePermissions(permissions: Record<string, unknown>): string[] {
  const lines: string[] = [];

  const network = permissions.network as Record<string, unknown> | undefined;
  if (network) {
    const hosts = Object.values(network)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .map(String);
    if (hosts.length > 0) {
      lines.push(`Network: ${hosts.join(", ")}`);
    } else {
      lines.push("Network access requested");
    }
  }

  const fileSystem = permissions.fileSystem as Record<string, unknown> | undefined;
  if (fileSystem) {
    const paths = Object.values(fileSystem)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter(Boolean)
      .map(String);
    if (paths.length > 0) {
      lines.push(`File system: ${paths.join(", ")}`);
    } else {
      lines.push("File system access requested");
    }
  }

  const macos = permissions.macos as Record<string, unknown> | undefined;
  if (macos) {
    const values = Object.values(macos).filter(Boolean).map(String);
    lines.push(
      values.length > 0
        ? `macOS permissions: ${values.join(", ")}`
        : "macOS permissions requested"
    );
  }

  if (lines.length === 0) {
    lines.push("Additional permissions requested");
  }

  return lines;
}

export function PermissionRequestCard({ item, onApprove, onDeny }: Props) {
  const summaryLines = summarizePermissions(item.permissions);
  const isPending = item.status === "pending";

  return (
    <div
      className="mx-3 my-2 rounded-xl overflow-hidden"
      style={{
        background: "var(--bg-secondary)",
        border: `1px solid ${isPending ? "var(--accent-amber-mid)" : "var(--border-default)"}`,
        opacity: item.status === "denied" ? 0.65 : 1,
      }}
    >
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: "1px solid var(--border-subtle)" }}
      >
        <span
          className="text-xs font-semibold"
          style={{ color: isPending ? "var(--accent-amber)" : "var(--text-secondary)" }}
        >
          Permission Request
        </span>
      </div>

      <div className="px-3 py-2 space-y-2">
        <div className="text-sm leading-relaxed" style={{ color: "var(--text-primary)" }}>
          {item.reason || "Codex needs extra permissions to continue this turn."}
        </div>

        <div className="space-y-1">
          {summaryLines.map((line) => (
            <div
              key={line}
              className="text-xs leading-relaxed"
              style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
            >
              {line}
            </div>
          ))}
        </div>
      </div>

      {isPending && item.requestId !== undefined ? (
        <div
          className="grid grid-cols-3 gap-2 px-3 py-2.5"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <button
            onClick={() => onDeny(item.requestId!)}
            className="py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--accent-red)",
              border: "1px solid var(--accent-red-dim)",
            }}
          >
            拒绝
          </button>
          <button
            onClick={() => onApprove(item.requestId!, "turn")}
            className="py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--bg-tertiary)",
              color: "var(--accent-cyan)",
              border: "1px solid var(--accent-cyan-dim)",
            }}
          >
            本次允许
          </button>
          <button
            onClick={() => onApprove(item.requestId!, "session")}
            className="py-2 rounded-lg text-xs font-semibold btn-press"
            style={{
              background: "var(--accent-cyan)",
              color: "var(--text-inverse)",
            }}
          >
            会话允许
          </button>
        </div>
      ) : (
        <div
          className="px-3 py-2 text-xs font-medium"
          style={{
            borderTop: "1px solid var(--border-subtle)",
            color: item.status === "approved" ? "var(--accent-green)" : "var(--accent-red)",
          }}
        >
          {item.status === "approved" ? "Permissions granted" : "Permission request denied"}
        </div>
      )}
    </div>
  );
}
