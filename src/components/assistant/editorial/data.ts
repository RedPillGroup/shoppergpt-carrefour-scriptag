export interface HeroSlide {
  img: string;
  title: string;
  query: string;
}

export interface EventTile {
  img: string;
  badge: string;
  title: string;
  query: string;
}

export interface ProductTile {
  img: string;
  price: string;
  name: string,
  query: string;
}


export const HERO_SLIDES: HeroSlide[] = [
  {
    img: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1400&q=85&fit=crop",
    title: "Repas de mariage",
    query: "Je prépare un repas pour un mariage ou un PACS",
  },
  {
    img: "https://images.unsplash.com/photo-1555244162-803834f70033?w=1400&q=85&fit=crop",
    title: "Buffet pour la\nfête des voisins",
    query: "Je prépare un buffet pour la fête des voisins",
  },
  {
    img: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?w=1400&q=85&fit=crop&crop=center",
    title: "Fête des mères,\nun repas d'exception",
    query: "Je prépare un repas pour la fête des mères",
  },
];

export const EVENTS_TILES: EventTile[] = [
  {
    img: "https://images.unsplash.com/photo-1529543544282-ea669407fca3?w=700&q=80&fit=crop",
    badge: "C'EST BIENTÔT",
    title: "Le repas de\nfête des mères",
    query: "Aidez-moi pour le repas de fête des mères",
  },
  {
    img: "https://images.unsplash.com/photo-1547592180-85f173990554?w=700&q=80&fit=crop",
    badge: "SUGGESTION DU MOMENT",
    title: "Buffet pour la fête des voisins",
    query: "Montrez-moi vos suggestions de buffet pour la fête des voisins",
  },
];

export const PRODUCT_TILES:  ProductTile[] = [
  {
    img: "https://images.unsplash.com/photo-1671180401158-8d9d060d4966?q=80&w=1141&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    price: "39,99 €",
    name: "Instant Apéro pour 6",
    query: "Montre moi les produits Apéro"
  },
  {
    img: "https://images.unsplash.com/photo-1676300185026-81a05335809f?q=80&w=1226&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    price: "8,99 €",
    name: "8 mini burgers",
    query: "Montre moi les mini burgers disponible"
  }
]