export interface Product {
  id: string;
  name: string;
  price: number;
  persons: number;
  image: string;
  allergens: string[];
  description?: string;
  category?: string;
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
