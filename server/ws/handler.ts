import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { validateWsToken } from "../auth.js";
import { appServerManager } from "../app-server-manager.js";
import type { ReviewDecision } from "../app-server-manager.js";
import { codexHistoryService } from "../services/codex-history.js";

// ── Client tracking ──

interface ClientState {
  activeSessionId: string | null;
  subscribedSessionIds: Set<string>;
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
    if (state.subscribedSessionIds.has(sessionId)) {
      send(ws, { sessionId, ...msg });
    }
  }
}

function getSessionId(ws: WebSocket, msg: Record<string, unknown>): string | null {
  const state = clients.get(ws);
  return ((msg.sessionId as string) || state?.activeSessionId || null);
}

function attachToSession(ws: WebSocket, sessionId: string) {
  const state = clients.get(ws);
  if (!state) return;
  state.activeSessionId = sessionId;
  state.subscribedSessionIds.add(sessionId);
}

function detachSessionEverywhere(sessionId: string) {
  for (const state of clients.values()) {
    state.subscribedSessionIds.delete(sessionId);
    if (state.activeSessionId === sessionId) {
      state.activeSessionId = null;
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

        case "thread/tokenUsage/updated":
          broadcastToSession(sessionId, {
            type: "token_usage",
            tokenUsage: p.tokenUsage,
          });
          break;

        // ── Plan ──
        case "turn/plan/updated":
          broadcastToSession(sessionId, {
            type: "task_update",
            turnId: p.turnId,
            explanation: p.explanation,
            plan: p.plan,
          });
          break;

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

        case "item/permissions/requestApproval":
          broadcastToSession(sessionId, {
            type: "permission_request",
            requestId,
            itemId: p.itemId,
            reason: p.reason,
            permissions: p.permissions,
          });
          break;

        case "item/tool/requestUserInput":
          broadcastToSession(sessionId, {
            type: "user_input_request",
            requestId,
            itemId: p.itemId,
            questions: p.questions,
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
    detachSessionEverywhere(sessionId);
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

    clients.set(ws, { activeSessionId: null, subscribedSessionIds: new Set() });

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
      const clientRequestId = msg.clientRequestId as string | undefined;
      const skipThreadStart = Boolean(msg.skipThreadStart);
      if (!workspace) {
        send(ws, {
          type: "session_start_failed",
          clientRequestId,
          workspace,
          message: "workspace is required",
        });
        return;
      }

      let sessionId: string | null = null;
      try {
        // 1. Start the app-server process
        const session = appServerManager.start(workspace);
        sessionId = session.id;

        // 2. Initialize the protocol
        await appServerManager.initialize(session.id);

        const model = msg.model as string | undefined;
        const approvalPolicy = (msg.approvalPolicy as string) || "on-request";
        let threadId: string | null = null;

        if (!skipThreadStart) {
          const thread = await appServerManager.startThread(session.id, {
            model,
            cwd: workspace,
            approvalPolicy: approvalPolicy as "untrusted" | "on-failure" | "on-request" | "never",
          });
          threadId = thread.id;
        }

        attachToSession(ws, session.id);
        send(ws, {
          type: "session_started",
          sessionId: session.id,
          threadId,
          workspace,
          clientRequestId,
        });

        // 4. If there's an initial prompt, send it as the first turn
        const prompt = msg.prompt as string | undefined;
        if (prompt && threadId) {
          const effort = msg.reasoningEffort as string | undefined;
          await appServerManager.sendTurn(session.id, prompt, {
            model,
            effort: effort as "low" | "medium" | "high" | "xhigh" | undefined,
          });
        }
      } catch (err) {
        if (sessionId) {
          appServerManager.kill(sessionId);
        }
        send(ws, {
          type: "session_start_failed",
          clientRequestId,
          workspace,
          message: `Failed to start session: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "send_message": {
      const sessionId = getSessionId(ws, msg);
      const text = msg.text as string;

      if (!sessionId || !text) {
        send(ws, { type: "error", message: "sessionId and text are required" });
        return;
      }

      try {
        const model = msg.model as string | undefined;
        const effort = msg.reasoningEffort as string | undefined;
        const collab = msg.collaborationMode as string | undefined;
        await appServerManager.sendTurn(sessionId, text, {
          model,
          effort: effort as "low" | "medium" | "high" | "xhigh" | undefined,
          collaborationMode: collab as "plan" | "default" | undefined,
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
      const sessionId = getSessionId(ws, msg);
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
      const sessionId = getSessionId(ws, msg);
      const requestId = msg.requestId as number;

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      appServerManager.respondToApproval(sessionId, requestId, "denied");
      break;
    }

    case "grant_permissions": {
      const sessionId = getSessionId(ws, msg);
      const requestId = msg.requestId as number;
      const scope = (msg.scope as "turn" | "session") || "turn";

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      appServerManager.respondToPermissions(sessionId, requestId, scope);
      break;
    }

    case "submit_user_input": {
      const sessionId = getSessionId(ws, msg);
      const requestId = msg.requestId as number;
      const answers = (msg.answers as Record<string, string[]>) || {};

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      appServerManager.respondToUserInput(sessionId, requestId, answers);
      break;
    }

    case "reject_request": {
      const sessionId = getSessionId(ws, msg);
      const requestId = msg.requestId as number;
      const message = (msg.message as string) || "Request denied by user";

      if (!sessionId || requestId === undefined) {
        send(ws, { type: "error", message: "sessionId and requestId are required" });
        return;
      }

      appServerManager.rejectServerRequest(sessionId, requestId, message);
      break;
    }

    case "interrupt": {
      const sessionId = getSessionId(ws, msg);
      if (sessionId) {
        await appServerManager.interruptTurn(sessionId);
      }
      break;
    }

    case "kill_session": {
      const sessionId = getSessionId(ws, msg);
      if (sessionId) {
        appServerManager.kill(sessionId);
        broadcastToSession(sessionId, { type: "session_killed" });
        detachSessionEverywhere(sessionId);
      }
      break;
    }

    case "attach_session": {
      const sessionId = msg.sessionId as string;
      if (sessionId && appServerManager.get(sessionId)) {
        attachToSession(ws, sessionId);
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

    case "compact_thread": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.activeSessionId;
      if (!sessionId) break;
      const session = appServerManager.get(sessionId);
      if (session?.threadId) {
        try {
          await (appServerManager as any).sendRequest(
            session, "thread/compact/start", { threadId: session.threadId }
          );
          send(ws, { type: "notification", method: "compact", params: { message: "上下文已压缩" } });
        } catch (err) {
          send(ws, { type: "error", message: `压缩失败: ${err instanceof Error ? err.message : err}` });
        }
      }
      break;
    }

    case "rollback_thread": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.activeSessionId;
      if (!sessionId) break;
      const session = appServerManager.get(sessionId);
      if (session?.threadId) {
        try {
          await (appServerManager as any).sendRequest(
            session, "thread/rollback", { threadId: session.threadId }
          );
          send(ws, { type: "notification", method: "rollback", params: { message: "已撤销上一轮" } });
        } catch (err) {
          send(ws, { type: "error", message: `撤销失败: ${err instanceof Error ? err.message : err}` });
        }
      }
      break;
    }

    case "review_start": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.activeSessionId;
      if (!sessionId) break;
      try {
        await (appServerManager as any).sendRequest(
          appServerManager.get(sessionId), "review/start", { threadId: appServerManager.get(sessionId)?.threadId }
        );
      } catch (err) {
        send(ws, { type: "error", message: `代码审查失败: ${err instanceof Error ? err.message : err}` });
      }
      break;
    }

    case "fork_thread": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.activeSessionId;
      if (!sessionId) break;
      const session = appServerManager.get(sessionId);
      if (!session?.threadId) break;
      try {
        const result = await (appServerManager as any).sendRequest(
          session, "thread/fork", { threadId: session.threadId }
        );
        const thread = (result as any)?.thread;
        if (thread) {
          session.threadId = thread.id;
          send(ws, { type: "session_started", sessionId, threadId: thread.id, workspace: session.workspace });
        }
      } catch (err) {
        send(ws, { type: "error", message: `分叉失败: ${err instanceof Error ? err.message : err}` });
      }
      break;
    }

    case "set_thread_name": {
      const state = clients.get(ws);
      const sessionId = (msg.sessionId as string) || state?.activeSessionId;
      const name = msg.name as string;
      if (!sessionId || !name) break;
      const session = appServerManager.get(sessionId);
      if (!session?.threadId) break;
      try {
        await (appServerManager as any).sendRequest(
          session, "thread/name/set", { threadId: session.threadId, name }
        );
        send(ws, { type: "notification", method: "name_set", params: { name } });
      } catch (err) {
        send(ws, { type: "error", message: `命名失败: ${err instanceof Error ? err.message : err}` });
      }
      break;
    }

    case "new_thread": {
      const sessionId = getSessionId(ws, msg);
      const workspace = msg.workspace as string;
      const approvalPolicy = (msg.approvalPolicy as string) || "on-request";
      const prompt = msg.prompt as string | undefined;
      const model = msg.model as string | undefined;
      const effort = msg.reasoningEffort as string | undefined;

      if (!sessionId) {
        send(ws, { type: "error", message: "No active session" });
        return;
      }

      try {
        const thread = await appServerManager.startThread(sessionId, {
          model,
          cwd: workspace || undefined,
          approvalPolicy: approvalPolicy as "untrusted" | "on-failure" | "on-request" | "never",
        });
        send(ws, {
          type: "session_started",
          sessionId,
          threadId: thread.id,
          workspace: workspace || "",
        });

        if (prompt) {
          try {
            await appServerManager.sendTurn(sessionId, prompt, {
              model,
              effort: effort as "low" | "medium" | "high" | "xhigh" | undefined,
            });
          } catch (err) {
            send(ws, {
              type: "error",
              sessionId,
              message: `Failed to send initial prompt: ${err instanceof Error ? err.message : err}`,
            });
          }
        }
      } catch (err) {
        send(ws, {
          type: "error",
          sessionId,
          message: `Failed to create thread: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "list_skills": {
      const sessionId = getSessionId(ws, msg);
      if (!sessionId) {
        send(ws, { type: "error", message: "No active session" });
        return;
      }
      try {
        const result = await appServerManager.listSkills(sessionId);
        send(ws, { type: "skills_list", sessionId, data: result });
      } catch (err) {
        send(ws, { type: "skills_list", sessionId, data: { data: [] } });
      }
      break;
    }

    case "list_threads": {
      const sessionId = getSessionId(ws, msg);
      if (!sessionId) {
        send(ws, { type: "error", message: "No active session. Start a session first." });
        return;
      }
      try {
        const threads = await appServerManager.listThreads(sessionId);
        send(ws, { type: "threads_list", sessionId, threads });
      } catch (err) {
        send(ws, {
          type: "error",
          sessionId,
          message: `Failed to list threads: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "resume_thread": {
      const sessionId = getSessionId(ws, msg);
      const threadId = msg.threadId as string;

      if (!sessionId || !threadId) {
        send(ws, { type: "error", message: "sessionId and threadId are required" });
        return;
      }

      try {
        const thread = await appServerManager.resumeThread(sessionId, threadId);
        send(ws, {
          type: "thread_resumed",
          sessionId,
          thread,
        });
      } catch (err) {
        const message = `Failed to resume thread: ${err instanceof Error ? err.message : err}`;

        if (message.includes("no rollout found")) {
          const degradedThread = codexHistoryService.markResumeFailure(threadId, message);
          send(ws, {
            type: "thread_resume_unavailable",
            sessionId,
            threadId,
            thread: degradedThread,
            message,
          });
          return;
        }

        send(ws, {
          type: "error",
          sessionId,
          message,
        });
      }
      break;
    }
  }
}
