import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useLayoutEffect, useState } from 'preact/hooks';
import { injectStyles } from '../shadow';

/**
 * Renders its children in their OWN shadow root appended to <body>, instead of
 * inside the widget's mount node.
 *
 * Why: the modals use `position: fixed` to cover the whole page, but a fixed
 * element is only relative to the viewport if none of its ancestors creates a
 * containing block (`transform`, `filter`, `perspective`, `contain`,
 * `will-change`…). The widget lives inside the host page's markup, and on some
 * pages (Carrefour's) an ancestor does — so the backdrop only dimmed the widget's
 * own box and left the site header/menu bright. Mounting at <body> level removes
 * the dependency on whatever wraps the integration div.
 *
 * It is a host of its own (not the page's), so it carries the widget stylesheet
 * and sits above the host page (max z-index). It only exists while a modal is
 * mounted, so it never intercepts clicks otherwise.
 */
function createMount() {
  const host = document.createElement('div');
  host.setAttribute('data-shoppergpt-modal', '');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  const shadow = host.attachShadow({ mode: 'open' });
  injectStyles(shadow);
  const container = document.createElement('div');
  shadow.appendChild(container);
  return { host, container };
}

export function ModalPortal({ children }: { children: ComponentChildren }) {
  const [mount] = useState(createMount);

  // Attach in a layout effect so the host is in the document before any passive
  // effect (e.g. useFocusTrap's el.focus()) runs.
  useLayoutEffect(() => {
    document.body.appendChild(mount.host);
    return () => mount.host.remove();
  }, [mount]);

  return createPortal(children, mount.container);
}
