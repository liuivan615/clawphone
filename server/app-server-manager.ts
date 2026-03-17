import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";
import { createInterface, Interface as ReadlineInterface } from "readline";

// ── Types (from codex app-server generate-ts) ──

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type AskForApproval = "untrusted" | "on-failure" | "on-request" | "never";

export type ReviewDecision = "approved" | "approved_for_session" | "denied" | "abort";

export type CommandExecutionStatus = "inProgress" | "completed" | "failed" | "declined";
export type PatchApplyStatus = "inProgress" | "completed" | "failed" | "declined";
export type PatchChangeKind = { type: "add" } | { type: "delete" } | { type: "update"; move_path: string | null };

export interface FileUpdateChange {
  path: string;
  kind: PatchChangeKind;
  diff: string;
}

export type ThreadItem =
  | { type: "userMessage"; id: string; content: unknown[] }
  | { type: "agentMessage"; id: string; text: string; phase: string | null }
  | { type: "plan"; id: string; text: string }
  | { type: "reasoning"; id: string; summary: string[]; content: string[] }
  | {
      type: "commandExecution";
      id: string;
      command: string;
      cwd: string;
      processId: string | null;
      status: CommandExecutionStatus;
      commandActions: unknown[];
      aggregatedOutput: string | null;
      exitCode: number | null;
      durationMs: number | null;
    }
  | {
      type: "fileChange";
      id: string;
      changes: FileUpdateChange[];
      status: PatchApplyStatus;
    }
  | { type: "mcpToolCall"; id: string; server: string; tool: string; [key: string]: unknown }
  | { type: "webSearch"; id: string; query: string; [key: string]: unknown }
  | { type: "contextCompaction"; id: string }
  | { type: string; id: string; [key: string]: unknown };

export interface Thread {
  id: string;
  preview: string;
  cwd: string;
  status: string;
  name: string | null;
  modelProvider: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
}

export interface Turn {
  id: string;
  items: ThreadItem[];
  status: string;
  error: unknown | null;
}

// JSON-RPC message types
interface JsonRpcRequest {
  method: string;
  id: number;
  params: unknown;
}

interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface JsonRpcNotification {
  method: string;
  params: unknown;
}

// Parsed incoming line: either a response (has id, no method) or a notification/request (has method)
type IncomingMessage =
  | { kind: "response"; msg: JsonRpcResponse }
  | { kind: "notification"; msg: JsonRpcNotification }
  | { kind: "server_request"; msg: { method: string; id: number; params: unknown } };

// ── Session ──

export interface AppServerSession {
  id: string;
  workspace: string;
  threadId: string | null;
  process: ChildProcess;
  readline: ReadlineInterface;
  nextRequestId: number;
  pendingRequests: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  /** Track active server requests so we can respond with the correct payload. */
  serverRequests: Map<number, { method: string; params: unknown }>;
  status: "starting" | "initialized" | "running" | "closed";
  createdAt: string;
}

// ── Manager ──

class AppServerManager extends EventEmitter {
  private sessions = new Map<string, AppServerSession>();

  /**
   * Start a new Codex App Server session for the given workspace.
   */
  start(workspace: string): AppServerSession {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const isWindows = process.platform === "win32";
    const codexCmd = isWindows ? "codex.cmd" : "codex";

    const proc = spawn(codexCmd, ["app-server"], {
      cwd: workspace,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        FORCE_COLOR: "0",
      } as Record<string, string>,
      // On Windows, we need shell: true for .cmd files
      shell: isWindows,
    });

    const rl = createInterface({ input: proc.stdout! });

    const session: AppServerSession = {
      id,
      workspace,
      threadId: null,
      process: proc,
      readline: rl,
      nextRequestId: 1,
      pendingRequests: new Map(),
      serverRequests: new Map(),
      status: "starting",
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);

    // Read JSONL from stdout
    rl.on("line", (line: string) => {
      if (!line.trim()) return;
      try {
        const parsed = this.parseIncoming(line);
        this.handleIncoming(session, parsed);
      } catch (err) {
        // Log parse errors to stderr but don't crash
        console.error(`[AppServer ${id}] Failed to parse line:`, line.slice(0, 200), err);
      }
    });

