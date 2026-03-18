import type { FastifyInstance } from "fastify";
import { codexHistoryService } from "../services/codex-history.js";
import type {
  HistoryContinuePayload,
  HistoryThreadSnapshot,
  HistoryThreadSummary,
  HistoryWorkspaceSummary,
} from "../../shared/types.js";

export default async function historyRoutes(app: FastifyInstance) {
  app.get("/api/history/workspaces", async () => {
    return {
      workspaces: codexHistoryService.listWorkspaces() as HistoryWorkspaceSummary[],
      codexHome: codexHistoryService.getCodexHome(),
    };
  });

  app.get<{
    Querystring: { workspace?: string; q?: string; limit?: string };
  }>("/api/history/threads", async (request) => {
    const limit = request.query.limit ? Number.parseInt(request.query.limit, 10) : undefined;

    return {
      threads: codexHistoryService.listThreads({
        workspace: request.query.workspace,
        q: request.query.q,
        limit: Number.isFinite(limit) ? limit : undefined,
      }) as HistoryThreadSummary[],
    };
  });

  app.get<{
    Params: { id: string };
  }>("/api/history/threads/:id", async (request, reply) => {
    const thread = codexHistoryService.getThread(request.params.id) as HistoryThreadSnapshot | null;
    if (!thread) {
      reply.code(404);
      return { error: "Thread not found" };
    }

    return { thread };
  });

  app.post<{
    Body: { threadId?: string };
  }>("/api/history/continue", async (request, reply) => {
    const threadId = request.body?.threadId?.trim();
    if (!threadId) {
      reply.code(400);
      return { error: "threadId is required" };
    }

    const payload = codexHistoryService.createContinuePayload(threadId) as HistoryContinuePayload | null;
    if (!payload) {
      reply.code(404);
      return { error: "Thread not found or missing workspace" };
    }

    return payload;
  });
}
