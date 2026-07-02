export interface Product {
  id: string;
  name: string;
  price: number;
  /** How many people one unit covers — null when Carrefour doesn't provide the data. */
  persons: number | null;
  image: string;
  description?: string;
  category?: string;
  menu_step?: string;
  /** Pre-computed quantity suggestion from the backend (ceil(guests / persons)). */
  recommended_quantity?: number;
  /** Carrefour unit-of-sale label, e.g. "La part (mini. 6)", "Le plateau pour 8/10 pers". */
  expression_pvc?: string | null;
  /** Weight + conditioning unit, e.g. "330 mL", "750 mL", "1500 g". */
  volume?: string | null;
  /** Number of individual pieces in one sellable unit, e.g. 6 for a pack of 6 cans. */
  nb_pieces?: number | null;
}

export interface StepSuggestionItem {
  step: string;
}

export interface StoreOptionItem {
  store_id: string;
  name: string;
  address: string;
  distance_km: number;
  modes: string[];
}

export interface ModeOptions {
  name: string;
  modes: string[];
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Present on the assistant message that just ran recommend_menu_steps — renders
   * an interactive on/off step-selection card instead of/alongside the plain text. */
  stepSuggestion?: StepSuggestionItem[];
  /** Present on the assistant message that just ran find_stores — renders an
   * interactive store-selection card. Clicking a store sends it as a normal chat
   * message (quick-reply style), unlike the step card there's no deferred sync. */
  storeOptions?: StoreOptionItem[];
  /** Present on the assistant message where select_store returned needs_mode —
   * renders an interactive mode-selection card (retrait/drive/livraison chips). */
  modeOptions?: ModeOptions;
  /** True on the assistant message where a store selection was FINALIZED this turn
   * (select_store ran and did NOT return needs_mode). Used to freeze the store/mode
   * card that led here — deliberately per-message rather than reading the global
   * currently-selected store, so a LATER re-ask (new find_stores card) isn't born
   * frozen just because an earlier, unrelated selection was already resolved. */
  storeResolved?: boolean;
}

export interface Store {
  store_id: string;
  store_name: string;
  mode?: string;
}

export interface SessionEvent {
  session_id: string;
}

export interface PageContextEvent {
  store_id: string;
  store_name: string;
}

export interface CartUpdatedEvent {
  success: boolean;
  product_id: string;
  action: "add" | "remove";
}

export interface ChangeShopEvent {
  store_id: string;
}

export type MenuStep = 'Apéritifs' | 'Entrées' | 'Plats' | 'Plateaux' | 'Fromages' | 'Desserts' | 'Boissons' | 'Pains' | 'Petit Déj' | 'Table & Déco' | 'Fleurs' | 'À côté';

export const ALL_MENU_STEPS: MenuStep[] = ['Apéritifs', 'Entrées', 'Plats', 'Plateaux', 'Fromages', 'Desserts', 'Boissons', 'Pains', 'Petit Déj', 'Table & Déco', 'Fleurs', 'À côté'];

export interface EventRequirements {
  event_type?: string;
  event_date?: string;
  guests_adults?: number;
  guests_kids?: number;
  budget?: number;
  /** Confirmed course categories, in order. Only set after the user has validated them. */
  menu_steps?: string[];
}
