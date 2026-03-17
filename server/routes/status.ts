import type { FastifyInstance } from "fastify";
import {
  checkGateway,
  checkLMStudio,
  checkTailscale,
  checkBridge,
} from "../gateway-client.js";
import { codexManager } from "../codex-manager.js";
import type { StatusPayload } from "../../shared/types.js";

export default async function statusRoutes(app: FastifyInstance) {
  app.get("/api/status", async (_request, _reply) => {
    const [gateway, lmstudio, tailscale, bridge] = await Promise.all([
      checkGateway(),
      checkLMStudio(),
      checkTailscale(),
      checkBridge(),
    ]);

    const sessions = codexManager.getAll();
    const activeSessions = sessions.filter(
      (s) => s.status === "running"
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
}
