import { h } from "preact";
import { AnimatePresence } from "framer-motion";
import { useShopperStore } from "../store";
import { ProductCard } from "./ProductCard";
import { ProductDetail } from "./ProductDetail";
import { mockProducts } from "../mockData";

export function ProductPanel() {
  const { products, selectedProduct, setSelectedProduct, cartItems } = useShopperStore();

  const displayedProducts = products.length > 0 ? products : mockProducts;

  if (selectedProduct) {
    return (
      <AnimatePresence mode="wait">
        <ProductDetail
          key={selectedProduct.id}
          product={selectedProduct}
          onBack={() => setSelectedProduct(null)}
        />
      </AnimatePresence>
    );
  }

  return (
    <div class="flex flex-col h-full">
      <div class="bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
        <div>
          <h2 class="font-semibold text-sm text-gray-800">Suggestions</h2>
          <p class="text-xs text-gray-400">{displayedProducts.length} produits</p>
        </div>
        {cartItems.length > 0 && (
          <div class="bg-carrefour-blue text-white text-xs px-2.5 py-1 rounded-full font-medium">
            {cartItems.length} au panier
          </div>
        )}
      </div>

      <div class="flex-1 overflow-y-auto p-3 bg-carrefour-bg">
        <div class="grid grid-cols-1 gap-3">
          {displayedProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={() => setSelectedProduct(product)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
