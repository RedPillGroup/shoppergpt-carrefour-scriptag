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
/**
 * CSS properties that inherit through a shadow boundary. A shadow host appended to
 * <body> would inherit these from the host page's <body> (Carrefour's can be
 * `text-align: center`, another font size, colour…), whereas the widget itself
 * inherits them from the container it is embedded in. We copy the embedded
 * host's computed values onto the modal host so the modal renders exactly as it
 * did when it lived inside the widget.
 */
const INHERITED_PROPS = [
  'color',
  'cursor',
  'direction',
  'font-family',
  'font-size',
  'font-style',
  'font-variant',
  'font-weight',
  'letter-spacing',
  'line-height',
  'list-style',
  'text-align',
  'text-indent',
  'text-shadow',
  'text-transform',
  'visibility',
  'white-space',
  'word-spacing'
];

/** The element the widget is embedded in — the source of the inherited values. */
function inheritanceReference(): Element {
  return (
    document.getElementById('shoppergpt-chat') ??
    document.getElementById('shoppergpt-root') ??
    document.body
  );
}

function createMount() {
  const host = document.createElement('div');
  host.setAttribute('data-shoppergpt-modal', '');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;';
  const reference = getComputedStyle(inheritanceReference());
  for (const prop of INHERITED_PROPS) {
    host.style.setProperty(prop, reference.getPropertyValue(prop));
  }
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
