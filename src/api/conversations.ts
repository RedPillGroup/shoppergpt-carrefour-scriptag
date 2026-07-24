import { getApiUrl, getClientId } from "./config";
import { useShopperStore } from "../store";

export interface ConversationSummary {
  conversation_id: string;
  session_id: string;
  title: string;
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
  return data.conversations ?? [];
}

/** Full thread when the user opens a sidebar row. */
export async function fetchConversation(
  conversationId: string
): Promise<{ conversation_id: string; messages: ConversationMessage[] }> {
  const res = await fetch(`${getApiUrl()}/conversations/${encodeURIComponent(conversationId)}`, {
    headers: sessionHeaders(),
  });
  if (!res.ok) {
    throw new Error(`GET /conversations/${conversationId} failed: ${res.status}`);
  }
  return res.json();
}

/** Temporary fake titles until product copy / title generation is decided. */
const FAKE_TITLES = [
  "Préparer l'anniversaire de mon fils et de ses 5 amis",
  "Trouver une idée de repas de fête des mères",
  "Organiser un buffet d'entreprise pour 30 personnes",
  "Composer un menu brunch du dimanche",
  "Préparer un apéro dinatoire entre amis",
];

export function fakeConversationTitle(index: number): string {
  return FAKE_TITLES[index % FAKE_TITLES.length];
}
