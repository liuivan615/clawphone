import { useEffect, useRef, useCallback, useState } from "react";
import { api } from "../lib/api";

export interface CodexSessionInfo {
  id: string;
  workspace: string;
  status: string;
  createdAt: string;
}

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
        // Auth failure — clear token and force re-login
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

  const startCodex = useCallback(
    (workspace: string, prompt?: string) => {
      return send({ type: "start_codex", workspace, prompt });
    },
    [send]
  );

  const sendInput = useCallback(
    (input: string, sessionId?: string) => {
      return send({ type: "codex_input", input, sessionId });
    },
    [send]
  );

  const sendKey = useCallback(
    (key: string, sessionId?: string) => {
      return send({ type: "codex_key", key, sessionId });
    },
    [send]
  );

  const killCodex = useCallback(
    (sessionId?: string) => {
      return send({ type: "kill_codex", sessionId });
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
    startCodex,
    sendInput,
    sendKey,
    killCodex,
  };
}
