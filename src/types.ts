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
  /** The user's chosen pieces for an is_composable product — ONE selection per
   * ordered unit, each mapping a piece code ("0-0", per Carrefour's
   * composition_plateau.groups[].pieces[].code) → qty. Index i is the i-th
   * plateau, and the backend turns each entry into its own cart line.
   *
   * A LIST because Carrefour prepares one physical plateau per unit: ordering
   * 5 means 5 separate preparations, each composable differently. An empty
   * entry is a plateau not composed yet — kept as a placeholder so partial
   * progress survives closing the modal and resumes in place.
   *
   * Saved on the product itself (not a separate map) so it rides along the
   * normal menu sync to the backend, which builds the real cart payload from
   * it (POST /cart/add, one {options:{plateau}} line per plateau). */
  plateau_selections?: Record<string, number>[];
  /** How many pieces ONE plateau holds (composition_plateau.qty at the time it
   * was composed) — needed alongside plateau_selections to tell a genuinely
   * COMPLETE order apart from a partial one: there must be one selection per
   * unit AND each must sum to this. Without it the panel can't gate "Valider
   * mon menu" on completeness — it would only know selections exist, not
   * whether they're all finished. */
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
  role: 'user' | 'assistant';
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
  product_id?: string;
  action?: 'add' | 'remove' | 'confirm';
  /** Rendered `.header-minicart` HTML from Carrefour's /cart/add — present on the
   * "confirm" event (real cart push). The host injects it, no extra request. */
  minicart_html?: string;
}

export interface ChangeShopEvent {
  store_id: string;
}

export type MenuStep =
  | 'Apéritifs'
  | 'Entrées'
  | 'Plats'
  | 'Sauces'
  | 'Fromages'
  | 'Desserts'
  | 'Boissons'
  | 'Pains'
  | 'Petit Déj'
  | 'Table & Déco';

export const ALL_MENU_STEPS: MenuStep[] = [
  'Apéritifs',
  'Entrées',
  'Plats',
  'Sauces',
  'Fromages',
  'Desserts',
  'Boissons',
  'Pains',
  'Petit Déj',
  'Table & Déco'
];

export interface EventRequirements {
  event_name?: string;
  date?: string;
  guests_adults?: number;
  guests_kids?: number;
  budget?: number;
  /** Confirmed course categories, in order. Only set after the user has validated them. */
  menu_steps?: string[];
  /** LLM-inferred background theme (anniv, apero, bbq, buffet, gouter, mariage, picnic,
   * tv, generique) — picks the matching visu-{event_theme}1/2.webp pair in MenuBuilderPanel. */
  event_theme?: string;
}
