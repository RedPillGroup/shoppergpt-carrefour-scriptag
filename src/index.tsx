import { h, render } from 'preact';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssistantExperience } from './components/AssistantExperience';
import { getInitialSessionId } from './api/config';
import { initDOMEventListeners } from './events';
import { useShopperStore } from './store';
import styles from './styles/tailwind.css';
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

function injectStyles(shadow: ShadowRoot) {
  const styleEl = document.createElement('style');
  // Make the shadow host (#shoppergpt-chat) a scroll boundary: the widget scrolls
  // INTERNALLY, so the host must clip. Without this, a host that sets only a height
  // (e.g. Carrefour's OpenMage page) isn't a boundary — internal scrolls leak to the
  // HOST PAGE and the inner chat list never becomes the effective scroller. The
  // sandbox host sets this in its own CSS; `:host` applies it to every embed. This
  // one rule keeps ALL widget scrolling (chat auto-scroll, step nav, focus) contained.
  styleEl.textContent = ':host{overflow:hidden;min-height:0;}\n' + (styles as unknown as string);
  shadow.appendChild(styleEl);
}

function bootstrap() {
  injectDocumentFonts();
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
    // Sizing safety net: the panel inside the shadow root is height:100%, so if
    // the host container resolves to 0px (integrator added the div but set no
    // height) the widget mounts but is invisible. Give the host a concrete
    // default height unless it already has a usable one — so integrators don't
    // have to hardcode a height on their div.
    const computedHeight = window.getComputedStyle(embeddedChatMount).height;
    const hasUsableHeight =
      !!embeddedChatMount.style.height ||
      (computedHeight !== '' && computedHeight !== 'auto' && computedHeight !== '0px');
    if (!hasUsableHeight) {
      embeddedChatMount.style.height = '600px';
    }

    const shadow = embeddedChatMount.attachShadow({ mode: 'open' });
    injectStyles(shadow);
    const mountPoint = document.createElement('div');
    mountPoint.style.cssText = 'height:100%;display:flex;flex-direction:column;';
    shadow.appendChild(mountPoint);
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
