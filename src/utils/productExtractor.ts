import { Product } from "../types";

/**
 * Build a Product from a raw backend object.
 * Handles field aliases from GET /menu (sku → id, price_eur → price, etc.).
 */
export function buildProduct(p: Record<string, unknown>): Product | null {
  const id = String(p.id ?? p.sku ?? p.product_id ?? p.ean ?? "").trim();
  const name = String(p.name ?? p.title ?? p.libelle ?? "").trim();
  if (!id || !name) return null;

  const rawPersons = p.persons ?? p.nb_personnes ?? p.servings;
  return {
    id,
    name,
    price: Number(p.price ?? p.price_eur ?? p.prix ?? p.price_ttc ?? 0),
    persons: rawPersons != null ? Number(rawPersons) : null,
    image: String(p.image ?? p.image_url ?? p.photo ?? ""),
    description: String(p.description ?? ""),
    category: String(p.category ?? p.categorie ?? p.type ?? "Traiteur"),
    menu_step: p.menu_step ? String(p.menu_step) : undefined,
    recommended_quantity:
      p.recommended_quantity != null ? Number(p.recommended_quantity) : undefined,
  };
}
