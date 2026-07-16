declare global {
  interface Window {
    SHOPPERGPT_CONFIG?: {
      apiUrl?: string;
      clientId?: string;
      sessionId?: string;
      /** Dev/testing only — see getMockScreen(). */
      mockScreen?: string;
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
  return _scriptData.apiUrl ?? window.SHOPPERGPT_CONFIG?.apiUrl ?? "http://127.0.0.1:8000";
}

export function getClientId(): string {
  return _scriptData.clientId ?? window.SHOPPERGPT_CONFIG?.clientId ?? "carrefour_traiteur";
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

