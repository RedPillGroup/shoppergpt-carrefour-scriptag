import { getApiUrl, getClientId } from './config';
import { EventRequirements, Product } from '../types';
import { buildProduct } from '../utils/productExtractor';
import { useShopperStore } from '../store';

export interface ServerMenuResponse {
  products?: unknown[];
  menu_revision?: number;
  event_requirements?: Record<string, unknown>;
  store?: {
    store_id?: number | string;
    store_name?: string;
    mode?: string;
    withdrawal_mode?: string;
  } | null;
  total_cost_eur?: number;
}

export interface MenuPanelState {
  productsByStep: Record<string, Product[]>;
  menuQuantities: Record<string, number>;
  eventRequirements: EventRequirements;
  store: { store_id: string; store_name: string; mode?: string } | null;
  hasMenu: boolean;
  menuRevision: number;
}

export interface FetchServerMenuResult {
  data: ServerMenuResponse | null;
  etag: string | null;
  notModified: boolean;
}

/**
 * Headers every session-scoped call must carry. X-Session-Id is what lets the
 * API resolve the selected store — without it a route silently answers with
 * store-agnostic data (the median price, the global lead time) instead of what
 * this customer's store actually charges and promises.
 */
export function sessionHeaders(sessionId: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': getClientId()
  };
  if (sessionId) headers['X-Session-Id'] = sessionId;
  const conversationId = useShopperStore.getState().conversationId;
  if (conversationId) headers['X-Conversation-Id'] = conversationId;
  return headers;
}

