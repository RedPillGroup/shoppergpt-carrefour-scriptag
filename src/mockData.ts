import { Product, Store } from "./types";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Plateau saumon fumé",
    price: 29.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
    description: "Saumon fumé d'Écosse sélectionné, accompagné de blinis et crème fraîche. Idéal pour un apéritif festif.",
    category: "Poissons & Fruits de mer",
  },
  {
    id: "2",
    name: "Verrines apéritives",
    price: 14.5,
    persons: 6,
    image: "https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=400&h=300&fit=crop",
    description: "Assortiment de 12 verrines : guacamole, tzatziki, tapenade et houmous. Un incontournable des apéritifs.",
    category: "Apéritifs",
  },
  {
    id: "3",
    name: "Plateau fromages",
    price: 34.9,
    persons: 10,
    image: "https://images.unsplash.com/photo-1559561853-08451507cbe7?w=400&h=300&fit=crop",
    description: "Sélection de 8 fromages affinés : Brie, Comté, Roquefort, Chèvre et bien d'autres. Accompagné de crackers et confiture.",
    category: "Fromages",
  },
  {
    id: "4",
    name: "Buffet cocktail prestige",
    price: 89.0,
    persons: 20,
    image: "https://images.unsplash.com/photo-1530062845289-9109b2c9c868?w=400&h=300&fit=crop",
    description: "Buffet complet pour 20 personnes : mini-sandwichs, verrines, charcuterie et desserts. Tout est inclus.",
    category: "Buffets",
  },
  {
    id: "5",
    name: "Plateau charcuterie",
    price: 24.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    description: "Jambon de Parme, saucisson sec, chorizo et copa. Accompagné de cornichons et moutarde.",
    category: "Charcuterie",
  },
  {
    id: "6",
    name: "Macarons assortis (24 pcs)",
    price: 19.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=400&h=300&fit=crop",
    description: "24 macarons aux saveurs variées : framboise, chocolat, pistache, vanille, citron et caramel.",
    category: "Desserts",
  },
];

export const mockStore: Store = {
  store_id: "42",
  store_name: "Paris République",
};
