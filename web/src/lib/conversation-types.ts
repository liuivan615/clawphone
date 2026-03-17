// ── Conversation item types for rendering ──

export type ConversationItem =
  | UserMessageItem
  | AgentTextItem
  | ReasoningItem
  | CommandCallItem
  | FileChangeItem
  | SystemItem;

export interface UserMessageItem {
  type: "user_message";
  id: string;
  text: string;
  timestamp: number;
}

export interface AgentTextItem {
  type: "agent_text";
  id: string;
  content: string;
  streaming: boolean;
  timestamp: number;
}

export interface ReasoningItem {
  type: "reasoning";
  id: string;
  content: string;
  summary: string;
  streaming: boolean;
  timestamp: number;
}

export interface CommandCallItem {
  type: "command_call";
  id: string;
  command: string;
  cwd?: string;
  status: "pending" | "approved" | "denied" | "running" | "completed" | "failed";
  output: string;
  exitCode: number | null;
  durationMs: number | null;
  requestId?: number; // JSON-RPC request id for approval response
  timestamp: number;
}

export interface FileChangeItem {
  type: "file_change";
  id: string;
  changes: Array<{
    path: string;
    kind: "add" | "delete" | "update";
    diff: string;
  }>;
  status: "pending" | "approved" | "denied" | "running" | "completed" | "failed";
  requestId?: number;
  timestamp: number;
}

export interface SystemItem {
  type: "system";
  id: string;
  content: string;
  timestamp: number;
}

// ── Turn state ──

export interface TurnState {
  active: boolean;
  turnId: string | null;
}
