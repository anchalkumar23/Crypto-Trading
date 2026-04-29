import { useEffect, useState } from "react";
import { openWebSocket } from "@/lib/api";

export interface EngineStatus {
  connected: boolean;
  lastTickAt: number | null;
}

/**
 * Subscribe to backend WebSocket and surface engine connection / last tick.
 * Falls back gracefully when the backend is offline.
 */
export function useEngineStatus(): EngineStatus {
  const [state, setState] = useState<EngineStatus>({ connected: false, lastTickAt: null });

  useEffect(() => {
    let alive = true;
    let close: (() => void) | undefined;

    try {
      close = openWebSocket((ev) => {
        if (!alive) return;
        if (ev.type === "hello") {
          setState((s) => ({ ...s, connected: true }));
        } else if (ev.type === "tick") {
          setState({ connected: true, lastTickAt: Date.now() });
        }
      });
    } catch {
      // ignore — keep `connected: false`
    }

    return () => {
      alive = false;
      close?.();
    };
  }, []);

  return state;
}
