declare global {
  interface Window {
    SHOPPERGPT_CONFIG?: {
      apiUrl?: string;
      clientId?: string;
      sessionId?: string;
      /** Dev/testing only — see getMockScreen(). */
      mockScreen?: string;
      /** "sandbox" (default) | "carrefour" — see getEnv(). */
      env?: string;
    };
  }
}

// Snapshot the embedding <script> tag's data-* attributes at module load. During
// the bundle's synchronous execution, document.currentScript points at agent.js;
// reading it later (async) returns null, so we capture it here, once.
//   <script src=".../agent.js" data-session-id="…" data-api-url="…" defer></script>
const _scriptData: DOMStringMap =
  (document.currentScript as HTMLScriptElement | null)?.dataset ?? ({} as DOMStringMap);

/**
 * API base URL. Priority: script data-api-url → window.SHOPPERGPT_CONFIG.apiUrl → dev default.
 */
export function getApiUrl(): string {
  return _scriptData.apiUrl ?? window.SHOPPERGPT_CONFIG?.apiUrl ?? 'http://127.0.0.1:8000';
}

export function getClientId(): string {
  return _scriptData.clientId ?? window.SHOPPERGPT_CONFIG?.clientId ?? 'carrefour_traiteur';
}

/**
 * Initial session id (= Carrefour PHPSESSID), injected server-side via
 * data-session-id on the script tag. Falls back to window config (sandbox).
 * The shoppergpt:session event can still override/update it later.
 */
export function getInitialSessionId(): string | null {
  return _scriptData.sessionId ?? window.SHOPPERGPT_CONFIG?.sessionId ?? null;
}

/**
 * "sandbox" (default) | "carrefour". Injected via `data-env` on the script tag —
 * Carrefour's real embed sets `data-env="carrefour"`; our own sandbox test host
 * never sets it, so it defaults safely to "sandbox". Gates, server-side, whether
 * a real Carrefour Cart API call is ever allowed to fire for this session (see
 * waib-api's state.get_env) — the real cart must NEVER be touched from a session
 * running on our own sandbox. Any value other than "sandbox"/"carrefour" is
 * ignored server-side, so a typo here just silently stays sandbox-safe.
 */
export function getEnv(): string {
  return _scriptData.env ?? window.SHOPPERGPT_CONFIG?.env ?? 'sandbox';
}

/**
 * Minimum height applied to the host's mount div, via `data-height` on the
 * script tag. Any CSS length works (`700px`, `80vh`, `min(80vh,900px)`), and
 * `none` opts out entirely.
 *
 * It is a FLOOR, not a fixed height: the panel inside the shadow root is
 * height:100%, so a mount div that resolves to 0px — which is what an empty div
 * measures before layout, and what `height:100%` resolves to when no ancestor
 * has a definite height — would mount the widget invisibly. The floor keeps it
 * visible without ever overriding a real height the integrator provides.
 */
export function getMinHeight(): string | null {
  const raw = (_scriptData.height ?? '').trim();
  if (raw === 'none') return null;
  return raw || '600px';
}

/**
 * Dev/testing only — `data-mock-screen="event"` or `"products"` on the script
 * tag skips straight to that MenuBuilderPanel screen with canned data, so you
 * don't have to re-chat through the whole flow on every reload to check a
 * layout tweak. Never set in production embeds. See AssistantExperience's
 * mock-seeding effect for what each value populates.
 */
export function getMockScreen(): 'event' | 'products' | null {
  const raw = _scriptData.mockScreen ?? window.SHOPPERGPT_CONFIG?.mockScreen;
  return raw === 'event' || raw === 'products' ? raw : null;
}
