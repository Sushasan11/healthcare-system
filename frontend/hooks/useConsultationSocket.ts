"use client";
import { useEffect, useRef, useCallback, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import type { WsEnvelope, ConnectionStatus } from "@/types/consultation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_BASE = API_BASE.replace(/^http/, "ws");
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_ATTEMPTS = 10;

export function useConsultationSocket(
  consultationId: number | null,
  onMessage: (msg: WsEnvelope) => void
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reconnectAttempts = useRef(0);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  const connect = useCallback(async () => {
    if (!consultationId) return;

    // Refresh token before connecting (handles reconnect after expiry)
    let token = getAccessToken();
    if (!token) {
      // Try to refresh via REST before WebSocket connect
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          const { setAccessToken } = await import("@/lib/auth");
          setAccessToken(data.access_token);
          token = data.access_token;
        }
      } catch {
        // Cannot refresh — will fail on WS connect
      }
    }
    if (!token) {
      setStatus("disconnected");
      return;
    }

    setStatus("connecting");
    const url = `${WS_BASE}/ws/consultation/${consultationId}?token=${token}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data) as WsEnvelope;
        onMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setStatus("reconnecting");
      if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts.current++;
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY);
      } else {
        setStatus("disconnected");
      }
    };

    ws.onerror = () => {
      // onclose will fire after onerror
    };
  }, [consultationId, onMessage]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  const sendMessage = useCallback((msg: WsEnvelope) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    reconnectAttempts.current = MAX_RECONNECT_ATTEMPTS; // prevent reconnect
    wsRef.current?.close();
    setStatus("disconnected");
  }, []);

  return { sendMessage, disconnect, status };
}
