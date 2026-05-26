declare global {
  interface Window {
    SHOPPERGPT_CONFIG?: {
      apiUrl?: string;
      clientId?: string;
    };
  }
}

/**
 * Resolves the API base URL.
 * Priority: window.SHOPPERGPT_CONFIG.apiUrl → default dev URL
 * The host page can set window.SHOPPERGPT_CONFIG before loading agent.js to override.
 */
export function getApiUrl(): string {
  return window.SHOPPERGPT_CONFIG?.apiUrl ?? "http://127.0.0.1:8000";
}

export function getClientId(): string {
  return window.SHOPPERGPT_CONFIG?.clientId ?? "carrefour_traiteur";
}
