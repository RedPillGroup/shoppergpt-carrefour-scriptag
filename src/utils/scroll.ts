// Contained scroll helpers.
//
// The widget lives in a Shadow DOM embedded on an arbitrary host page (Carrefour's
// OpenMage site). Element.scrollIntoView() scrolls EVERY scrollable ancestor needed
// to reveal the target — including the host page's window — which yanks the whole
// embedding page around. These helpers only ever move a specific scroll container's
// own scrollTop, so scrolling stays contained to the widget and never touches the
// host page.

/** Scroll a container to its bottom (e.g. the chat message list on a new message). */
export function scrollContainerToBottom(
  container: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior });
}

/**
 * Bring `child`'s top edge to the top of `container` (the contained equivalent of
 * `child.scrollIntoView({ block: 'start' })`), moving ONLY the container. No-op when
 * the child isn't laid out (display:none — e.g. a step hidden by the mobile pager),
 * mirroring scrollIntoView's own silent no-op on hidden elements.
 */
export function scrollChildToContainerTop(
  container: HTMLElement | null,
  child: HTMLElement | null,
  behavior: ScrollBehavior = 'smooth'
): void {
  if (!container || !child || child.offsetParent === null) return;
  const delta =
    child.getBoundingClientRect().top - container.getBoundingClientRect().top;
  container.scrollTo({ top: container.scrollTop + delta, behavior });
}
