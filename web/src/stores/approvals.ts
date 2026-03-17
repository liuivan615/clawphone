import { create } from "zustand";
import type { ApprovalRequest } from "../lib/types";

interface ApprovalsState {
  approvals: ApprovalRequest[];
  addApproval: (a: ApprovalRequest) => void;
  resolveApproval: (id: string, decision: "allow" | "deny") => void;
  pendingCount: () => number;
}

export const useApprovalsStore = create<ApprovalsState>((set, get) => ({
  approvals: [],

  addApproval: (a) =>
    set((s) => {
      // Don't duplicate
      if (s.approvals.some((x) => x.id === a.id)) return s;
      return { approvals: [a, ...s.approvals] };
    }),

  resolveApproval: (id, decision) =>
    set((s) => ({
      approvals: s.approvals.map((a) =>
        a.id === id
          ? { ...a, status: decision === "allow" ? "approved" : "denied" as const }
          : a
      ),
    })),

  pendingCount: () => get().approvals.filter((a) => a.status === "pending").length,
}));
