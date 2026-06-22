import { create } from "zustand";
import { Message, Product, Store } from "./types";

interface ShopperState {
  sessionId: string | null;
  jwt: string | null;
  store: Store | null;
  messages: Message[];
  products: Product[];
  selectedProduct: Product | null;
  isOpen: boolean;
  isLoading: boolean;
  activeTab: "chat" | "products";
  cartItems: string[];
  hasInteracted: boolean;

  setSessionId: (id: string) => void;
  setJwt: (jwt: string) => void;
  setStore: (store: Store) => void;
  addMessage: (message: Message) => void;
  setProducts: (products: Product[]) => void;
  setSelectedProduct: (product: Product | null) => void;
  toggleOpen: () => void;
  setIsLoading: (v: boolean) => void;
  setActiveTab: (tab: "chat" | "products") => void;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  markInteracted: () => void;
}

export const useShopperStore = create<ShopperState>((set, get) => ({
  sessionId: null,
  jwt: null,
  store: null,
  messages: [],
  products: [],
  selectedProduct: null,
  isOpen: false,
  isLoading: false,
  activeTab: "chat",
  cartItems: [],
  hasInteracted: false,

  setSessionId: (id) => set({ sessionId: id }),
  setJwt: (jwt) => set({ jwt }),
  setStore: (store) => set({ store }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setProducts: (products) => set({ products }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
  toggleOpen: () => {
    const { isOpen, markInteracted } = get();
    if (!isOpen) markInteracted();
    set((state) => ({ isOpen: !state.isOpen }));
  },
  setIsLoading: (v) => set({ isLoading: v }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  addToCart: (productId) =>
    set((state) => ({
      cartItems: state.cartItems.includes(productId)
        ? state.cartItems
        : [...state.cartItems, productId],
    })),
  removeFromCart: (productId) =>
    set((state) => ({
      cartItems: state.cartItems.filter((id) => id !== productId),
    })),
  markInteracted: () => {
    const { hasInteracted } = get();
    if (!hasInteracted) {
      document.cookie = "shoppergpt_interacted=true; path=/; max-age=31536000; SameSite=Lax";
      set({ hasInteracted: true });
    }
  },
}));

