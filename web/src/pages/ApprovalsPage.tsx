import { useApprovalsStore } from "../stores/approvals";
import { ApprovalCard } from "../components/ApprovalCard";

interface Props {
  onDecide: (id: string, decision: "allow" | "deny") => void;
}

export function ApprovalsPage({ onDecide }: Props) {
  const approvals = useApprovalsStore((s) => s.approvals);
  const pending = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className="text-lg font-bold text-neutral-200 mb-4">Approvals</h2>

      {approvals.length === 0 && (
        <div className="flex flex-col items-center justify-center h-[60vh] text-neutral-600">
          <span className="text-3xl mb-2">A</span>
          <p className="text-sm">No approval requests yet</p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
            Pending ({pending.length})
          </h3>
          {pending.map((a) => (
            <ApprovalCard key={a.id} approval={a} onDecide={onDecide} />
          ))}
        </>
      )}

      {resolved.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2 mt-6">
            Resolved
          </h3>
          {resolved.map((a) => (
            <ApprovalCard key={a.id} approval={a} onDecide={onDecide} />
          ))}
        </>
      )}
    </div>
  );
}
