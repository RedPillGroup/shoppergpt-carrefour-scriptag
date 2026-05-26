import { Product, Message, Store } from "./types";

export const mockProducts: Product[] = [
  {
    id: "1",
    name: "Plateau saumon fumé",
    price: 29.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=300&fit=crop",
    allergens: ["poisson", "gluten"],
    description: "Saumon fumé d'Écosse sélectionné, accompagné de blinis et crème fraîche. Idéal pour un apéritif festif.",
    category: "Poissons & Fruits de mer",
  },
  {
    id: "2",
    name: "Verrines apéritives",
    price: 14.5,
    persons: 6,
    image: "https://images.unsplash.com/photo-1541614101331-1a5a3a194e92?w=400&h=300&fit=crop",
    allergens: [],
    description: "Assortiment de 12 verrines : guacamole, tzatziki, tapenade et houmous. Un incontournable des apéritifs.",
    category: "Apéritifs",
  },
  {
    id: "3",
    name: "Plateau fromages",
    price: 34.9,
    persons: 10,
    image: "https://images.unsplash.com/photo-1559561853-08451507cbe7?w=400&h=300&fit=crop",
    allergens: ["lait"],
    description: "Sélection de 8 fromages affinés : Brie, Comté, Roquefort, Chèvre et bien d'autres. Accompagné de crackers et confiture.",
    category: "Fromages",
  },
  {
    id: "4",
    name: "Buffet cocktail prestige",
    price: 89.0,
    persons: 20,
    image: "https://images.unsplash.com/photo-1530062845289-9109b2c9c868?w=400&h=300&fit=crop",
    allergens: ["gluten", "lait", "œuf"],
    description: "Buffet complet pour 20 personnes : mini-sandwichs, verrines, charcuterie et desserts. Tout est inclus.",
    category: "Buffets",
  },
  {
    id: "5",
    name: "Plateau charcuterie",
    price: 24.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop",
    allergens: ["gluten"],
    description: "Jambon de Parme, saucisson sec, chorizo et copa. Accompagné de cornichons et moutarde.",
    category: "Charcuterie",
  },
  {
    id: "6",
    name: "Macarons assortis (24 pcs)",
    price: 19.9,
    persons: 8,
    image: "https://images.unsplash.com/photo-1569864358642-9d1684040f43?w=400&h=300&fit=crop",
    allergens: ["lait", "œuf", "fruits à coque"],
    description: "24 macarons aux saveurs variées : framboise, chocolat, pistache, vanille, citron et caramel.",
    category: "Desserts",
  },
];

export const mockMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: "Bonjour ! Je suis votre assistant **Carrefour Traiteur**. Je suis là pour vous aider à composer le menu parfait pour votre événement.\n\nQuel type d'occasion préparez-vous ?",
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: "2",
    role: "user",
    content: "J'organise un anniversaire pour 10 personnes",
    timestamp: new Date(Date.now() - 90000),
  },
  {
    id: "3",
    role: "assistant",
    content: "Super ! Un anniversaire pour 10 personnes, quelle belle fête en perspective 🎉\n\nPour vous composer le meilleur menu, j'aurais quelques questions :\n\n- **Quel budget** avez-vous en tête ?\n- **Quel moment** de la journée ? (déjeuner, dîner, apéritif)\n- Des **allergies ou régimes** particuliers à respecter ?\n\nEn attendant, voici quelques suggestions populaires pour ce type d'événement 👉",
    timestamp: new Date(Date.now() - 60000),
  },
];

export const mockStore: Store = {
  store_id: "42",
  store_name: "Paris République",
};
