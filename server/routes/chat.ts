import type { FastifyInstance } from "fastify";
import { streamChat } from "../gateway-client.js";

export default async function chatRoutes(app: FastifyInstance) {
  app.post<{
    Body: { message: string; sessionId?: string; model?: string };
  }>("/api/chat", async (request, reply) => {
    const { message, sessionId, model } = request.body;

    if (!message?.trim()) {
      return reply.code(400).send({ error: "message is required" });
    }

    // Create an AbortController tied to the client disconnecting
    const abortController = new AbortController();
    request.raw.on("close", () => abortController.abort());

    try {
      const stream = await streamChat(
        { message, sessionId, model },
        abortController.signal
      );

      if (!stream) {
        return reply.code(502).send({ error: "No response from gateway" });
      }

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          reply.raw.write(chunk);
        }
      } finally {
        reader.releaseLock();
        reply.raw.end();
      }
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Gateway connection failed";
      if (!reply.sent) {
        return reply.code(502).send({ error: errMsg });
      }
    }
  });
}
