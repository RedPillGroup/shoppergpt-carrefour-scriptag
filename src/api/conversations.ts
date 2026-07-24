import { getApiUrl, getClientId } from "./config";
import { useShopperStore } from "../store";
import type { ServerMenuResponse } from "./menu";

export interface ConversationSummary {
  conversation_id: string;
  session_id: string;
  title: string;
  event_type?: string | null;
  has_panel_snapshot?: boolean;
  created_at?: string;
  updated_at?: string;
  archived?: boolean;
}

export interface ConversationMessage {
  role: string;
  message_id?: string | null;
  timestamp?: string;
  content: string;
  tool_output?: unknown;
  tool_results_filtered?: unknown;
  tool_calls_payload?: unknown;
}

export interface ConversationDetail {
  conversation_id: string;
  session_id?: string;
  messages: ConversationMessage[];
  total_messages?: number;
  has_panel_snapshot?: boolean;
  event_type?: string | null;
  title?: string | null;
  menu?: ServerMenuResponse;
  scopes?: { left?: string; right?: string };
}

function sessionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "x-client-id": getClientId(),
  };
  const sessionId = useShopperStore.getState().sessionId;
  if (sessionId) headers["X-Session-Id"] = sessionId;
  const jwt = useShopperStore.getState().jwt;
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  return headers;
}

/** Sidebar list — metadata only (no full messages). */
export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${getApiUrl()}/conversations`, {
    headers: sessionHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GET /conversations failed: ${res.status}`);
  }
  const data = (await res.json()) as { conversations?: ConversationSummary[] };
  const list = data.conversations ?? [];
  console.log("[shopper-gpt] conversations list", {
    count: list.length,
    rows: list.map((c) => ({
      id: c.conversation_id,
      title: c.title,
      event_type: c.event_type,
      has_panel_snapshot: c.has_panel_snapshot,
    })),
  });
  return list;
}

/** Full thread when the user opens a sidebar row. */
export async function fetchConversation(
  conversationId: string,
  options?: { leavingConversationId?: string | null }
): Promise<ConversationDetail> {
  const headers = sessionHeaders();
  const leaving = options?.leavingConversationId?.trim();
  if (leaving && leaving !== conversationId) {
    headers["X-Leaving-Conversation-Id"] = leaving;
  }
  const res = await fetch(
    `${getApiUrl()}/conversations/${encodeURIComponent(conversationId)}`,
    { headers }
  );
  if (!res.ok) {
    throw new Error(`GET /conversations/${conversationId} failed: ${res.status}`);
  }
  const data = (await res.json()) as ConversationDetail;
  console.log("[shopper-gpt] conversation detail", {
    conversation_id: data.conversation_id,
    scopes: data.scopes,
    has_panel_snapshot: data.has_panel_snapshot,
    event_type: data.event_type,
    title: data.title,
    left: {
      messageCount: data.messages?.length ?? 0,
      shape: (data.messages ?? []).map((m) => ({
        role: m.role,
        contentLen: (m.content || "").length,
        hasToolOutput: m.tool_output != null,
        hasToolResultsFiltered: m.tool_results_filtered != null,
        hasToolCallsPayload: m.tool_calls_payload != null,
        preview: (m.content || "").slice(0, 80),
      })),
    },
    right: data.menu
      ? {
          products: data.menu.products?.length ?? 0,
          event_requirements: data.menu.event_requirements,
          menu_revision: data.menu.menu_revision,
          total_cost_eur: data.menu.total_cost_eur,
        }
      : null,
  });
  return data;
}
