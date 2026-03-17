import { create } from "zustand";
import type { WindowInfo } from "../lib/types";

interface BridgeState {
  online: boolean;
  windows: WindowInfo[];
  selectedWindowId: string | null;
  fps: number;

  setOnline: (online: boolean) => void;
  setWindows: (windows: WindowInfo[]) => void;
  selectWindow: (id: string | null) => void;
  setFps: (fps: number) => void;
}

export const useBridgeStore = create<BridgeState>((set) => ({
  online: false,
  windows: [],
  selectedWindowId: null,
  fps: 2,

  setOnline: (online) => set({ online }),
  setWindows: (windows) => set({ windows }),
  selectWindow: (id) => set({ selectedWindowId: id }),
  setFps: (fps) => set({ fps }),
}));
