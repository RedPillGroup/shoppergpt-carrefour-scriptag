import { h } from "preact";
import { motion, AnimatePresence } from "framer-motion";
import { useShopperStore } from "../store";
import { ChatPanel } from "./ChatPanel";
import { ProductPanel } from "./ProductPanel";

function FAB() {
  const { toggleOpen, cartItems } = useShopperStore();
  return (
    <motion.button
      onClick={toggleOpen}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      class="w-14 h-14 bg-carrefour-blue text-white rounded-full shadow-xl flex items-center justify-center relative"
      title="Ouvrir l'assistant Carrefour Traiteur"
    >
      <svg viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
      </svg>
      {cartItems.length > 0 && (
        <span class="absolute -top-1 -right-1 w-5 h-5 bg-carrefour-red text-white text-xs rounded-full flex items-center justify-center font-bold">
          {cartItems.length}
        </span>
      )}
    </motion.button>
  );
}

function MobileTabs() {
  const { activeTab, setActiveTab } = useShopperStore();
  return (
    <div class="flex border-b border-gray-200 bg-white flex-shrink-0 md:hidden">
      {(["chat", "products"] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          class={`flex-1 py-3 text-sm font-medium transition-colors ${
            activeTab === tab
              ? "text-carrefour-blue border-b-2 border-carrefour-blue"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab === "chat" ? "💬 Conversation" : "🛍 Produits"}
        </button>
      ))}
    </div>
  );
}

export function Widget() {
  const { isOpen, toggleOpen, activeTab } = useShopperStore();

  return (
    <div class="fixed bottom-6 right-6 z-[9999] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            class="mb-4 bg-carrefour-bg rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
            style={{
              width: "min(760px, calc(100vw - 48px))",
              height: "min(600px, calc(100vh - 120px))",
            }}
          >
            {/* Close button */}
            <button
              onClick={toggleOpen}
              class="absolute top-3 right-3 z-10 w-7 h-7 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 hover:bg-white shadow transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            {/* Mobile tabs */}
            <MobileTabs />

            {/* Dual panel layout */}
            <div class="flex h-full" style={{ height: "calc(100% - 0px)" }}>
              {/* Chat panel — always visible on desktop, conditional on mobile */}
              <div
                class={`flex-1 flex flex-col min-w-0 border-r border-gray-200 ${
                  activeTab !== "chat" ? "hidden md:flex" : "flex"
                }`}
                style={{ minWidth: 0 }}
              >
                <ChatPanel />
              </div>

              {/* Product panel — right side desktop, tab on mobile */}
              <div
                class={`flex-shrink-0 flex flex-col overflow-hidden ${
                  activeTab !== "products" ? "hidden md:flex" : "flex"
                }`}
                style={{ width: "min(300px, 40%)" }}
              >
                <ProductPanel />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div class="flex justify-end">
        <FAB />
      </div>
    </div>
  );
}
