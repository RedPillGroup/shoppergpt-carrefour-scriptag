import { h } from 'preact';
import { useShopperStore } from '../../store';
import { Product } from '../../types';
import { dispatchCartUpdated } from '../../events';

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='148' viewBox='0 0 200 148'%3E%3Crect width='200' height='148' fill='%23F3F1EE'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C7B287' font-size='36'%3E🍽%3C/text%3E%3C/svg%3E";

interface Props {
  product: Product;
}

export function ProductSuggestionCard({ product }: Props) {
  const { cartItems, addToCart, removeFromCart, sessionId, store } = useShopperStore();
  const inCart = cartItems.includes(product.id);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (inCart) {
      removeFromCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: 'remove' });
    } else {
      addToCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: 'add' });
    }
    console.log('[ShopperGPT] cart:', {
      product_id: product.id,
      store_id: store?.store_id,
      session_id: sessionId
    });
  };

  return (
    <div
      class={`bg-white rounded-xl md:rounded-[14px] overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,.06)] border border-[#E8ECF0] transition-[transform,box-shadow] duration-200 flex flex-col hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(139,122,90,.15)] ${inCart ? 'in-cart' : ''}`}
    >
      <div class="relative overflow-hidden">
        <img
          class="w-full h-[128px] md:h-[148px] object-cover block transition-transform duration-300 hover:scale-[1.04]"
          src={product.image || PLACEHOLDER}
          alt={product.name}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
        />
        <div class="absolute top-2 left-2 md:top-2.5 md:left-2.5 bg-[#C7B287] text-white text-[9px] md:text-[10px] font-semibold px-2 py-[3px] md:px-2.5 rounded-[20px]">
          {product.category}
        </div>
        <div
          class={`absolute top-2 right-2 md:top-2.5 md:right-2.5 bg-[#16a34a] text-white text-[9px] md:text-[10px] font-semibold px-2 py-[3px] md:px-2.5 rounded-[20px] transition-all duration-200 ${inCart ? 'opacity-100 scale-100' : 'opacity-0 scale-[.8]'}`}
        >
          ✓ Ajouté
        </div>
      </div>

      <div class="p-2.5 pt-2.5 pb-3 px-3 md:p-3 md:pt-3 md:pb-3.5 md:px-3.5 flex flex-col gap-1.5 flex-1">
        <div class="text-xs md:text-[13px] font-semibold text-[#1A1A2E] leading-[1.3]">
          {product.name}
        </div>
        {product.persons != null && product.persons > 0 && (
          <div class="text-[10px] md:text-[11px] text-[#6B7280]">
            Pour {product.persons} personne{product.persons > 1 ? 's' : ''} ·{' '}
            {(product.price / product.persons).toFixed(2).replace('.', ',')} €/pers.
          </div>
        )}

        <div class="flex items-center justify-between mt-auto pt-2">
          <div>
            <div class="text-[15px] md:text-[16px] font-bold text-[#C7B287]">
              {product.price.toFixed(2).replace('.', ',')} €
            </div>
            <div class="text-[9px] md:text-[10px] text-[#6B7280]">Prix TTC</div>
          </div>
          <button
            onClick={toggle}
            class={`px-3 py-1.5 md:px-3.5 md:py-[7px] rounded-[10px] border-0 text-[11px] md:text-[12px] font-semibold cursor-pointer transition-all duration-150 ${inCart ? 'bg-[#dcfce7] text-[#16a34a] hover:bg-[#bbf7d0]' : 'bg-[#E4002B] text-white hover:bg-[#c4001f]'}`}
          >
            {inCart ? '✓ Ajouté' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
