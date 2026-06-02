import { useEffect, useRef } from "preact/hooks";
import { getApiUrl, getClientId } from "../api/config";

export interface MetaPayload {
  tool_calls?: Array<{ name: string; params: Record<string, unknown> }>;
  tool_results?: unknown[];
  message_id?: string;
  tool_metadata?: {
    event_requirements?: Record<string, unknown>;
    /**
     * Carrefour Traiteur — surfaced by `recommend_menu_products` (full menu)
     * and `update_menu_step` (partial).  Lets the frontend choose the right
     * merge strategy for productsByStep / menuQuantities so stale items from
     * earlier iterations don't linger (e.g. when the budget guard drops
     * Fromages entirely).
     */
    menu_update?: {
      type: 'full' | 'partial';
      /** Steps the backend actually included in this response. */
      active_steps?: string[];
      /** Steps the partial update touched (only present when type='partial'). */
      steps_updated?: string[];
    };
  };
}

export interface ChatAnswerCallbacks {
  onToken: (token: string) => void;
  onMeta: (meta: MetaPayload) => void;
  onComplete: (fullText: string) => void;
  onError: (message: string) => void;
  onJwt?: (newJwt: string) => void;
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
 *
 * @param question  New value triggers a new request; null/undefined = no-op
 * @param jwt       Optional session JWT (rotated via X-Session-Token response header)
 * @param onJwt     Called when a new session token is received
 * @param callbacks Token / meta / complete / error handlers
 */
export function useChatAnswer(
  question: string | null,
  jwt: string | null,
  callbacks: ChatAnswerCallbacks,
  // Returns the current panel state to sync server-side before the LLM runs,
  // so the assistant sees manual quantity/removal edits. Read at request time.
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
      const { onToken, onMeta, onComplete, onError, onJwt } = callbacksRef.current;

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "x-client-id": getClientId(),
        };
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

        // Rotate session token if the server sends a new one
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
            } else {
              // Accumulate raw data — __NEWLINE__ may be split across SSE event boundaries,
              // so replacement happens on the full accumulated string at completion time.
              accumulated += data;
              onToken(data);
            }
          });
        }

        if (!cancelled) {
          onComplete(accumulated.replace(/__NEWLINE__/g, '\n'));
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