    // Capture stderr for debugging
    proc.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      console.error(`[AppServer ${id} stderr]`, text.trim());
    });

    proc.on("exit", (code) => {
      session.status = "closed";
      this.emit("session_closed", id, code);
      // Reject all pending requests
      for (const [, pending] of session.pendingRequests) {
        pending.reject(new Error(`App server exited with code ${code}`));
      }
      session.pendingRequests.clear();
    });

    proc.on("error", (err) => {
      console.error(`[AppServer ${id}] Process error:`, err);
      session.status = "closed";
      this.emit("session_error", id, err.message);
    });

    return session;
  }

  /**
   * Initialize the app server (must be called after start).
   */
  async initialize(sessionId: string): Promise<unknown> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result = await this.sendRequest(session, "initialize", {
      clientInfo: {
        name: "clawphone",
        title: "ClawPhone Mobile IDE",
        version: "0.1.0",
      },
      capabilities: {
        experimentalApi: false,
      },
    });

    session.status = "initialized";

    // Send "initialized" notification
    this.sendNotification(session, "initialized");

    return result;
  }

  /**
   * Start a new thread in the session.
   */
  async startThread(
    sessionId: string,
    opts: {
      model?: string;
      cwd?: string;
      approvalPolicy?: AskForApproval;
    } = {}
  ): Promise<Thread> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result = (await this.sendRequest(session, "thread/start", {
      cwd: opts.cwd || session.workspace,
      model: opts.model || undefined,
      approvalPolicy: opts.approvalPolicy || "on-request",
      experimentalRawEvents: false,
      persistExtendedHistory: false,
    })) as { thread: Thread };

    session.threadId = result.thread.id;
    session.status = "running";
    return result.thread;
  }

  /**
   * Send a user message (start a turn).
   */
  async sendTurn(
    sessionId: string,
    text: string,
    opts: {
      model?: string;
      effort?: ReasoningEffort;
      collaborationMode?: "plan" | "default";
    } = {}
  ): Promise<unknown> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.threadId) throw new Error(`Session ${sessionId} not ready`);

    const params: Record<string, unknown> = {
      threadId: session.threadId,
      input: [{ type: "text", text, text_elements: [] }],
      model: opts.model || undefined,
      effort: opts.effort || undefined,
    };

    if (opts.collaborationMode) {
      params.collaborationMode = {
        mode: opts.collaborationMode,
        settings: {
          model: opts.model || "gpt-5.4",
          reasoning_effort: opts.effort || null,
          developer_instructions: null,
        },
      };
    }

    return this.sendRequest(session, "turn/start", params);
  }

  /**
   * Respond to an approval request (ServerRequest).
   * The `requestId` is the JSON-RPC `id` from the server request.
   * Automatically maps to the correct response format based on the request method.
   */
  respondToApproval(
    sessionId: string,
    requestId: number,
    decision: ReviewDecision
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const request = session.serverRequests.get(requestId);
    const method = request?.method;
    session.serverRequests.delete(requestId);

    let result: unknown;

    // v2 methods use "accept"/"decline", v1 uses "approved"/"denied"
    if (method === "item/commandExecution/requestApproval") {
      // v2: CommandExecutionApprovalDecision
      const v2Decision = decision === "approved" ? "accept"
        : decision === "approved_for_session" ? "acceptForSession"
        : decision === "denied" ? "decline"
        : "cancel";
      result = { decision: v2Decision };
    } else if (method === "item/fileChange/requestApproval") {
      // v2: FileChangeApprovalDecision
      const v2Decision = decision === "approved" ? "accept"
        : decision === "approved_for_session" ? "acceptForSession"
        : decision === "denied" ? "decline"
        : "cancel";
      result = { decision: v2Decision };
    } else {
      // v1 format (execCommandApproval, applyPatchApproval) uses ReviewDecision directly
      result = { decision };
    }

    const response = JSON.stringify({ id: requestId, result });
    session.process.stdin?.write(response + "\n");
  }

  /**
   * Respond to a permissions request by granting the requested profile.
   */
  respondToPermissions(
    sessionId: string,
    requestId: number,
    scope: "turn" | "session"
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const request = session.serverRequests.get(requestId);
    session.serverRequests.delete(requestId);

    const permissions =
      (request?.params as { permissions?: unknown } | undefined)?.permissions ?? {};
    const response = JSON.stringify({
      id: requestId,
      result: { permissions, scope },
    });
    session.process.stdin?.write(response + "\n");
  }

  /**
   * Respond to a request_user_input prompt.
   */
  respondToUserInput(
    sessionId: string,
    requestId: number,
    answers: Record<string, string[]>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.serverRequests.delete(requestId);

    const formattedAnswers = Object.fromEntries(
      Object.entries(answers).map(([id, values]) => [id, { answers: values }])
    );
    const response = JSON.stringify({
      id: requestId,
      result: { answers: formattedAnswers },
    });
    session.process.stdin?.write(response + "\n");
  }

  /**
   * Reject a server-initiated request via JSON-RPC error response.
   */
  rejectServerRequest(sessionId: string, requestId: number, message: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.serverRequests.delete(requestId);

    const response = JSON.stringify({
      id: requestId,
      error: {
        code: -32000,
        message,
      },
    });
    session.process.stdin?.write(response + "\n");
  }

  /**
   * Interrupt the current turn.
   */
  async interruptTurn(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.threadId) return;

    await this.sendRequest(session, "turn/interrupt", {
      threadId: session.threadId,
    });
  }

  /**
   * List all persisted threads (requires an initialized session).
   */
  async listThreads(sessionId: string): Promise<unknown[]> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result = (await this.sendRequest(session, "thread/list", {})) as { threads: unknown[] };
    return result.threads || [];
  }

  /**
   * Resume a previously persisted thread (loads full conversation history).
   */
  async resumeThread(sessionId: string, threadId: string): Promise<Thread> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result = (await this.sendRequest(session, "thread/resume", {
      threadId,
    })) as { thread: Thread };

    session.threadId = result.thread.id;
    session.status = "running";
    return result.thread;
  }

  /**
   * Read a thread without resuming it (get conversation items).
   */
  async readThread(sessionId: string, threadId: string): Promise<Thread> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const result = (await this.sendRequest(session, "thread/read", {
      threadId,
      includeTurns: true,
    })) as { thread: Thread };

    return result.thread;
  }

  /**
   * Kill a session.
   */
  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.process.kill();
    session.status = "closed";
    this.sessions.delete(sessionId);
  }

  /**
   * Get session info.
   */
  get(sessionId: string): AppServerSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions.
   */
  getAll(): Array<{ id: string; workspace: string; status: string; threadId: string | null; createdAt: string }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      workspace: s.workspace,
      status: s.status,
      threadId: s.threadId,
      createdAt: s.createdAt,
    }));
  }

  // ── Internal ──

  private parseIncoming(line: string): IncomingMessage {
    const obj = JSON.parse(line);

    if ("method" in obj && "id" in obj) {
      // Server request (has both method and id) — needs our response
      return { kind: "server_request", msg: obj };
    }

    if ("id" in obj && !("method" in obj)) {
      // Response to our request
      return { kind: "response", msg: obj as JsonRpcResponse };
    }

    if ("method" in obj) {
      // Notification (method, no id)
      return { kind: "notification", msg: obj as JsonRpcNotification };
    }

    throw new Error(`Unknown message format: ${line.slice(0, 100)}`);
  }

  private handleIncoming(session: AppServerSession, incoming: IncomingMessage): void {
    switch (incoming.kind) {
      case "response": {
        const { id, result, error } = incoming.msg;
        const pending = session.pendingRequests.get(id);
        if (pending) {
          session.pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(`${error.message} (code ${error.code})`));
          } else {
            pending.resolve(result);
          }
        }
        break;
      }

      case "notification": {
        // Forward all notifications to listeners
        this.emit("notification", session.id, incoming.msg.method, incoming.msg.params);
        break;
      }

      case "server_request": {
        // Track the request so we can respond with the correct format
        session.serverRequests.set(incoming.msg.id, {
          method: incoming.msg.method,
          params: incoming.msg.params,
        });
        // Server is requesting something from us (e.g., approval)
        this.emit("server_request", session.id, incoming.msg.method, incoming.msg.id, incoming.msg.params);
        break;
      }
    }
  }

  private sendRequest(session: AppServerSession, method: string, params: unknown): Promise<unknown> {
    const id = session.nextRequestId++;
    const msg: JsonRpcRequest = { method, id, params };

    return new Promise((resolve, reject) => {
      session.pendingRequests.set(id, { resolve, reject });

      const line = JSON.stringify(msg) + "\n";
      const ok = session.process.stdin?.write(line);

      if (!ok) {
        session.pendingRequests.delete(id);
        reject(new Error("Failed to write to app-server stdin"));
      }
    });
  }

  private sendNotification(session: AppServerSession, method: string, params?: unknown): void {
    const msg: { method: string; params?: unknown } = { method };
    if (params !== undefined) msg.params = params;
    session.process.stdin?.write(JSON.stringify(msg) + "\n");
  }
}

// Singleton
export const appServerManager = new AppServerManager();
