import { useEffect, useRef } from 'preact/hooks';

// Shadow-DOM-safe: listens on document (events from inside Shadow DOM bubble up)
// and uses e.composedPath() to see the real focused element across the boundary.

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

/** Traps Tab/Shift+Tab focus inside the returned ref's element and calls
 * `onEscape` on Escape — shared by every modal (ProductDetailModal,
 * ComposeProductModal, …) instead of each reimplementing this a11y logic. */
export function useFocusTrap(onEscape: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep onEscape stable inside the effect without re-running it.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    // Move focus into the panel so keyboard users are immediately inside.
    // tabIndex={-1} on the panel div makes it programmatically focusable.
    el.focus({ preventScroll: true });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusable(el);
      if (!focusable.length) { e.preventDefault(); return; }

      // composedPath()[0] is the real focused element even inside a Shadow root.
      const active = e.composedPath()[0] as HTMLElement;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // runs once on mount; onEscape always current via ref

  return panelRef;
}
