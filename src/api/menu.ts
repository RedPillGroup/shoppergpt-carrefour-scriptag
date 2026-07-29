import { getApiUrl, getClientId } from "./config";
import { EventRequirements, Product } from "../types";
import { buildProduct } from "../utils/productExtractor";
import { useShopperStore } from "../store";

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

function menuHeaders(sessionId: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-id": getClientId(),
  };
  if (sessionId) headers["X-Session-Id"] = sessionId;
  const conversationId = useShopperStore.getState().conversationId;
  if (conversationId) headers["X-Conversation-Id"] = conversationId;
  return headers;
}

function parseString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
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
  if (Array.isArray(steps) && steps.length > 0 && steps.every(s => typeof s === "string")) {
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
    if (!raw || typeof raw !== "object") continue;
    const product = buildProduct(raw as Record<string, unknown>);
    if (product) products.push(product);
  }

  const productsByStep: Record<string, Product[]> = {};
  const menuQuantities: Record<string, number> = {};

  for (const p of products) {
    const step = p.menu_step?.trim() || "Autres";
    (productsByStep[step] ??= []).push(p);
    const qtyRaw = p.recommended_quantity;
    menuQuantities[p.id] =
      qtyRaw != null && Number.isFinite(qtyRaw) ? Math.max(0, qtyRaw) : 0;
  }

  const eventRequirements = parseEventRequirements(data.event_requirements ?? {});
  const hasMenu = products.length > 0;
  const hasEvent = Object.keys(eventRequirements).length > 0;
  const menuRevision =
    typeof data.menu_revision === "number" && Number.isFinite(data.menu_revision)
      ? data.menu_revision
      : 0;

  const rawStore = data.store;
  const store =
    rawStore && rawStore.store_id != null
      ? {
          store_id: String(rawStore.store_id),
          store_name: String(rawStore.store_name ?? ""),
          mode: rawStore.mode ?? rawStore.withdrawal_mode,
        }
      : null;

  return {
    productsByStep,
    menuQuantities,
    eventRequirements,
    store,
    hasMenu: hasMenu || hasEvent,
    menuRevision,
  };
}

/** Load the conversation menu from MongoDB (supports ETag / 304). */
export async function fetchServerMenu(
  sessionId: string | null,
  options?: { ifNoneMatch?: string | null }
): Promise<FetchServerMenuResult> {
  const headers = menuHeaders(sessionId);
  if (options?.ifNoneMatch) headers["If-None-Match"] = options.ifNoneMatch;

  const res = await fetch(`${getApiUrl()}/menu`, { headers });
  if (res.status === 304) {
    return { data: null, etag: options?.ifNoneMatch ?? res.headers.get("ETag"), notModified: true };
  }
  if (!res.ok) {
    throw new Error(`GET /menu failed: ${res.status}`);
  }
  const etag = res.headers.get("ETag");
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
export async function syncMenuState(
  sessionId: string | null,
  clientState: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${getApiUrl()}/menu/sync`, {
    method: "POST",
    headers: menuHeaders(sessionId),
    body: JSON.stringify(clientState)
  });
  if (!res.ok) {
    throw new Error(`POST /menu/sync failed: ${res.status}`);
  }
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
  const headers = menuHeaders(sessionId);

  const res = await fetch(`${getApiUrl()}/suggest_products`, {
    method: "POST",
    headers,
    body: JSON.stringify({ step })
  });
  if (!res.ok) {
    throw new Error(`POST /suggest_products failed: ${res.status}`);
  }
  const data = (await res.json()) as SuggestProductsResponse;
  const products: Product[] = [];
  for (const raw of data.items ?? []) {
    if (!raw || typeof raw !== "object") continue;
    const product = buildProduct(raw as Record<string, unknown>);
    if (product) products.push(product);
  }
  return {
    products,
    menuRevision:
      typeof data.menu_revision === "number" && Number.isFinite(data.menu_revision)
        ? data.menu_revision
        : null
  };
}
