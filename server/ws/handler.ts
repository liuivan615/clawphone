import type { FastifyInstance } from "fastify";
import type { WebSocket } from "ws";
import { validateWsToken } from "../auth.js";
import { codexManager } from "../codex-manager.js";

const clients = new Map<WebSocket, string | null>(); // ws -> active session id

interface ServerMessage {
  type: string;
  [key: string]: unknown;
}

function send(ws: WebSocket, msg: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

export default async function wsHandler(app: FastifyInstance) {
  // Forward codex output to connected clients
  codexManager.on("output", (sessionId: string, rawData: string, cleanData: string) => {
    for (const [ws, activeSession] of clients) {
      if (activeSession === sessionId) {
        send(ws, {
          type: "codex_output",
          sessionId,
          data: rawData,      // with ANSI codes (for terminal rendering)
          clean: cleanData,   // stripped (for simple display)
        });
      }
    }
  });

  codexManager.on("exit", (sessionId: string, exitCode: number) => {
    for (const [ws, activeSession] of clients) {
      if (activeSession === sessionId) {
        send(ws, {
          type: "codex_exit",
          sessionId,
          exitCode,
        });
      }
    }
  });

  app.get("/ws", { websocket: true }, (socket, _request) => {
    const ws = socket as unknown as WebSocket;

    // Auth check
    const url = new URL(_request.url || "/", `http://${_request.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token || !validateWsToken(token)) {
      ws.close(4001, "Unauthorized");
      return;
    }

    clients.set(ws, null);

    // Send existing sessions list on connect
    send(ws, {
      type: "sessions_list",
      sessions: codexManager.getAll(),
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

function handleMessage(ws: WebSocket, msg: Record<string, unknown>) {
  switch (msg.type) {
    case "ping":
      send(ws, { type: "pong" });
      break;

    case "start_codex": {
      // Start a new Codex session
      const workspace = msg.workspace as string;
      const prompt = msg.prompt as string | undefined;

      if (!workspace) {
        send(ws, { type: "error", message: "workspace is required" });
        return;
      }

      try {
        const session = codexManager.start(workspace, prompt);
        clients.set(ws, session.id);
        send(ws, {
          type: "codex_started",
          sessionId: session.id,
          workspace: session.workspace,
        });
      } catch (err) {
        send(ws, {
          type: "error",
          message: `Failed to start Codex: ${err instanceof Error ? err.message : err}`,
        });
      }
      break;
    }

    case "codex_input": {
      // Send text input to the active Codex session
      const sessionId = (msg.sessionId as string) || clients.get(ws);
      const input = msg.input as string;
      if (sessionId && input !== undefined) {
        codexManager.sendInput(sessionId, input);
      }
      break;
    }

    case "codex_key": {
      // Send a keypress (Enter, y, n, Ctrl+C, etc.)
      const sessionId = (msg.sessionId as string) || clients.get(ws);
      const key = msg.key as string;
      if (sessionId && key) {
        // Map common key names
        const keyMap: Record<string, string> = {
          enter: "\r",
          y: "y",
          n: "n",
          "ctrl+c": "\x03",
          "ctrl+d": "\x04",
          escape: "\x1b",
        };
        codexManager.sendKey(sessionId, keyMap[key.toLowerCase()] || key);
      }
      break;
    }

    case "attach_session": {
      // Attach to an existing session
      const sessionId = msg.sessionId as string;
      if (sessionId && codexManager.get(sessionId)) {
        clients.set(ws, sessionId);
        send(ws, {
          type: "attached",
          sessionId,
          session: codexManager.get(sessionId),
        });
      }
      break;
    }

    case "kill_codex": {
      const sessionId = (msg.sessionId as string) || clients.get(ws);
      if (sessionId) {
        codexManager.kill(sessionId);
        send(ws, { type: "codex_killed", sessionId });
      }
      break;
    }

    case "list_sessions":
      send(ws, {
        type: "sessions_list",
        sessions: codexManager.getAll(),
      });
      break;
  }
}
