import { h, render } from "preact";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Widget } from "./components/Widget";
import { FullPageApp } from "./components/FullPageApp";
import { initDOMEventListeners } from "./events";
import styles from "./styles/tailwind.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function injectStyles(shadow: ShadowRoot) {
  const styleEl = document.createElement("style");
  styleEl.textContent = styles as unknown as string;
  shadow.appendChild(styleEl);

  const fontLink = document.createElement("link");
  fontLink.rel = "stylesheet";
  fontLink.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  shadow.appendChild(fontLink);
}

function bootstrap() {
  initDOMEventListeners();

  // Full-page mode: host page provides a <div id="shoppergpt-chat"> mount point
  const fullPageMount = document.getElementById("shoppergpt-chat");
  if (fullPageMount) {
    const shadow = fullPageMount.attachShadow({ mode: "open" });
    injectStyles(shadow);
    const mountPoint = document.createElement("div");
    mountPoint.style.cssText = "height:100%;display:flex;flex-direction:column;";
    shadow.appendChild(mountPoint);
    render(
      h(QueryClientProvider, { client: queryClient }, h(FullPageApp, null)),
      mountPoint
    );
    console.log("[ShopperGPT] Full-page mode mounted");
    return;
  }

  // Floating widget mode: inject FAB into page
  const host = document.createElement("div");
  host.id = "shoppergpt-root";
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: "open" });
  injectStyles(shadow);
  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);
  render(
    h(QueryClientProvider, { client: queryClient }, h(Widget, null)),
    mountPoint
  );
  console.log("[ShopperGPT] Floating widget mounted");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  bootstrap();
}
