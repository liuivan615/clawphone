const API_BASE = "";

function getToken(): string {
  return localStorage.getItem("clawphone_token") || "";
}

export function setToken(token: string) {
  localStorage.setItem("clawphone_token", token);
}

export function clearToken() {
  localStorage.removeItem("clawphone_token");
}

export function hasToken(): boolean {
  return !!localStorage.getItem("clawphone_token");
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
  });

  if (res.status === 401 || res.status === 403) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get token() {
    return getToken();
  },
  getStatus: () => apiFetch<import("./types").StatusPayload>("/api/status"),
  getHistoryWorkspaces: () =>
    apiFetch<{ workspaces: import("./types").HistoryWorkspaceSummary[]; codexHome: string }>(
      "/api/history/workspaces"
    ),
  getHistoryThreads: (params?: { workspace?: string; q?: string; limit?: number }) => {
    const search = new URLSearchParams();
    if (params?.workspace) search.set("workspace", params.workspace);
    if (params?.q) search.set("q", params.q);
    if (typeof params?.limit === "number") search.set("limit", String(params.limit));

    const suffix = search.size > 0 ? `?${search.toString()}` : "";
    return apiFetch<{ threads: import("./types").HistoryThreadSummary[] }>(
      `/api/history/threads${suffix}`
    );
  },
  getHistoryThread: (threadId: string) =>
    apiFetch<{ thread: import("./types").HistoryThreadSnapshot }>(
      `/api/history/threads/${encodeURIComponent(threadId)}`
    ),
  continueHistoryThread: (threadId: string) =>
    apiFetch<import("./types").HistoryContinuePayload>("/api/history/continue", {
      method: "POST",
      body: JSON.stringify({ threadId }),
    }),

  getSessions: () =>
    apiFetch<import("./types").SessionSummary[]>("/api/sessions"),

  createSession: (title?: string) =>
    apiFetch<import("./types").SessionSummary>("/api/sessions", {
      method: "POST",
      body: JSON.stringify({ title }),
    }),

  approve: (id: string, decision: "allow" | "deny") =>
    apiFetch<{ ok: boolean }>(`/api/approve/${id}`, {
      method: "POST",
      body: JSON.stringify({ decision }),
    }),

  checkHealth: async (): Promise<boolean> => {
    try {
      await apiFetch("/api/status");
      return true;
    } catch {
      return false;
    }
  },

  getWsUrl: (): string => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${location.host}/ws?token=${encodeURIComponent(getToken())}`;
  },
};
