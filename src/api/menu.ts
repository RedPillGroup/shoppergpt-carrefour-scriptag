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

  const eventType = parseString(raw.event_type);
  if (eventType !== undefined) next.event_type = eventType;

  const eventDate = parseString(raw.event_date);
  if (eventDate !== undefined) next.event_date = eventDate;

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

  const visualTheme = parseString(raw.visual_theme);
  if (visualTheme !== undefined) next.visual_theme = visualTheme;

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

export interface SuggestProductsResponse {
  step?: string;
  items?: unknown[];
}

/** "Nouvelle proposition de produits" — ask the backend for a couple of new,
 * event-coherent products for one step. Deterministic route, no LLM tool call
 * on the orchestrator's side (see routes.py's /suggest_products). */
export async function suggestProducts(
  sessionId: string | null,
  step: string
): Promise<Product[]> {
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
  return products;
}
