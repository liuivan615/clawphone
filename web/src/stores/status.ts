import { create } from "zustand";
import type { StatusPayload } from "../lib/types";
import { api } from "../lib/api";

interface StatusState {
  status: StatusPayload | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useStatusStore = create<StatusState>((set) => ({
  status: null,
  loading: false,
  error: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const status = await api.getStatus();
      set({ status, loading: false });
    } catch (e) {
      set({
        error: e instanceof Error ? e.message : "Failed to fetch status",
        loading: false,
      });
    }
  },
}));
