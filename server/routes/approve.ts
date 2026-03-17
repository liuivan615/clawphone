import type { FastifyInstance } from "fastify";
import { getToken } from "../auth.js";

const GATEWAY_BASE =
  process.env.OPENCLAW_GATEWAY_URL || "http://127.0.0.1:18789";

export default async function approveRoutes(app: FastifyInstance) {
  app.post<{
    Params: { id: string };
    Body: { decision: "allow" | "deny" };
  }>("/api/approve/:id", async (request, reply) => {
    const { id } = request.params;
    const { decision } = request.body;

    if (!decision || !["allow", "deny"].includes(decision)) {
      return reply
        .code(400)
        .send({ error: 'decision must be "allow" or "deny"' });
    }

    try {
      // Forward approval to Gateway
      const res = await fetch(`${GATEWAY_BASE}/v1/approvals/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ decision }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "unknown error");
        return reply
          .code(res.status)
          .send({ error: `Gateway: ${text}` });
      }

      return { ok: true, id, decision };
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to forward approval";
      return reply.code(502).send({ error: msg });
    }
  });
}
