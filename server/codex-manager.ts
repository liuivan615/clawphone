import * as pty from "node-pty";
import { EventEmitter } from "events";

export interface CodexSession {
  id: string;
  workspace: string;
  status: "starting" | "running" | "waiting_input" | "closed";
  ptyProcess: pty.IPty;
  createdAt: string;
}

// Strip ANSI escape codes + terminal control sequences for clean display
function stripAnsi(str: string): string {
  return str
    // Standard ANSI escape sequences
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
    // OSC sequences (title setting, etc.)
    .replace(/\x1b\][^\x07]*\x07/g, "")
    // Other escape sequences
    .replace(/\x1b[()][AB012]/g, "")
    .replace(/\x1b[>=]/g, "")
    // CSI sequences
    .replace(/\x9b[0-9;]*[a-zA-Z]/g, "")
    // Cursor movement that isn't \r or \n
    .replace(/\x1b\[\?[0-9;]*[hl]/g, "");
}

class CodexManager extends EventEmitter {
  private sessions = new Map<string, CodexSession>();

  /**
   * Start a new Codex CLI session in the given workspace.
   */
  start(workspace: string, prompt?: string): CodexSession {
    const id = `codex-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    // Build codex command args
    const args: string[] = [];
    if (prompt) {
      args.push(prompt);
    }

    // Determine shell and codex path
    const isWindows = process.platform === "win32";

    const shell = isWindows ? "cmd.exe" : "/bin/bash";
    const shellArgs = isWindows
      ? ["/c", "codex", ...args]
      : ["-lc", `codex ${args.map((a) => `"${a}"`).join(" ")}`];

    const ptyProcess = pty.spawn(shell, shellArgs, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workspace,
      env: {
        ...process.env,
        // Force color output
        FORCE_COLOR: "1",
        TERM: "xterm-256color",
      } as Record<string, string>,
    });

    const session: CodexSession = {
      id,
      workspace,
      status: "running",
      ptyProcess,
      createdAt: new Date().toISOString(),
    };

    this.sessions.set(id, session);

    // Forward pty output
    ptyProcess.onData((data: string) => {
      this.emit("output", id, data, stripAnsi(data));
    });

    ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
      session.status = "closed";
      this.emit("exit", id, exitCode);
    });

    return session;
  }

  /**
   * Send input to a Codex session (user typing, approval responses, etc.)
   */
  sendInput(sessionId: string, input: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "closed") return false;
    session.ptyProcess.write(input);
    return true;
  }

  /**
   * Send a keypress (e.g., Enter, y/n for approvals)
   */
  sendKey(sessionId: string, key: string): boolean {
    return this.sendInput(sessionId, key);
  }

  /**
   * Resize the terminal
   */
  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status !== "closed") {
      session.ptyProcess.resize(cols, rows);
    }
  }

  /**
   * Kill a session
   */
  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.status !== "closed") {
      session.ptyProcess.kill();
      session.status = "closed";
    }
  }

  /**
   * Get all sessions
   */
  getAll(): Array<{
    id: string;
    workspace: string;
    status: string;
    createdAt: string;
  }> {
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      workspace: s.workspace,
      status: s.status,
      createdAt: s.createdAt,
    }));
  }

  /**
   * Get a session by ID
   */
  get(sessionId: string): CodexSession | undefined {
    return this.sessions.get(sessionId);
  }
}

// Singleton
export const codexManager = new CodexManager();
