import { getApiUrl, getClientId } from './config';
import { useShopperStore } from '../store';

export interface ConfirmCartResult {
  status: 'ok' | 'skipped' | 'error';
  reason?: string;
  detail?: string;
  /** Rendered `.header-minicart` HTML from Carrefour's /cart/add (see waib-api
   * cart/confirm passthrough) — forwarded to the host in shoppergpt:cart_updated. */
  minicart_html?: string;
}

/** POST /cart/confirm — "Ajouter au panier". Pushes the composed menu to
 * Carrefour's REAL cart via the backend's APIM client (see waib-api's
 * cart_api.py). No-op (status="skipped") when this session isn't running in
 * the real Carrefour context (see api/config.ts's getEnv()) — our own sandbox
 * must never be able to reach the real Cart API. Called exactly ONCE, on
 * explicit user confirm — never mirrors individual quantity/product edits. */
export async function confirmCart(sessionId: string | null): Promise<ConfirmCartResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': getClientId()
  };
  if (sessionId) headers['X-Session-Id'] = sessionId;
  const conversationId = useShopperStore.getState().conversationId;
  if (conversationId) headers['X-Conversation-Id'] = conversationId;

  const res = await fetch(`${getApiUrl()}/cart/confirm`, {
    method: 'POST',
    headers
  });
  if (!res.ok) {
    throw new Error(`POST /cart/confirm failed: ${res.status}`);
  }
  return (await res.json()) as ConfirmCartResult;
}
