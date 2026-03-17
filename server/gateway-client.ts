import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";

// ── Codex API configuration (read from ~/.codex/) ──

interface CodexConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  wireApi: "responses" | "chat";
}

let cachedConfig: CodexConfig | null = null;

function loadCodexConfig(): CodexConfig {
  if (cachedConfig) return cachedConfig;

  // Read config.toml
  const configPaths = [
    "C:\\Users\\IVAN\\.codex\\config.toml",
    `${process.env.USERPROFILE}\\.codex\\config.toml`,
    `${process.env.HOME}/.codex/config.toml`,
  ];

  let baseUrl = "https://api-vip.codex-for.me/v1";
  let model = "gpt-5.4";
  let wireApi: "responses" | "chat" = "responses";

  for (const p of configPaths) {
    try {
      if (existsSync(p)) {
        const content = readFileSync(p, "utf-8");
        // Parse base_url
        const urlMatch = content.match(/base_url\s*=\s*"([^"]+)"/);
        if (urlMatch) baseUrl = urlMatch[1];
        // Parse model
        const modelMatch = content.match(/^model\s*=\s*"([^"]+)"/m);
        if (modelMatch) model = modelMatch[1];
        // Parse wire_api
        const apiMatch = content.match(/wire_api\s*=\s*"([^"]+)"/);
        if (apiMatch) wireApi = apiMatch[1] as "responses" | "chat";
        break;
      }
    } catch {
      // try next
    }
  }

  // Read auth.json
  const authPaths = [
    "C:\\Users\\IVAN\\.codex\\auth.json",
    `${process.env.USERPROFILE}\\.codex\\auth.json`,
    `${process.env.HOME}/.codex/auth.json`,
  ];

  let apiKey = process.env.OPENAI_API_KEY || "";

  for (const p of authPaths) {
    try {
      if (existsSync(p)) {
        const auth = JSON.parse(readFileSync(p, "utf-8"));
        apiKey = auth.OPENAI_API_KEY || apiKey;
        break;
      }
    } catch {
      // try next
    }
  }

  if (!apiKey) {
    throw new Error("No API key found in ~/.codex/auth.json or OPENAI_API_KEY env var");
  }

  cachedConfig = { baseUrl, apiKey, model, wireApi };
  return cachedConfig;
}

export function getCodexConfig(): CodexConfig {
  return loadCodexConfig();
}

// ── Chat streaming ──

interface ChatRequest {
  message: string;
  sessionId?: string;
  model?: string;
}

/**
 * Send a chat message to the Codex API and return a stream.
 * Supports both Responses API and Chat Completions API.
 */
export async function streamChat(
  req: ChatRequest,
  signal?: AbortSignal
): Promise<ReadableStream<Uint8Array> | null> {
  const config = loadCodexConfig();
  const model = req.model || config.model;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiKey}`,
  };

  let url: string;
  let body: unknown;

  if (config.wireApi === "responses") {
    // OpenAI Responses API
    url = `${config.baseUrl}/responses`;
    body = {
      model,
      stream: true,
      input: [{ role: "user", content: req.message }],
    };
  } else {
    // Chat Completions API fallback
    url = `${config.baseUrl}/chat/completions`;
    body = {
      model,
      stream: true,
      messages: [{ role: "user", content: req.message }],
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "unknown error");
    throw new Error(`Codex API error ${res.status}: ${text}`);
  }

  return res.body;
}

// ── Health checks ──

/**
 * Check if the Codex API is reachable.
 */
export async function checkGateway(): Promise<{
  online: boolean;
  port: number;
}> {
  try {
    const config = loadCodexConfig();
    const res = await fetch(`${config.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${config.apiKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { online: res.ok, port: 0 };
  } catch {
    return { online: false, port: 0 };
  }
}

/**
 * Check if LM Studio is reachable (optional local model).
 */
export async function checkLMStudio(): Promise<{
  online: boolean;
  model?: string;
  port: number;
}> {
  const lmBase =
    process.env.LMSTUDIO_BASE_URL || "http://127.0.0.1:1234/v1";
  try {
    const res = await fetch(`${lmBase}/models`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: { id: string }[];
      };
      const model = data?.data?.[0]?.id;
      return { online: true, model, port: 1234 };
    }
    return { online: false, port: 1234 };
  } catch {
    return { online: false, port: 1234 };
  }
}

/**
 * Check Tailscale status.
 */
export async function checkTailscale(): Promise<{
  online: boolean;
  hostname?: string;
  ip?: string;
}> {
  try {
    const isWindows = process.platform === "win32";
    const cmd = isWindows
      ? "tailscale status --json"
      : "tailscale status --json 2>/dev/null";
    const status = execSync(cmd, {
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],  // suppress stderr on Windows
    }).toString();
    const json = JSON.parse(status);
    return {
      online: json.BackendState === "Running",
      hostname: json.Self?.HostName,
      ip: json.TailscaleIPs?.[0],
    };
  } catch {
    return { online: false };
  }
}

/**
 * Check if the App Bridge is reachable.
 */
export async function checkBridge(): Promise<{
  online: boolean;
  windows: string[];
}> {
  const bridgeBase =
    process.env.BRIDGE_URL || `http://${getBridgeHost()}:3001`;
  try {
    const res = await fetch(`${bridgeBase}/windows`, {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) {
      const windows = (await res.json()) as { title: string }[];
      return { online: true, windows: windows.map((w) => w.title) };
    }
    return { online: false, windows: [] };
  } catch {
    return { online: false, windows: [] };
  }
}

function getBridgeHost(): string {
  if (process.platform === "win32") {
    return "127.0.0.1";
  }

  // In WSL, the Windows host is reachable via the default gateway.
  if (!process.env.WSL_DISTRO_NAME && !process.env.WSL_INTEROP) {
    return "127.0.0.1";
  }

  try {
    return (
      execSync("ip route | awk '/default /{print $3}'", { timeout: 1000 })
        .toString()
        .trim() || "127.0.0.1"
    );
  } catch {
    return "127.0.0.1";
  }
}
