import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import fastifyCors from "@fastify/cors";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

import { authHook } from "./auth.js";
import chatRoutes from "./routes/chat.js";
import approveRoutes from "./routes/approve.js";
import statusRoutes from "./routes/status.js";
import sessionRoutes from "./routes/sessions.js";
import browseRoutes from "./routes/browse.js";
import gitRoutes from "./routes/git.js";
import historyRoutes from "./routes/history.js";
import wsHandler from "./ws/handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty", options: { colorize: true } }
          : undefined,
    },
  });

  // Plugins
  await app.register(fastifyCors, { origin: true });
  await app.register(fastifyWebsocket);

  // Auth hook for /api/* routes (not /ws, not health)
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url;
    // Skip auth for health check, static files, and ws upgrade
    if (
      url === "/api/health" ||
      !url.startsWith("/api/") ||
      request.headers.upgrade === "websocket"
    ) {
      return;
    }
    await authHook(request, reply);
  });

  // API Routes
  await app.register(chatRoutes);
  await app.register(approveRoutes);
  await app.register(statusRoutes);
  await app.register(sessionRoutes);
  await app.register(browseRoutes);
  await app.register(gitRoutes);
  await app.register(historyRoutes);

  // WebSocket
  await app.register(wsHandler);

  // Serve static files in production
  const webDist = resolve(__dirname, "../web");
  if (existsSync(webDist)) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
      wildcard: false,
    });

    // SPA fallback
    app.setNotFoundHandler((_request, reply) => {
      return reply.sendFile("index.html");
    });
  }

  // Start
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`ClawPhone server running on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
