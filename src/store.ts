import { create } from "zustand";
import { Message, MenuStep, Product, Store } from "./types";
import type { ConversationSummary } from "./api/conversations";

interface ShopperState {
  sessionId: string | null;
  /** Active chat thread (conv_…). Cleared on page load / refresh — not persisted. */
  conversationId: string | null;
  conversations: ConversationSummary[];
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
  /** One-shot "scroll the panel to this step" signal, set when a server sync
   * changes exactly one step (see AssistantExperience's applyPanelState diff).
   * The nonce makes consecutive changes to the SAME step re-fire the panel's
   * effect — without it, two successive edits of « Plats » would only scroll
   * the first time. */
  stepScrollRequest: { step: MenuStep; nonce: number } | null;

  setSessionId: (id: string) => void;
  setConversationId: (id: string | null) => void;
  setConversations: (list: ConversationSummary[]) => void;
  setJwt: (jwt: string) => void;
  setStore: (store: Store) => void;
  addMessage: (message: Message) => void;
  setMessages: (messages: Message[]) => void;
  setProducts: (products: Product[]) => void;
  setSelectedProduct: (product: Product | null) => void;
  toggleOpen: () => void;
  setIsLoading: (v: boolean) => void;
  setActiveTab: (tab: "chat" | "products") => void;
  addToCart: (productId: string) => void;
  removeFromCart: (productId: string) => void;
  markInteracted: () => void;
  requestStepScroll: (step: MenuStep) => void;
}

export const useShopperStore = create<ShopperState>((set, get) => ({
  sessionId: null,
  conversationId: null,
  conversations: [],
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
  stepScrollRequest: null,

  setSessionId: (id) => set({ sessionId: id }),
  setConversationId: (id) => set({ conversationId: id }),
  setConversations: (list) => set({ conversations: list }),
  setJwt: (jwt) => set({ jwt }),
  setStore: (store) => set({ store }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
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
  requestStepScroll: (step) =>
    set((state) => ({
      stepScrollRequest: { step, nonce: (state.stepScrollRequest?.nonce ?? 0) + 1 }
    })),
  markInteracted: () => {
    const { hasInteracted } = get();
    if (!hasInteracted) {
      document.cookie = "shoppergpt_interacted=true; path=/; max-age=31536000; SameSite=Lax";
      set({ hasInteracted: true });
    }
  },
}));
