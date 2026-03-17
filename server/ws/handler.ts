import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { validateWsToken } from "../auth.js";
import { appServerManager } from "../app-server-manager.js";
import type { ReviewDecision } from "../app-server-manager.js";

// ── Client tracking ──

interface ClientState {
  sessionId: string | null;
}

const clients = new Map<WebSocket, ClientState>();

// ── Helpers ──

interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function broadcastToSession(sessionId: string, msg: ServerMessage) {
  for (const [ws, state] of clients) {
    if (state.sessionId === sessionId) {
      send(ws, msg);
    }
  }
}

// ── Main handler ──

export default async function wsHandler(app: FastifyInstance) {
  // Forward app-server notifications to WebSocket clients
  appServerManager.on(
    "notification",
    (sessionId: string, method: string, params: unknown) => {
      const p = params as Record<string, unknown>;

      switch (method) {
        // ── Agent text streaming ──
        case "item/agentMessage/delta":
          broadcastToSession(sessionId, {
            type: "agent_text",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        // ── Reasoning ──
        case "item/reasoning/textDelta":
          broadcastToSession(sessionId, {
            type: "reasoning",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        case "item/reasoning/summaryTextDelta":
          broadcastToSession(sessionId, {
            type: "reasoning_summary",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        // ── Command execution output ──
        case "item/commandExecution/outputDelta":
          broadcastToSession(sessionId, {
            type: "command_output",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        // ── File change output ──
        case "item/fileChange/outputDelta":
          broadcastToSession(sessionId, {
            type: "file_change_output",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        // ── Item lifecycle ──
        case "item/started":
          broadcastToSession(sessionId, {
            type: "item_started",
            item: (p as { item: unknown }).item,
          });
          break;

        case "item/completed":
          broadcastToSession(sessionId, {
            type: "item_completed",
            item: (p as { item: unknown }).item,
          });
          break;

        // ── Turn lifecycle ──
        case "turn/started":
          broadcastToSession(sessionId, {
            type: "turn_started",
            turn: (p as { turn: unknown }).turn,
          });
          break;

        case "turn/completed":
          broadcastToSession(sessionId, {
            type: "turn_completed",
            turn: (p as { turn: unknown }).turn,
          });
          break;

        // ── Thread lifecycle ──
        case "thread/started":
          broadcastToSession(sessionId, {
            type: "thread_started",
            thread: (p as { thread: unknown }).thread,
          });
          break;

        case "thread/status/changed":
          broadcastToSession(sessionId, {
            type: "thread_status_changed",
            status: p.status,
          });
          break;

        // ── Plan ──
        case "item/plan/delta":
          broadcastToSession(sessionId, {
            type: "plan_delta",
            itemId: p.itemId,
            delta: p.delta,
          });
          break;

        case "turn/diff/updated":
          broadcastToSession(sessionId, {
            type: "turn_diff_updated",
            diff: p.diff,
          });
          break;

        // ── Errors ──
        case "error":
          broadcastToSession(sessionId, {
            type: "error",
            message: (p as { message?: string }).message || "Unknown error",
          });
          break;

        // ── Pass through other notifications ──
        default:
          broadcastToSession(sessionId, {
            type: "notification",
            method,
            params: p,
          });
          break;
      }
    }
  );

  // Forward approval requests from Codex to WebSocket clients
  appServerManager.on(
    "server_request",
    (sessionId: string, method: string, requestId: number, params: unknown) => {
      const p = params as Record<string, unknown>;

      switch (method) {
        case "item/commandExecution/requestApproval":
          broadcastToSession(sessionId, {
            type: "command_approval_request",
            requestId,
            itemId: p.itemId,
            command: p.command,
            cwd: p.cwd,
            reason: p.reason,
            commandActions: p.commandActions,
          });
          break;

        case "item/fileChange/requestApproval":
          broadcastToSession(sessionId, {
            type: "file_change_approval_request",
            requestId,
            itemId: p.itemId,
            reason: p.reason,
          });
          break;

        case "execCommandApproval":
          broadcastToSession(sessionId, {
            type: "command_approval_request",
            requestId,
            itemId: p.callId,
            command: Array.isArray(p.command) ? (p.command as string[]).join(" ") : p.command,
            cwd: p.cwd,
            reason: p.reason,
          });
          break;

        case "applyPatchApproval":
          broadcastToSession(sessionId, {
            type: "file_change_approval_request",
            requestId,
            itemId: p.callId,
            fileChanges: p.fileChanges,
            reason: p.reason,
          });
          break;

        default:
          // Forward unknown server requests
          broadcastToSession(sessionId, {
            type: "server_request",
            method,
            requestId,
            params: p,
          });
          break;
      }
    }
  );

  // Handle session close
  appServerManager.on("session_closed", (sessionId: string, code: number) => {
    broadcastToSession(sessionId, {
      type: "session_closed",
      exitCode: code,
    });
  });

  appServerManager.on("session_error", (sessionId: string, message: string) => {
    broadcastToSession(sessionId, {
      type: "error",
      message: `App server error: ${message}`,
    });
  });

  // ── WebSocket endpoint ──

  app.get("/ws", { websocket: true }, (socket, _request) => {
    const ws = socket as unknown as WebSocket;

    // Auth check
    const url = new URL(_request.url || "/", `http://${_request.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token || !validateWsToken(token)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    clients.set(ws, { sessionId: null });

    // Send existing sessions list
    send(ws, {
      type: "sessions_list",
      sessions: appServerManager.getAll(),
    });

    ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        handleMessage(ws, msg);
      } catch {
        send(ws, { type: "error", message: "Invalid message format" });
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
    });
  });
}

// ── Message handler ──

async function handleMessage(ws: WebSocket, msg: Record<string, unknown>) {
  switch (msg.type) {
    case "ping":
      send(ws, { type: "pong" });
      break;

    case "start_session": {
      const workspace = msg.workspace as string;
      if (!workspace) {
        send(ws, { type: "error", message: "workspace is required" });
        return;
      }

      try {
        // 1. Start the app-server process
        const session = appServerManager.start(workspace);
        const state = clients.get(ws);
        if (state) state.sessionId = session.id;

        // 2. Initialize the protocol
        await appServerManager.initialize(session.id);

        // 3. Fetch persisted thread history and send to client
        try {
          const threads = await appServerManager.listThreads(session.id);
          send(ws, { type: "threads_list", threads });
        } catch {
          // thread/list may fail on first run, that's ok
        }

        // 4. Start a new thread
        const model = msg.model as string | undefined;
        const approvalPolicy = (msg.approvalPolicy as string) || "on-request";
        const thread = await appServerManager.startThread(session.id, {
          model,
          cwd: workspace,
          approvalPolicy: approvalPolicy as "untrusted" | "on-failure" | "on-request" | "never",
        });

        send(ws, {
          type: "session_started",
          sessionId: session.id,
          threadId: thread.id,
          workspace,
        });

        // 5. If there's an initial prompt, send it as the first turn
        const prompt = msg.prompt as string | undefined;
        if (prompt) {
          const effort = msg.reasoningEffort as string | undefined;
          await appServerManager.sendTurn(session.id, prompt, {
            model,
            effort: effort as "low" | "medium" | "high" | "xhigh" | undefined,
          });
        }
      } catch (err) {
        send(ws, {
          type: "error",
          message: `Failed to start session: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "send_message": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      const text = msg.text as string;

      if (!sessionId || !text) {
        send(ws, { type: "error", message: "sessionId and text are required" });
        return;
      }

      try {
        const model = msg.model as string | undefined;
        const effort = msg.reasoningEffort as string | undefined;
        await appServerManager.sendTurn(sessionId, text, {
          model,
          effort: effort as "low" | "medium" | "high" | "xhigh" | undefined,
        });
      } catch (err) {
        send(ws, {
          type: "error",
          message: `Failed to send message: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "approve": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      const requestId = msg.requestId as number;

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      const decision = (msg.decision as ReviewDecision) || "approved";
      appServerManager.respondToApproval(sessionId, requestId, decision);
      break;
    }

    case "deny": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      const requestId = msg.requestId as number;

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      appServerManager.respondToApproval(sessionId, requestId, "denied");
      break;
    }

    case "interrupt": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      if (sessionId) {
        await appServerManager.interruptTurn(sessionId);
      }
      break;
    }

    case "kill_session": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      if (sessionId) {
        appServerManager.kill(sessionId);
        send(ws, { type: "session_killed", sessionId });
      }
      break;
    }

    case "attach_session": {
      const sessionId = msg.sessionId as string;
      if (sessionId && appServerManager.get(sessionId)) {
        const state = clients.get(ws);
        if (state) state.sessionId = sessionId;
        send(ws, {
          type: "attached",
          sessionId,
        });
      }
      break;
    }

    case "list_sessions":
      send(ws, {
        type: "sessions_list",
        sessions: appServerManager.getAll(),
      });
      break;

    case "list_threads": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      if (!sessionId) {
        send(ws, { type: "error", message: "No active session. Start a session first." });
        return;
      }
      try {
        const threads = await appServerManager.listThreads(sessionId);
        send(ws, { type: "threads_list", threads });
      } catch (err) {
        send(ws, { type: "error", message: `Failed to list threads: ${err instanceof Error ? err.message : err}` });
      }
      break;
    }

    case "resume_thread": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.sessionId;
      const threadId = msg.threadId as string;

      if (!sessionId || !threadId) {
        send(ws, { type: "error", message: "sessionId and threadId are required" });
        return;
      }

      try {
        const thread = await appServerManager.resumeThread(sessionId, threadId);
        send(ws, {
          type: "thread_resumed",
          thread,
        });
      } catch (err) {
        send(ws, { type: "error", message: `Failed to resume thread: ${err instanceof Error ? err.message : err}` });
      }
      break;
    }
  }
}
