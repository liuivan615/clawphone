import type { ApprovalRequest } from "../lib/types";

interface Props {
  approval: ApprovalRequest;
  onDecide: (id: string, decision: "allow" | "deny") => void;
}

const riskColors = {
  low: "border-emerald-700 bg-emerald-950/30",
  medium: "border-amber-700 bg-amber-950/30",
  high: "border-red-700 bg-red-950/30",
};

const riskLabels = {
  low: "Low Risk",
  medium: "Medium Risk",
  high: "High Risk",
};

const riskDots = {
  low: "bg-emerald-400",
  medium: "bg-amber-400",
  high: "bg-red-400",
};

export function ApprovalCard({ approval, onDecide }: Props) {
  const isPending = approval.status === "pending";
  const time = new Date(approval.timestamp).toLocaleTimeString();

  return (
    <div
      className={`rounded-xl border p-4 mb-3 ${riskColors[approval.riskLevel]} ${
        !isPending ? "opacity-60" : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-neutral-200">
            {approval.tool}
          </span>
          <span className={`w-2 h-2 rounded-full ${riskDots[approval.riskLevel]}`} />
          <span className="text-xs text-neutral-500">{riskLabels[approval.riskLevel]}</span>
        </div>
        <span className="text-xs text-neutral-600">{time}</span>
      </div>

      {/* Detail */}
      <div className="mb-3">
        {approval.detail.command && (
          <pre className="bg-neutral-900 rounded-lg p-2.5 text-xs font-mono text-neutral-300 overflow-x-auto">
            {approval.detail.command}
          </pre>
        )}
        {approval.detail.filePath && (
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            {approval.detail.filePath}
          </p>
        )}
        {approval.detail.diff && (
          <pre className="bg-neutral-900 rounded-lg p-2.5 text-xs font-mono text-neutral-300 overflow-x-auto mt-2 max-h-40">
            {approval.detail.diff}
          </pre>
        )}
        {approval.detail.description && !approval.detail.command && (
          <p className="text-sm text-neutral-300">{approval.detail.description}</p>
        )}
      </div>

      {/* Actions */}
      {isPending ? (
        <div className="flex gap-3">
          <button
            onClick={() => onDecide(approval.id, "deny")}
            className="flex-1 py-2.5 rounded-lg border border-red-700 text-red-400 text-sm font-medium active:bg-red-900/30 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => onDecide(approval.id, "allow")}
            className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium active:bg-emerald-700 transition-colors"
          >
            Allow
          </button>
        </div>
      ) : (
        <div
          className={`text-center text-sm font-medium py-2 rounded-lg ${
            approval.status === "approved"
              ? "text-emerald-400 bg-emerald-950/50"
              : "text-red-400 bg-red-950/50"
          }`}
        >
          {approval.status === "approved" ? "Approved" : "Denied"}
        </div>
      )}
    </div>
  );
}
