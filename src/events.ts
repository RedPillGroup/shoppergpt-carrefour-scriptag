import { useShopperStore } from "./store";
import { SessionEvent, PageContextEvent, CartUpdatedEvent, ChangeShopEvent } from "./types";

export function initDOMEventListeners() {
  window.addEventListener("shoppergpt:session", (e: Event) => {
    const { session_id } = (e as CustomEvent<SessionEvent>).detail;
    useShopperStore.getState().setSessionId(session_id);
  });

  window.addEventListener("shoppergpt:page_context", (e: Event) => {
    const { store_id, store_name } = (e as CustomEvent<PageContextEvent>).detail;
    useShopperStore.getState().setStore({ store_id, store_name });
  });
}

export function dispatchCartUpdated(payload: CartUpdatedEvent) {
  window.dispatchEvent(
    new CustomEvent("shoppergpt:cart_updated", { detail: payload, bubbles: true })
  );
}

export function dispatchChangeShop(payload: ChangeShopEvent) {
  window.dispatchEvent(
    new CustomEvent("shoppergpt:change_shop", { detail: payload, bubbles: true })
  );
}
