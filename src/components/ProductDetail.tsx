import { h } from "preact";
import { motion } from "framer-motion";
import { Product } from "../types";
import { useShopperStore } from "../store";
import { dispatchCartUpdated } from "../events";

interface Props {
  product: Product;
  onBack: () => void;
}

export function ProductDetail({ product, onBack }: Props) {
  const { cartItems, addToCart, removeFromCart, sessionId, store } = useShopperStore();
  const inCart = cartItems.includes(product.id);

  const toggleCart = () => {
    if (inCart) {
      removeFromCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: "remove" });
    } else {
      addToCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: "add" });
    }
    console.log("[ShopperGPT] Cart toggle:", {
      product_id: product.id,
      action: inCart ? "remove" : "add",
      store_id: store?.store_id,
      session_id: sessionId,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      class="h-full flex flex-col bg-carrefour-bg"
    >
      <div class="relative">
        <img src={product.image} alt={product.name} class="w-full h-52 object-cover" />
        <button
          onClick={onBack}
          class="absolute top-3 left-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow hover:bg-white transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        {product.category && (
          <div class="absolute bottom-3 left-3 bg-carrefour-blue text-white text-xs px-2 py-1 rounded-full">
            {product.category}
          </div>
        )}
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <h2 class="text-lg font-bold text-gray-800 mb-1">{product.name}</h2>
        <p class="text-sm text-gray-500 mb-3">Pour {product.persons} personnes</p>

        {product.description && (
          <p class="text-sm text-gray-600 leading-relaxed mb-4">{product.description}</p>
        )}

        {product.allergens.length > 0 && (
          <div class="mb-4">
            <p class="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Allergènes
            </p>
            <div class="flex flex-wrap gap-1.5">
              {product.allergens.map((a) => (
                <span
                  key={a}
                  class="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full border border-amber-200"
                >
                  ⚠ {a}
                </span>
              ))}
            </div>
          </div>
        )}

        <div class="bg-blue-50 rounded-xl p-3 mb-4">
          <p class="text-xs text-carrefour-blue font-medium">
            💡 Idéal pour {product.persons} personnes — environ{" "}
            {(product.price / product.persons).toFixed(2).replace(".", ",")} €/pers.
          </p>
        </div>
      </div>

      <div class="p-4 bg-white border-t border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <p class="text-2xl font-bold text-carrefour-blue">
            {product.price.toFixed(2).replace(".", ",")} €
          </p>
          <p class="text-xs text-gray-400">Prix TTC</p>
        </div>
        <button
          onClick={toggleCart}
          class={`px-6 py-3 rounded-xl font-semibold text-sm transition-all ${
            inCart
              ? "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
              : "bg-carrefour-blue text-white hover:bg-carrefour-lightBlue shadow-md"
          }`}
        >
          {inCart ? "Retirer du panier" : "Ajouter au panier"}
        </button>
      </div>
    </motion.div>
  );
}
