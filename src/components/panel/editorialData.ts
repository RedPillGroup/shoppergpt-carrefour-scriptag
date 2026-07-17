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
    img: `${EDITORIAL_BASE_URL}/mariage-1-v7.webp`,
    title: "Repas de mariage,\nou pacs",
    query: "Je prépare un repas pour un mariage ou un PACS",
  },
  {
    img: `${EDITORIAL_BASE_URL}/apero-1-v7.webp`,
    title: "Pots de\ndépart",
    query: "Je prépare un pot de départ",
  },
  {
    img: `${EDITORIAL_BASE_URL}/buffet-1-v10.webp`,
    title: "Apéro\ndînatoire",
    query: "Je prépare un apéro dînatoire",
  },
  {
    img: `${EDITORIAL_BASE_URL}/bapteme-1-v7.webp`,
    title: "Repas de\nbaptême",
    query: "Je prépare un repas pour un baptême",
  },
  {
    img: `${EDITORIAL_BASE_URL}/gouter-1-v7.webp`,
    title: "Goûters\nd'enfants",
    query: "Je prépare un goûter d'anniversaire pour enfant",
  },
  {
    img: `${EDITORIAL_BASE_URL}/anniv-1-v8.webp`,
    title: "Anniversaires\nà fêter",
    query: "Je prépare un anniversaire",
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
