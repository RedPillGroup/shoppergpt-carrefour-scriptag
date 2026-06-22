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
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
