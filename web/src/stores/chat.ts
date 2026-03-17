import { create } from "zustand";
import type { ChatMessage } from "../lib/types";

interface ChatState {
  messages: ChatMessage[];
  currentSessionId: string | null;
  isStreaming: boolean;
  streamingContent: string;

  addMessage: (msg: ChatMessage) => void;
  appendDelta: (content: string) => void;
  startStreaming: (sessionId: string) => void;
  finishStreaming: (messageId: string) => void;
  setSessionId: (id: string) => void;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  currentSessionId: null,
  isStreaming: false,
  streamingContent: "",

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendDelta: (content) =>
    set((s) => ({ streamingContent: s.streamingContent + content })),

  startStreaming: (sessionId) =>
    set({ isStreaming: true, streamingContent: "", currentSessionId: sessionId }),

  finishStreaming: (messageId) => {
    const { streamingContent, messages } = get();
    if (streamingContent) {
      set({
        messages: [
          ...messages,
          {
            id: messageId,
            role: "assistant",
            content: streamingContent,
            timestamp: new Date().toISOString(),
          },
        ],
        isStreaming: false,
        streamingContent: "",
      });
    } else {
      set({ isStreaming: false });
    }
  },

  setSessionId: (id) => set({ currentSessionId: id }),

  clearChat: () =>
    set({
      messages: [],
      currentSessionId: null,
      isStreaming: false,
      streamingContent: "",
    }),
}));
