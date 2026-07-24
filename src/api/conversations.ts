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
  return data;
}
