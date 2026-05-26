# shopper-gpt-carrefour-scriptag

The ShopperGPT widget for Carrefour Traiteur. Builds to a single `dist/agent.js` file injected via ScriptTag on the OpenMage site.

**Repository:** [github.com/selim-redpill/shoppergpt-carrefour-scriptag](https://github.com/selim-redpill/shoppergpt-carrefour-scriptag)

## Embed (ScriptTag)

After `npm run build`, commit and push `dist/agent.js` to `main`, then load the widget from any page:

```html
<div id="shoppergpt-chat"></div>

<!-- Full-page chat + product panel -->
<script
  src="https://cdn.jsdelivr.net/gh/selim-redpill/shoppergpt-carrefour-scriptag@main/dist/agent.js"
  defer
></script>

<!-- Optional: override API URL / client id before the script loads -->
<script>
  window.SHOPPERGPT_CONFIG = {
    apiUrl: "http://127.0.0.1:8000",
    clientId: "carrefour_traiteur",
  };
</script>
```

Floating FAB mode (no `#shoppergpt-chat` mount): omit the div; the script injects `#shoppergpt-root` automatically.

Pin a release tag instead of `@main` for production, e.g. `@v1.0.0`.

## Stack

| Tool | Purpose |
|------|---------|
| Preact + preact/compat | React-compatible UI, ~3kb |
| TypeScript | Type safety |
| Webpack 5 (UMD) | Single-file bundle → `agent.js` |
| Tailwind CSS | Utility styles inside Shadow DOM |
| Zustand | Global state (session, cart, messages) |
| Tanstack Query | Data fetching (ready for real API) |
| Framer Motion | Panel/message animations |
| Zod | API payload validation |
| React Markdown | Render LLM markdown responses |

## Setup

```bash
cd shopper-gpt-carrefour-scriptag
npm install
```

## Commands

```bash
npm run dev    # Watch mode with source maps → dist/agent.js
npm run build  # Production minified bundle
```

## Project structure

```
src/
├── index.tsx          # Entry point — mounts widget into Shadow DOM
├── types.ts           # Shared TypeScript interfaces
├── store.ts           # Zustand global state
├── events.ts          # DOM event listeners & dispatchers
├── mockData.ts        # Mock products, messages, store (used until backend is ready)
├── styles/
│   └── tailwind.css   # Tailwind entry (imported by Webpack)
└── components/
    ├── Widget.tsx      # Root component — FAB + animated panel container
    ├── ChatPanel.tsx   # Left panel: messages, input, quick replies
    ├── ProductPanel.tsx # Right panel: product grid
    ├── ProductCard.tsx  # Individual product tile with add-to-cart
    └── ProductDetail.tsx # Full product detail view
```

## DOM Events

The widget communicates with the host OpenMage page via `CustomEvent` on `window`.

### Received by widget (Site → Widget)

| Event | Payload | When |
|-------|---------|------|
| `shoppergpt:session` | `{ session_id: string }` | Page load |
| `shoppergpt:page_context` | `{ store_id: string, store_name: string }` | Store selection |

### Dispatched by widget (Widget → Site)

| Event | Payload | When |
|-------|---------|------|
| `shoppergpt:cart_updated` | `{ success: bool, product_id: string, action: 'add' \| 'remove' }` | Cart action |
| `shoppergpt:change_shop` | `{ store_id: string }` | User changes store in widget |

## Analytics

On first open, the widget sets:
```
shoppergpt_interacted=true; path=/; max-age=31536000
```
Carrefour reads this via GTM → GA4 custom dimension on purchase events.

## Swapping mock data for real API

1. **LLM responses** — in `ChatPanel.tsx`, replace the `setTimeout` mock block with a `fetch` to your FastAPI endpoint.
2. **Cart** — in `ProductCard.tsx` and `ProductDetail.tsx`, replace the direct `addToCart()` call with `POST https://shoppergpt.fr/api/cart/add`.
3. **Products** — in `ProductPanel.tsx`, use Tanstack Query's `useQuery` to fetch from your recommendations endpoint instead of falling back to `mockProducts`.
