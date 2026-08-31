import { getApiUrl, getClientId } from './config';
import { useShopperStore } from '../store';

/**
 * Canonical CTA categories. MUST stay in sync with waib-api's
 * carrefour_traiteur/routes_tracking.py (CTA_* constants) and the back-office
 * mapping — these strings are the contract across scriptag → API → BO.
 */
export type CtaCategory = 'magasin' | 'composition_menu' | 'valider_mon_menu' | 'ajouter_au_panier';

/** Same header shape as the other API clients (see api/menu.ts, api/cart.ts). */
function trackHeaders(sessionId: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': getClientId(),
    'X-Session-Id': sessionId
  };
  const conversationId = useShopperStore.getState().conversationId;
  if (conversationId) headers['X-Conversation-Id'] = conversationId;
  return headers;
}

/**
 * Fire-and-forget POST. Analytics must NEVER break or block the widget, so every
 * failure (no session yet, network, non-2xx) is swallowed. `keepalive` lets the
 * request outlive a click that also navigates/reloads the host page.
 */
function post(path: string, payload: Record<string, unknown>): void {
  try {
    const sessionId = useShopperStore.getState().sessionId;
    if (!sessionId) return; // no session to attribute the event to yet
    void fetch(`${getApiUrl()}${path}`, {
      method: 'POST',
      headers: trackHeaders(sessionId),
      body: JSON.stringify({ ...payload, session_id: sessionId }),
      keepalive: true
    }).catch(() => {
      /* best-effort */
    });
  } catch {
    /* best-effort */
  }
}

/** POST /tracking/session — fired once, when the widget first knows its session id. */
export function trackSession(): void {
  post('/tracking/session', {});
}

/** POST /tracking/cta — one row per user CTA. */
export function trackCta(category: CtaCategory): void {
  post('/tracking/cta', { category });
}
