import { h } from 'preact';
import { Product } from '../../types';
import { useShopperStore } from '../../store';

interface Props {
  product: Product;
  quantity: number;
  onQuantityChange: (delta: number) => void;
  /** Row layout (image left, price/name right) instead of the default card
   * (image top). Used for the mobile horizontal-scroll product strip only —
   * see MenuBuilderPanel, which renders this alongside the normal grid and
   * lets CSS pick one per breakpoint. */
  horizontal?: boolean;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'%3E%3Crect width='200' height='160' fill='%23F3F1EE'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C7B287' font-size='36'%3E🍽%3C/text%3E%3C/svg%3E";

const MAX_QTY = 99;

export function MenuProductCard({ product, quantity, onQuantityChange, horizontal = false }: Props) {
  const inMenu = quantity > 0;
  const setSelectedProduct = useShopperStore(s => s.setSelectedProduct);

  if (horizontal) {
    return (
      <div
        class="relative h-full overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,.07)] flex flex-row cursor-pointer bg-white"
        onClick={() => setSelectedProduct(product)}
      >
        {/* Everything except the toggle button lives in this one dimmable
            wrapper — a single opacity on the whole card reads as "grayed out"
            as one surface, rather than the image/text fading separately. The
            toggle button is pulled OUT as its own sibling below, absolutely
            positioned over the same spot, so it stays at full clarity and
            obviously still tappable. */}
        <div class={`flex flex-row flex-1 min-w-0 h-full transition-opacity duration-200 ${!inMenu ? 'opacity-40' : ''}`}>
        {/* ── Image + overlays — fixed-width column, but full card height (not
            aspect-square) so the row can grow tall enough for a 3-line name
            without clipping it. object-cover still crops the photo cleanly. ── */}
        <div class="relative shrink-0 w-[150px] h-full">
          <img
            class={`w-full h-full object-cover block transition-all duration-200 ${!inMenu ? 'grayscale' : ''}`}
            src={product.image || PLACEHOLDER}
            alt={product.name}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
          />

          {/* Straddles the image/content seam — anchored to this column's own
              right edge (left-full) then pulled back by half its own width
              (-translate-x-1/2), same trick as elsewhere: no need to know the
              exact pixel boundary, it just centers on wherever this column ends. */}
          <div
            class="absolute top-[85%] left-full -translate-x-1/2 -translate-y-1/2 z-10 flex items-center bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,.15)] px-1 py-1"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => onQuantityChange(-1)}
              disabled={quantity === 0}
              class={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[14px] md:text-[17px] font-bold transition-colors ${
                quantity > 0 ? 'text-[#C7B287] hover:bg-[#F4EFE5]' : 'text-[#D1D5DB] cursor-not-allowed'
              }`}
            >
              −
            </button>
            {/* Qty display only — not editable by keyboard input, only via the
                −/+ buttons on either side (a typed value could bypass stock/
                budget checks the increment path enforces). */}
            <span
              class={`min-w-[24px] text-center text-[13px] md:text-[14px] font-bold tabular-nums ${inMenu ? 'text-[#C7B287]' : 'text-[#9A8C78]'}`}
            >
              {quantity}
            </span>
            <button
              onClick={() => onQuantityChange(+1)}
              disabled={quantity >= MAX_QTY}
              class={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[14px] md:text-[17px] font-bold transition-colors ${
                quantity < MAX_QTY ? 'text-[#C7B287] hover:bg-[#F4EFE5]' : 'text-[#D1D5DB] cursor-not-allowed'
              }`}
            >
              +
            </button>
          </div>
        </div>

        {/* ── Content — price + name, right of the image. Top-aligned (not
            centered) so it sits near the image's top edge, leaving the lower
            portion free for the stepper straddling the seam above. ────────── */}
        <div class="flex-1 min-w-0 flex flex-col justify-start gap-1 px-3 pt-8 pb-2">
          <div class="text-[14px] font-bold text-[#E2422B]">
            {product.price.toFixed(2).replace('.', ',')} €
          </div>
          <div class="text-[12px] text-[#3D3529] leading-snug line-clamp-3">
            {product.name}
          </div>
        </div>
        </div>

        {/* Toggle button — top-right of the image column, outside the dimmed
            wrapper above (see comment there). Selected: white circle + green
            ring + green check. Unselected: a plain grey-ringed empty circle
            at full opacity (no X) — signals "not picked, but still clearly
            tappable to add". Positioned by hand (left, not right) since it
            belongs over the fixed-width image column, not the card's far
            right edge. */}
        <button
          class={`absolute top-1.5 left-[120px] w-6 h-6 rounded-full flex items-center justify-center shadow border-2 transition-all duration-200 ${
            inMenu ? 'bg-white border-[#B2CF0C]' : 'bg-white border-[#D9D9D9]'
          }`}
          onClick={e => {
            e.stopPropagation();
            onQuantityChange(inMenu ? -quantity : 1);
          }}
        >
          {inMenu && (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5l2.5 2.5L9 2.5" stroke="#B2CF0C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          )}
        </button>
      </div>
    );
  }

  return (
    <div
      class="relative overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,.07)] flex flex-col cursor-pointer bg-white"
      onClick={() => setSelectedProduct(product)}
    >
      {/* Everything except the toggle button lives in this one dimmable
          wrapper — a single opacity on the whole card (image, stepper,
          price, name) reads as "grayed out" as one surface, rather than
          several separately-faded pieces. The toggle button is pulled OUT
          as its own sibling below, absolutely positioned over the same
          top-right spot, so it's the one thing that stays at full clarity
          and obviously still tappable. */}
      <div class={`flex flex-col flex-1 transition-opacity duration-200 ${!inMenu ? 'opacity-40' : ''}`}>
        <div class="relative shrink-0">
          <img
            class={`w-full aspect-square object-cover block transition-all duration-200 ${!inMenu ? 'grayscale' : ''}`}
            src={product.image || PLACEHOLDER}
            alt={product.name}
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
          />

          {/* Quantity pill — anchored at image bottom, centred */}
          <div
            class="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,.15)] px-1 py-0.5 gap-0"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => onQuantityChange(-1)}
              disabled={quantity === 0}
              class={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-sm md:text-base font-bold transition-colors ${
                quantity > 0
                  ? 'text-[#C7B287] hover:bg-[#F4EFE5]'
                  : 'text-[#D1D5DB] cursor-not-allowed'
              }`}
            >
              −
            </button>

            {/* Qty display only — not editable by keyboard input, only via the
                −/+ buttons on either side (a typed value could bypass stock/
                budget checks the increment path enforces). */}
            <span
              class={`min-w-[24px] text-center text-[12px] md:text-[13px] font-bold tabular-nums ${inMenu ? 'text-[#C7B287]' : 'text-[#9A8C78]'}`}
            >
              {quantity}
            </span>

            <button
              onClick={() => onQuantityChange(+1)}
              disabled={quantity >= MAX_QTY}
              class={`w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center text-sm md:text-base font-bold transition-colors ${
                quantity < MAX_QTY
                  ? 'text-[#C7B287] hover:bg-[#F4EFE5]'
                  : 'text-[#D1D5DB] cursor-not-allowed'
              }`}
            >
              +
            </button>
          </div>
        </div>

        {/* ── Content ─────────────────────────────────────── */}
        <div class="px-2.5 pt-2 pb-3 flex flex-col gap-0.5">
          <div class="text-[13px] md:text-[14px] font-bold text-[#E2422B]">
            {product.price.toFixed(2).replace('.', ',')} €
          </div>
          {/* min-h reserves space for 2 lines (leading-snug ≈ 1.375 × font-size)
              even when the name only wraps to 1 — otherwise cards with short vs
              long names end up different heights in the same row. */}
          <div class="text-[12px] md:text-[13px] text-[#6B7280] leading-snug line-clamp-2 min-h-[2.75em]">
            {product.name}
          </div>
        </div>
      </div>

      {/* Toggle button — top-right, outside the dimmed wrapper above (see
          comment there). Selected: white circle + green ring + green check.
          Unselected: a plain grey-ringed empty circle at full opacity (no X) —
          signals "not picked, but still clearly tappable to add". */}
      <button
        class={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center shadow border-2 transition-all duration-200 ${
          inMenu ? 'bg-white border-[#B2CF0C]' : 'bg-white border-[#D9D9D9]'
        }`}
        onClick={e => {
          e.stopPropagation();
          if (inMenu) {
            // Gray out: set qty to 0
            onQuantityChange(-quantity);
          } else {
            // Re-enable: restore to 1
            onQuantityChange(1);
          }
        }}
      >
        {inMenu && (
          <svg width="13" height="13" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5l2.5 2.5L9 2.5" stroke="#B2CF0C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}
