import { h } from "preact";
import { motion } from "framer-motion";
import { Product } from "../types";
import { useShopperStore } from "../store";
import { dispatchCartUpdated } from "../events";

interface Props {
  product: Product;
  onSelect: () => void;
}

export function ProductCard({ product, onSelect }: Props) {
  const { cartItems, addToCart, sessionId, store } = useShopperStore();
  const inCart = cartItems.includes(product.id);

  const handleAddToCart = (e: MouseEvent) => {
    e.stopPropagation();

    // Mock cart API — replace with real fetch when backend is ready
    addToCart(product.id);
    dispatchCartUpdated({
      success: true,
      product_id: product.id,
      action: "add",
    });

    console.log("[ShopperGPT] Cart add:", {
      product_id: product.id,
      store_id: store?.store_id,
      session_id: sessionId,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      onClick={onSelect}
      class="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div class="relative">
        <img
          src={product.image}
          alt={product.name}
          class="w-full h-36 object-cover"
          loading="lazy"
        />
        {inCart && (
          <div class="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium">
            ✓ Ajouté
          </div>
        )}
        <div class="absolute bottom-2 left-2 bg-carrefour-blue text-white text-xs px-2 py-0.5 rounded-full">
          {product.category}
        </div>
      </div>
      <div class="p-3">
        <h3 class="font-semibold text-sm text-gray-800 leading-tight mb-1">{product.name}</h3>
        <p class="text-xs text-gray-500 mb-2">Pour {product.persons} personnes</p>
        {product.allergens.length > 0 && (
          <div class="flex flex-wrap gap-1 mb-2">
            {product.allergens.map((a) => (
              <span key={a} class="text-xs bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                {a}
              </span>
            ))}
          </div>
        )}
        <div class="flex items-center justify-between mt-2">
          <span class="font-bold text-carrefour-blue text-base">
            {product.price.toFixed(2).replace(".", ",")} €
          </span>
          <button
            onClick={handleAddToCart}
            class={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
              inCart
                ? "bg-green-100 text-green-700 cursor-default"
                : "bg-carrefour-blue text-white hover:bg-carrefour-lightBlue"
            }`}
          >
            {inCart ? "Ajouté ✓" : "Ajouter"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
