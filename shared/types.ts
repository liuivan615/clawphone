// ── Shared types between server and client ──

export interface SessionSummary {
  id: string;
  title: string;
  status: "active" | "idle" | "closed";
  updatedAt: string;
  hasPendingApproval: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: string;
  name: string;
  arguments: Record<string, unknown>;
  status: "pending" | "approved" | "denied" | "completed";
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  tool: string;
  detail: {
    command?: string;
    filePath?: string;
    diff?: string;
    description?: string;
  };
  riskLevel: "low" | "medium" | "high";
  timestamp: string;
  status: "pending" | "approved" | "denied";
}

export interface StatusPayload {
  gateway: { online: boolean; port: number; uptime?: string };
  lmstudio: { online: boolean; model?: string; port: number };
  tailscale: { online: boolean; hostname?: string; ip?: string };
  bridge: { online: boolean; windows: string[] };
  activeSessions: number;
  pendingApprovals: number;
  lastActivity: string;
}

// ── WebSocket protocol ──

export type ServerEvent =
  | { type: "session_created"; sessionId: string; requestSessionId?: string }
  | { type: "chat_delta"; sessionId: string; content: string }
  | { type: "chat_done"; sessionId: string; messageId: string }
  | {
      type: "approval_request";
      approval: ApprovalRequest;
    }
  | {
      type: "approval_resolved";
      id: string;
      decision: "allow" | "deny";
    }
  | { type: "status_update"; payload: StatusPayload }
  | { type: "error"; message: string }
  | { type: "pong" };

export type ClientEvent =
  | {
      type: "send_message";
      sessionId?: string;
      message: string;
      model?: string;
    }
  | { type: "approve"; id: string; decision: "allow" | "deny" }
  | { type: "ping" };

// ── Bridge protocol ──

export interface WindowInfo {
  id: string;
  title: string;
  processName: string;
  bounds: { x: number; y: number; w: number; h: number };
}

export type BridgeServerEvent =
  | {
      type: "frame_meta";
      windowId: string;
      width: number;
      height: number;
      fps: number;
    }
  | { type: "windows_list"; windows: WindowInfo[] }
  | { type: "bridge_status"; online: boolean };

export type BridgeClientEvent =
  | { type: "select_window"; windowId: string }
  | {
      type: "input";
      windowId: string;
      input:
        | { type: "click"; x: number; y: number; button?: "left" | "right" }
        | { type: "key"; key: string; modifiers?: string[] }
        | { type: "text"; value: string }
        | { type: "scroll"; deltaY: number };
    }
  | { type: "set_fps"; fps: number }
  | { type: "set_quality"; quality: number; scale: number };
