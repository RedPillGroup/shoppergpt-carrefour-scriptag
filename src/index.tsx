import { h, render } from 'preact';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AssistantExperience } from './components/AssistantExperience';
import { getInitialSessionId, getMinHeight } from './api/config';
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
  // `.sg-mount > *` makes the panel FILL the mount point instead of shrinking to
  // its content. The panel sizes itself with height:100%, which needs a DEFINITE
  // parent height to resolve — and the mount point's height now comes from
  // `min-height` (see bootstrap), which percentages do not resolve against. The
  // panel fell back to its content height and left an empty strip below the input
  // bar. Growing it as a flex item works whether the height is definite or floored.
  styleEl.textContent =
    ':host{overflow:hidden;min-height:0;}\n' +
    '.sg-mount>*{flex:1 1 auto;min-height:0;}\n' +
    (styles as unknown as string);
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
    // Sizing safety net: the panel inside the shadow root is height:100%, so a
    // mount div resolving to 0px mounts the widget invisibly.
    //
    // Applied as `min-height`, never `height`: an inline `height` beats the
    // integrator's own stylesheet, so the net turned into a hard 600px they
    // could not override without `!important` — `height: 100%` on their div was
    // measured at 0px (an empty div, or a percentage with no definite ancestor
    // height) and silently replaced. A floor keeps the widget visible while
    // leaving any real height they provide in charge. Configurable through
    // `data-height` on the script tag; `data-height="none"` opts out.
    const minHeight = getMinHeight();
    if (minHeight) {
      embeddedChatMount.style.minHeight = minHeight;
    }

    const shadow = embeddedChatMount.attachShadow({ mode: 'open' });
    injectStyles(shadow);
    const mountPoint = document.createElement('div');
    // `min-height: inherit` picks up the host's floor across the shadow boundary,
    // so height:100% still has something to resolve against when the host itself
    // has no definite height.
    mountPoint.className = 'sg-mount';
    mountPoint.style.cssText = 'height:100%;min-height:inherit;display:flex;flex-direction:column;';
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
