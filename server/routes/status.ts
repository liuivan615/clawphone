import type { FastifyInstance } from "fastify";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { networkInterfaces } from "os";
import {
  checkGateway,
  checkLMStudio,
  checkTailscale,
  checkBridge,
} from "../gateway-client.js";
import { appServerManager } from "../app-server-manager.js";
import type { StatusPayload } from "../../shared/types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findTunnelFile(): string | null {
  const candidates = [
    resolve(process.cwd(), "tunnel-url.txt"),
    resolve(__dirname, "../../tunnel-url.txt"),
    resolve(__dirname, "../../../tunnel-url.txt"),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export default async function statusRoutes(app: FastifyInstance) {
  app.get("/api/status", async (_request, _reply) => {
    const [gateway, lmstudio, tailscale, bridge] = await Promise.all([
      checkGateway(),
      checkLMStudio(),
      checkTailscale(),
      checkBridge(),
    ]);

    const sessions = appServerManager.getAll();
    const activeSessions = sessions.filter(
      (s) => s.status === "running" || s.status === "initialized"
    ).length;

    const payload: StatusPayload = {
      gateway,
      lmstudio,
      tailscale,
      bridge,
      activeSessions,
      pendingApprovals: 0,
      lastActivity: sessions[0]?.createdAt || new Date().toISOString(),
    };

    return payload;
  });

  app.get("/api/health", async () => {
    return { ok: true, timestamp: new Date().toISOString() };
  });

  // Network info: LAN IP + Tunnel URL
  app.get("/api/network-info", async () => {
    // Get LAN IP
    const nets = networkInterfaces();
    let lanIp = "";
    for (const name of Object.keys(nets)) {
      for (const net of nets[name] || []) {
        if (net.family === "IPv4" && !net.internal && net.address.startsWith("192.168")) {
          lanIp = net.address;
          break;
        }
      }
      if (lanIp) break;
    }

    // Read tunnel URL if exists
    let tunnelUrl = "";
    const tunnelFile = findTunnelFile();
    if (tunnelFile) {
      try {
        tunnelUrl = readFileSync(tunnelFile, "utf-8").trim();
      } catch { /* */ }
    }

    return {
      lanIp,
      lanUrl: lanIp ? `http://${lanIp}:${process.env.PORT || 3000}` : "",
      tunnelUrl,
      port: parseInt(process.env.PORT || "3000", 10),
    };
  });
}