function parseString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`;
  }
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function parseEventRequirements(raw: Record<string, unknown>): EventRequirements {
  const next: EventRequirements = {};

  const eventName = parseString(raw.event_name);
  if (eventName !== undefined) next.event_name = eventName;

  const eventDate = parseString(raw.date);
  if (eventDate !== undefined) next.date = eventDate;

  const adults = parseNumber(raw.guests_adults);
  if (adults !== undefined) next.guests_adults = adults;

  const kids = parseNumber(raw.guests_kids);
  if (kids !== undefined) next.guests_kids = kids;

  const budget = parseNumber(raw.budget);
  if (budget !== undefined) next.budget = budget;

  const steps = raw.menu_steps;
  if (Array.isArray(steps) && steps.length > 0 && steps.every(s => typeof s === 'string')) {
    next.menu_steps = steps as string[];
  }

  const eventTheme = parseString(raw.event_theme);
  if (eventTheme !== undefined) next.event_theme = eventTheme;

  return next;
}

/** Map GET /menu JSON into panel state (authoritative Mongo snapshot). */
export function menuResponseToPanelState(data: ServerMenuResponse): MenuPanelState {
  const products: Product[] = [];
  for (const raw of data.products ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const product = buildProduct(raw as Record<string, unknown>);
    if (product) products.push(product);
  }

  const productsByStep: Record<string, Product[]> = {};
  const menuQuantities: Record<string, number> = {};

  for (const p of products) {
    const step = p.menu_step?.trim() || 'Autres';
    (productsByStep[step] ??= []).push(p);
    const qtyRaw = p.recommended_quantity;
    menuQuantities[p.id] = qtyRaw != null && Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : 0;
  }

  const eventRequirements = parseEventRequirements(data.event_requirements ?? {});
  const hasMenu = products.length > 0;
  const hasEvent = Object.keys(eventRequirements).length > 0;
  const menuRevision =
    typeof data.menu_revision === 'number' && Number.isFinite(data.menu_revision)
      ? data.menu_revision
      : 0;

  const rawStore = data.store;
  const store =
    rawStore && rawStore.store_id != null
      ? {
          store_id: String(rawStore.store_id),
          store_name: String(rawStore.store_name ?? ''),
          mode: rawStore.mode ?? rawStore.withdrawal_mode
        }
      : null;

  return {
    productsByStep,
    menuQuantities,
    eventRequirements,
    store,
    hasMenu: hasMenu || hasEvent,
    menuRevision
  };
}

/** Load the conversation menu from MongoDB (supports ETag / 304). */
export async function fetchServerMenu(
  sessionId: string | null,
  options?: { ifNoneMatch?: string | null }
): Promise<FetchServerMenuResult> {
  const headers = sessionHeaders(sessionId);
  if (options?.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch;

  const res = await fetch(`${getApiUrl()}/menu`, { headers });
  if (res.status === 304) {
    return { data: null, etag: options?.ifNoneMatch ?? res.headers.get('ETag'), notModified: true };
  }
  if (!res.ok) {
    throw new Error(`GET /menu failed: ${res.status}`);
  }
  const etag = res.headers.get('ETag');
  const data = (await res.json()) as ServerMenuResponse;
  return { data, etag, notModified: false };
}

/** Eagerly persist the panel's current local state (see getClientState in
 * AssistantExperience.tsx) instead of waiting for the next chat message to
 * carry it along as /answer's client_state. Without this, quantity changes,
 * removed products, and kept/discarded suggestions made without sending a
 * message are lost the moment the user switches conversations or refreshes —
 * GET /menu and conversation-restore only ever reflect what was last WRITTEN
 * to user_state, and until now only a chat turn ever wrote there. */
export interface SyncMenuResult {
  /** Authoritative revision AFTER this sync, or null when the server omits it. */
  menuRevision: number | null;
  /** Set when the server REFUSED the snapshot as stale — the edits were dropped. */
  conflict: boolean;
}

export async function syncMenuState(
  sessionId: string | null,
  clientState: Record<string, unknown>
): Promise<SyncMenuResult> {
  const res = await fetch(`${getApiUrl()}/menu/sync`, {
    method: 'POST',
    headers: sessionHeaders(sessionId),
    body: JSON.stringify(clientState)
  });
  if (!res.ok) {
    throw new Error(`POST /menu/sync failed: ${res.status}`);
  }
  // The response used to be discarded. An ACCEPTED sync bumps the server
  // revision, so the caller's snapshot goes stale the instant its own sync
  // lands — and every later edit is refused as "stale client_revision", with
  // no visible sign since the status stays 200. Callers must feed the returned
  // revision back into menuRevisionRef.
  const data = (await res.json().catch(() => ({}))) as {
    menu_revision?: number;
    warning?: { sync_conflict?: boolean } | null;
  };
  return {
    menuRevision:
      typeof data.menu_revision === 'number' && Number.isFinite(data.menu_revision)
        ? data.menu_revision
        : null,
    conflict: data.warning?.sync_conflict === true
  };
}

export interface AdjustStepResult {
  step?: string;
  changed?: boolean;
  menu_revision?: number;
  message?: string;
}

/** Rebalance one step's quantities after the user ACTIVATED a suggested product
 * (qty 0 → ≥1). Deterministic REST action, mirror of /suggest_products — the
 * orchestrator is not in the loop. The client snapshot rides along so the
 * activation (panel-only until now) is synced before the engine sizes the step.
 * A 409 means our snapshot was stale: resync GET /menu, don't retry blindly. */
export async function adjustStepQuantities(
  sessionId: string | null,
  step: string,
  clientState: Record<string, unknown> | null
): Promise<AdjustStepResult> {
  const res = await fetch(`${getApiUrl()}/adjust_step`, {
    method: 'POST',
    headers: sessionHeaders(sessionId),
    body: JSON.stringify({ step, client_state: clientState })
  });
  if (!res.ok) {
    // On 409 the body's detail carries the server revision (sync_state conflict
    // shape) — surfaced so the caller can adopt it even when GET /menu 304s.
    let serverRevision: number | undefined;
    try {
      const detail = (await res.json())?.detail;
      if (typeof detail?.server_revision === 'number') serverRevision = detail.server_revision;
    } catch {
      /* body not JSON — keep undefined */
    }
    throw Object.assign(new Error(`POST /adjust_step failed: ${res.status}`), {
      status: res.status,
      serverRevision
    });
  }
  return (await res.json()) as AdjustStepResult;
}

export interface SuggestProductsResponse {
  step?: string;
  items?: unknown[];
  /** Server menu revision AFTER the picks were persisted. The backend adds one
   * showcase item per pick and each bump moves the server ahead of us, so the
   * caller must adopt this value — otherwise our next /answer snapshot looks
   * stale to sync_state and is discarded along with any panel edit the user
   * made in between (see tools.py's suggest_products). */
  menu_revision?: number;
}

export interface SuggestProductsResult {
  products: Product[];
  /** null when the backend didn't report one (older build) — caller keeps its own. */
  menuRevision: number | null;
}

/** "Nouvelle proposition de produits" — ask the backend for a couple of new,
 * event-coherent products for one step. Deterministic route, no LLM tool call
 * on the orchestrator's side (see routes.py's /suggest_products). */
export async function suggestProducts(
  sessionId: string | null,
  step: string
): Promise<SuggestProductsResult> {
  const headers = sessionHeaders(sessionId);

  const res = await fetch(`${getApiUrl()}/suggest_products`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ step })
  });
  if (!res.ok) {
    throw new Error(`POST /suggest_products failed: ${res.status}`);
  }
  const data = (await res.json()) as SuggestProductsResponse;
  const products: Product[] = [];
  for (const raw of data.items ?? []) {
    if (!raw || typeof raw !== 'object') continue;
    const product = buildProduct(raw as Record<string, unknown>);
    if (product) products.push(product);
  }
  return {
    products,
    menuRevision:
      typeof data.menu_revision === 'number' && Number.isFinite(data.menu_revision)
        ? data.menu_revision
        : null
  };
}
