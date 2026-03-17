import type { FastifyRequest, FastifyReply } from "fastify";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

let cachedToken: string | null = null;

function loadToken(): string {
  if (cachedToken) return cachedToken;

  // Try loading from D:\clawd\secrets\openclaw-gateway-token.txt
  const tokenPaths = [
    "/mnt/d/clawd/secrets/openclaw-gateway-token.txt",
    "D:\\clawd\\secrets\\openclaw-gateway-token.txt",
    resolve(process.cwd(), "../clawd/secrets/openclaw-gateway-token.txt"),
  ];

  // Also check env var
  if (process.env.CLAWPHONE_TOKEN) {
    cachedToken = process.env.CLAWPHONE_TOKEN.trim();
    return cachedToken;
  }

  for (const p of tokenPaths) {
    try {
      if (existsSync(p)) {
        cachedToken = readFileSync(p, "utf-8").trim();
        return cachedToken;
      }
    } catch {
      // try next path
    }
  }

  throw new Error(
    "No token found. Set CLAWPHONE_TOKEN env var or ensure D:\\clawd\\secrets\\openclaw-gateway-token.txt exists."
  );
}

export function getToken(): string {
  return loadToken();
}

export async function authHook(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    if (token !== loadToken()) {
      reply.code(403).send({ error: "Invalid token" });
      return;
    }
  } catch (e) {
    reply
      .code(500)
      .send({ error: "Server token not configured" });
    return;
  }
}

export function validateWsToken(token: string): boolean {
  try {
    return token === loadToken();
  } catch {
    return false;
  }
}
