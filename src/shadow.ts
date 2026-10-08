import styles from './styles/tailwind.css';

/**
 * Injects the widget stylesheet (Tailwind output + the `:host` font rule) into a
 * shadow root. Shared by the main embed (index.tsx) and the modal portal so both
 * render with exactly the same styles. `hostCss` is prepended for rules that only
 * make sense on one particular host.
 */
export function injectStyles(shadow: ShadowRoot, hostCss = ''): void {
  const styleEl = document.createElement('style');
  styleEl.textContent = hostCss + (styles as unknown as string);
  shadow.appendChild(styleEl);
}
