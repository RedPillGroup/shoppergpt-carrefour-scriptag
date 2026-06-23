import { useEffect, useRef } from "preact/hooks";
import { getApiUrl, getClientId } from "../api/config";
import { useShopperStore } from "../store";

export interface MetaPayload {
  tool_calls?: Array<{ name: string; params: Record<string, unknown> }>;
  message_id?: string;
  /** Bumped when Mongo menu state changes — front refetches GET /menu when this increases. */
  menu_revision?: number;
  menu_changed?: boolean;
  /** True when the selected store changed this turn (e.g. assistant via manage_store). */
  store_changed?: boolean;
  sync_conflict?: {
    sync_conflict?: boolean;
    client_revision?: number;
    server_revision?: number;
  };
}

export interface ChatAnswerCallbacks {
  onToken: (token: string) => void;
  onMeta: (meta: MetaPayload) => void;
  onComplete: (fullText: string) => void;
  onError: (message: string) => void;
  onJwt?: (newJwt: string) => void;
  /**
   * Fired when the backend emits an early `event: phase` — sent the instant the
   * model picks a long, blocking tool (e.g. menu composition), BEFORE it runs.
   * Lets the UI show real staged progress instead of dead air during the wait.
   */
  onPhase?: (phase: string) => void;
}

/**
 * Minimal, stateful SSE parser that handles chunk boundaries correctly.
 * Accumulates a buffer across reads and fires the callback on each complete event.
 */
class SSEParser {
  private buffer = "";
  private currentEvent = "";
  private currentData = "";

  feed(chunk: string, callback: (event: string, data: string) => void) {
    this.buffer += chunk;

    // Process all complete lines (split on \n, keep trailing partial line in buffer)
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r$/, "");

      if (line.startsWith("event: ")) {
        this.currentEvent = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        this.currentData += (this.currentData ? "\n" : "") + line.slice(6);
      } else if (line === "") {
        if (this.currentData) {
          callback(this.currentEvent || "message", this.currentData);
        }
        this.currentEvent = "";
        this.currentData = "";
      }
    }
  }
}

/**
 * Fires a POST /answer request and streams the SSE response.
 * Calls callbacks as tokens and meta events arrive.
 */
export function useChatAnswer(
  question: string | null,
  jwt: string | null,
  callbacks: ChatAnswerCallbacks,
  getClientState?: () => Record<string, unknown> | null
) {
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const getClientStateRef = useRef(getClientState);
  getClientStateRef.current = getClientState;

  useEffect(() => {
    if (!question) return;

    let cancelled = false;
    let accumulated = "";

    const run = async () => {
      const { onToken, onMeta, onComplete, onError, onJwt, onPhase } = callbacksRef.current;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-client-id": getClientId(),
        };
        // Session = X-Session-Id (Carrefour PHPSESSID). Backend keys state/history
        // on it and ignores the JWT when present. Authorization kept as fallback.
        const sessionId = useShopperStore.getState().sessionId;
        if (sessionId) {
          headers["X-Session-Id"] = sessionId;
        }
        if (jwt) {
          headers["Authorization"] = `Bearer ${jwt}`;
        }

        const res = await fetch(`${getApiUrl()}/answer`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: question,
            client_id: getClientId(),
            client_state: getClientStateRef.current?.() ?? undefined,
          }),
        });

        if (!res.ok || !res.body) {
          throw new Error(`API error ${res.status}: ${await res.text()}`);
        }

        const newToken = res.headers.get("X-Session-Token");
        if (newToken && !cancelled) onJwt?.(newToken);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = new SSEParser();

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });

          parser.feed(chunk, (event, data) => {
            if (cancelled) return;

            if (event === "meta") {
              try {
                const meta: MetaPayload = JSON.parse(data);
                onMeta(meta);
              } catch {
                // Malformed meta — ignore
              }
            } else if (event === "phase") {
              try {
                onPhase?.(JSON.parse(data) as string);
              } catch {
                // Malformed phase — ignore
              }
            } else {
              accumulated += data;
              onToken(data);
            }
          });
        }

        if (!cancelled) {
          onComplete(accumulated.replace(/__NEWLINE__/g, "\n"));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          onError(msg);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);
}
