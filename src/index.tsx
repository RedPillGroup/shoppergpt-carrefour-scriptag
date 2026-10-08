import { h, render } from 'preact';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssistantExperience } from './components/AssistantExperience';
import { DisabledNotice } from './components/DisabledNotice';
import { getInitialSessionId } from './api/config';
import { initDOMEventListeners } from './events';
import { useShopperStore } from './store';
import { injectStyles } from './shadow';
import satisfyWoff2 from './assets/fonts/Satisfy-Regular.woff2';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
});

// @font-face must live in document.head — Shadow DOM doesn't resolve it
function injectDocumentFonts() {
  if (document.getElementById('sgpt-fonts')) return;
  const style = document.createElement('style');
  style.id = 'sgpt-fonts';
  style.textContent = `
    @font-face {
      font-family: "Satisfy";
      src: url("${satisfyWoff2}") format("woff2");
      font-style: normal;
      font-weight: 400;
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
}

// The shadow host (#shoppergpt-chat) must clip: see the note below.
const HOST_CLIP_CSS = ':host{overflow:hidden;min-height:0;}\n';

/** Attaches the widget's shadow root to the host page's mount div and returns the
 * element to render into. */
function attachWidgetRoot(mount: HTMLElement): HTMLElement {
  const shadow = mount.attachShadow({ mode: 'open' });
  injectStyles(shadow, HOST_CLIP_CSS);
  const mountPoint = document.createElement('div');
  mountPoint.style.cssText = 'height:100%;display:flex;flex-direction:column;';
  shadow.appendChild(mountPoint);
  return mountPoint;
}

function bootstrap() {
  injectDocumentFonts();

  // Disabled build (SHOPPERGPT_DISABLED=1): show the notice with inert controls and
  // return before anything that could reach the backend (session seed, DOM event
  // listeners, the assistant itself).
  if (__WIDGET_DISABLED__) {
    const mount = document.getElementById('shoppergpt-chat');
    if (mount) render(h(DisabledNotice, null), attachWidgetRoot(mount));
    console.info('[ShopperGPT] Disabled build: the assistant is turned off, no requests are made.');
    return;
  }

  initDOMEventListeners();

  // Seed the session from the script tag's data-session-id (= Carrefour PHPSESSID,
  // injected server-side). The shoppergpt:session event can still update it later.
  const initialSessionId = getInitialSessionId();
  if (initialSessionId) {
    useShopperStore.getState().setSessionId(initialSessionId);
  }

  // Embedded chat mode: host page provides a <div id="shoppergpt-chat"> mount point
  const embeddedChatMount = document.getElementById('shoppergpt-chat');
  if (embeddedChatMount) {
    // The host owns the height. We deliberately write NOTHING on their mount
    // div: the panel below is height:100%, so the height must come from their
    // own CSS — a definite height on this div or on one of its ancestors.
    //
    // We used to stamp a height (then a min-height) as a safety net. Both were
    // worse than nothing: an inline `height` beat their stylesheet and pinned
    // the widget at 600px, and a `min-height` left an empty strip because
    // percentages do not resolve against it. Sizing is the integrator's call.
    //
    // Without a height anywhere up the chain, height:100% resolves to auto and
    // the widget grows to its unclipped content — so this is a real integration
    // requirement, not a nicety.
    const mountPoint = attachWidgetRoot(embeddedChatMount);
    render(
      h(QueryClientProvider, { client: queryClient }, h(AssistantExperience, null)),
      mountPoint
    );
    console.log('[ShopperGPT] Embedded chat mode mounted');
    return;
  }

  console.warn('[ShopperGPT] No #shoppergpt-chat mount found; skipping mount.');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
