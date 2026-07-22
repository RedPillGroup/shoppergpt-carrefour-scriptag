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
  /** "Build-your-own" plateau (e.g. "choisissez 6 fromages parmi 22") — true only
   * for products with real structured Carrefour composition data (backend's
   * is_composable), never guessed from the name. Drives the "Composer" flow
   * instead of the plain description modal. */
  is_composable?: boolean;
  /** The user's chosen pieces for an is_composable product — code ("0-0", per
   * Carrefour's composition_plateau.groups[].pieces[].code) → qty. Saved on
   * the product itself (not a separate map) so it rides along the normal
   * menu sync to the backend, and is ready to build the real cart payload
   * (POST /cart/add {options:{plateau:{...}}}) once that integration lands —
   * without this, "Valider" would only mark qty=1 with the actual choice lost. */
  plateau_selection?: Record<string, number>;
  /** The plateau's required total piece count (composition_plateau.qty at the
   * time it was composed) — needed alongside plateau_selection to tell a
   * genuinely COMPLETE plateau apart from a partial one (sum(plateau_selection)
   * === plateau_target_qty). Without this, the panel can't gate "Valider mon
   * menu" on composition completeness — it would only know a selection
   * exists, not whether it's the full one. */
  plateau_target_qty?: number;
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

export type MenuStep = 'Apéritifs' | 'Entrées' | 'Plats' | 'Sauces' | 'Fromages' | 'Desserts' | 'Boissons' | 'Pains' | 'Petit Déj' | 'Table & Déco';

export const ALL_MENU_STEPS: MenuStep[] = ['Apéritifs', 'Entrées', 'Plats', 'Sauces', 'Fromages', 'Desserts', 'Boissons', 'Pains', 'Petit Déj', 'Table & Déco'];

export interface EventRequirements {
  event_type?: string;
  event_date?: string;
  guests_adults?: number;
  guests_kids?: number;
  budget?: number;
  /** Confirmed course categories, in order. Only set after the user has validated them. */
  menu_steps?: string[];
  /** LLM-inferred background theme (anniv, apero, bbq, buffet, gouter, mariage, picnic,
   * tv, generique) — picks the matching visu-{theme}1/2.webp pair in MenuBuilderPanel. */
  visual_theme?: string;
}
