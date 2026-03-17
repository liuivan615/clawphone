import type { FastifyInstance } from "fastify";
import type { SessionSummary } from "../../shared/types.js";

// In-memory session tracking for MVP
const sessions = new Map<string, SessionSummary>();

export function getOrCreateSession(sessionId?: string): SessionSummary {
  if (sessionId && sessions.has(sessionId)) {
    return sessions.get(sessionId)!;
  }

  const id = sessionId || `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session: SessionSummary = {
    id,
    title: "New Chat",
    status: "active",
    updatedAt: new Date().toISOString(),
    hasPendingApproval: false,
  };
  sessions.set(id, session);
  return session;
}

export function updateSession(
  id: string,
  updates: Partial<SessionSummary>
): void {
  const session = sessions.get(id);
  if (session) {
    Object.assign(session, updates, { updatedAt: new Date().toISOString() });
  }
}

export function getAllSessions(): SessionSummary[] {
  return Array.from(sessions.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export default async function sessionRoutes(app: FastifyInstance) {
  app.get("/api/sessions", async () => {
    return getAllSessions();
  });

  app.post<{
    Body: { title?: string };
  }>("/api/sessions", async (request) => {
    const session = getOrCreateSession();
    if (request.body?.title) {
      session.title = request.body.title;
    }
    return session;
  });
}
