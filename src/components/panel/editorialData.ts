// Hosted on the same public GCS bucket as MenuBuilderPanel's backgrounds rather than
// bundled — these are full-size editorial photos; inlining them as base64 would have
// bloated the widget's single-file bundle by ~600KB downloaded on every page load.
const EDITORIAL_BASE_URL = 'https://storage.googleapis.com/carrefour-shoppergpt-backgrounds';
const grillades = `${EDITORIAL_BASE_URL}/editorial-grillades-v1.webp`;
const plateauSupporters = `${EDITORIAL_BASE_URL}/editorial-plateau-supporters-v1.webp`;

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
    img: grillades,
    badge: "SUGGESTION DU MOMENT",
    title: "A vos grillades\nprofitez",
    query: "Je prépare un barbecue, montrez-moi vos suggestions de grillades",
  },
  {
    img: plateauSupporters,
    badge: "100% CONVIVIAL",
    title: "Le plateau des\nsupporters",
    query: "Montrez-moi vos suggestions de plateaux apéro pour regarder un match",
  },
];
