import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "../lib/api";

interface WsMessage {
  type: string;
  [key: string]: unknown;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);
  const [connected, setConnected] = useState(false);
  const handlersRef = useRef<((msg: WsMessage) => void)[]>([]);

  const addHandler = useCallback((handler: (msg: WsMessage) => void) => {
    handlersRef.current.push(handler);
    return () => {
      handlersRef.current = handlersRef.current.filter((h) => h !== handler);
    };
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(api.getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttempts.current = 0;
      setConnected(true);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsMessage;
        for (const handler of handlersRef.current) {
          handler(msg);
        }
      } catch {
        // skip
      }
    };

    ws.onclose = (e) => {
      wsRef.current = null;
      setConnected(false);
      if (e.code === 4001) {
        import("../lib/api").then(({ clearToken }) => {
          clearToken();
          window.location.reload();
        });
        return;
      }
      const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 30000);
      reconnectAttempts.current++;
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => ws.close();
  }, []);

  const send = useCallback((msg: WsMessage): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  // ── New API methods ──

  const startSession = useCallback(
    (workspace: string, opts?: { model?: string; reasoningEffort?: string; prompt?: string; approvalPolicy?: string }) => {
      return send({
        type: "start_session",
        workspace,
        model: opts?.model,
        reasoningEffort: opts?.reasoningEffort,
        prompt: opts?.prompt,
        approvalPolicy: opts?.approvalPolicy,
      });
    },
    [send]
  );

  const sendMessage = useCallback(
    (text: string, opts?: { model?: string; reasoningEffort?: string; collaborationMode?: string }) => {
      return send({
        type: "send_message",
        text,
        model: opts?.model,
        reasoningEffort: opts?.reasoningEffort,
        collaborationMode: opts?.collaborationMode,
      });
    },
    [send]
  );

  const approve = useCallback(
    (requestId: number, decision?: string) => {
      return send({
        type: "approve",
        requestId,
        decision: decision || "approved",
      });
    },
    [send]
  );

  const deny = useCallback(
    (requestId: number) => {
      return send({ type: "deny", requestId });
    },
    [send]
  );

  const grantPermissions = useCallback(
    (requestId: number, scope: "turn" | "session") => {
      return send({ type: "grant_permissions", requestId, scope });
    },
    [send]
  );

  const submitUserInput = useCallback(
    (requestId: number, answers: Record<string, string[]>) => {
      return send({ type: "submit_user_input", requestId, answers });
    },
    [send]
  );

  const rejectRequest = useCallback(
    (requestId: number, message?: string) => {
      return send({ type: "reject_request", requestId, message });
    },
    [send]
  );

  const interrupt = useCallback(() => {
    return send({ type: "interrupt" });
  }, [send]);

  const killSession = useCallback(
    (sessionId?: string) => {
      return send({ type: "kill_session", sessionId });
    },
    [send]
  );

  const listThreads = useCallback(() => {
    return send({ type: "list_threads" });
  }, [send]);

  const resumeThread = useCallback(
    (threadId: string) => {
      return send({ type: "resume_thread", threadId });
    },
    [send]
  );

  useEffect(() => {
    connect();
    const pingInterval = setInterval(() => send({ type: "ping" }), 30000);
    return () => {
      clearInterval(pingInterval);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect, send]);

  return {
    connected,
    send,
    addHandler,
    startSession,
    sendMessage,
    approve,
    deny,
    grantPermissions,
    submitUserInput,
    rejectRequest,
    interrupt,
    killSession,
    listThreads,
    resumeThread,
  };
}
