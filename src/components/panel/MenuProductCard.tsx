import { h } from 'preact';
import { useState } from 'preact/hooks';
import { Product } from '../../types';
import { useShopperStore } from '../../store';

interface Props {
  product: Product;
  quantity: number;
  onQuantityChange: (delta: number) => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'%3E%3Crect width='200' height='160' fill='%23F3F1EE'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C7B287' font-size='36'%3E🍽%3C/text%3E%3C/svg%3E";

const MAX_QTY = 99;

export function MenuProductCard({ product, quantity, onQuantityChange }: Props) {
  const inMenu = quantity > 0;
  const setSelectedProduct = useShopperStore(s => s.setSelectedProduct);

  // Local state for inline qty editing
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  function commitEdit(raw: string) {
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(MAX_QTY, Math.max(0, parsed));
      onQuantityChange(clamped - quantity);
    }
    setEditing(false);
  }

  return (
    <div
      class={`rounded-2xl overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,.07)] flex flex-col cursor-pointer transition-opacity duration-200 ${
        inMenu ? 'bg-white opacity-100' : 'bg-white opacity-40'
      }`}
      onClick={() => setSelectedProduct(product)}
    >

      {/* ── Image + overlays ─────────────────────────────── */}
      <div class="relative shrink-0">
        <img
          class={`w-full h-[150px] object-cover block transition-all duration-200 ${!inMenu ? 'grayscale' : ''}`}
          src={product.image || PLACEHOLDER}
          alt={product.name}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
        />

        {/* Toggle button — top-right: checkmark when inMenu, grey X when qty=0 */}
        <button
          class={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow transition-all duration-200 ${
            inMenu
              ? 'bg-[#16a34a] opacity-100 scale-100'
              : 'bg-[#9CA3AF] opacity-80 scale-100'
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
          {inMenu ? (
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5l2.5 2.5L9 2.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 2l6 6M8 2l-6 6" stroke="white" stroke-width="1.6" stroke-linecap="round" />
            </svg>
          )}
        </button>

        {/* Quantity pill — anchored at image bottom, centred */}
        <div
          class="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center bg-white rounded-full shadow-[0_2px_8px_rgba(0,0,0,.15)] px-1 py-0.5 gap-0"
          onClick={e => e.stopPropagation()}
        >
          <button
            onClick={() => onQuantityChange(-1)}
            disabled={quantity === 0}
            class={`w-7 h-7 rounded-full flex items-center justify-center text-base font-bold transition-colors ${
              quantity > 0
                ? 'text-[#C7B287] hover:bg-[#F4EFE5]'
                : 'text-[#D1D5DB] cursor-not-allowed'
            }`}
          >
            −
          </button>

          {/* Qty: click to edit inline */}
          {editing ? (
            <input
              class="min-w-[32px] w-[32px] text-center text-[13px] font-bold tabular-nums text-[#C7B287] border-none outline-none bg-transparent"
              type="number"
              min={0}
              max={MAX_QTY}
              value={inputVal}
              onInput={e => setInputVal((e.target as HTMLInputElement).value)}
              onBlur={e => commitEdit((e.target as HTMLInputElement).value)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitEdit((e.target as HTMLInputElement).value);
                if (e.key === 'Escape') setEditing(false);
              }}
              autoFocus
            />
          ) : (
            <span
              class={`min-w-[24px] text-center text-[13px] font-bold tabular-nums cursor-text ${inMenu ? 'text-[#C7B287]' : 'text-[#9A8C78]'}`}
              onClick={e => {
                e.stopPropagation();
                setInputVal(String(quantity));
                setEditing(true);
              }}
            >
              {quantity}
            </span>
          )}

          <button
            onClick={() => onQuantityChange(+1)}
            disabled={quantity >= MAX_QTY}
            class={`w-7 h-7 rounded-full flex items-center justify-center text-base font-bold transition-colors ${
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
        <div class="text-[13px] md:text-[14px] font-bold text-[#C7B287]">
          {product.price.toFixed(2).replace('.', ',')} €
        </div>
        <div class="text-[10px] md:text-[11px] text-[#6B7280] leading-snug line-clamp-2">
          {product.name}
        </div>
        {product.persons != null && product.persons > 1 && (
          <div class="text-[9px] text-[#B0A898]">
            {product.persons} pers. · {(product.price / product.persons).toFixed(2).replace('.', ',')} €/pers.
          </div>
        )}
      </div>
    </div>
  );
}
