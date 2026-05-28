import { Product } from "../types";

/**
 * Build a Product from a raw backend object.
 * Handles the field aliases used by the Carrefour Traiteur mock catalogue
 * (sku → id, price_eur → price, image_url → image).
 */
function buildProduct(p: Record<string, unknown>): Product | null {
  const id = String(p.id ?? p.sku ?? p.product_id ?? p.ean ?? "").trim();
  const name = String(p.name ?? p.title ?? p.libelle ?? "").trim();
  if (!id || !name) return null;

  return {
    id,
    name,
    price: Number(p.price ?? p.price_eur ?? p.prix ?? p.price_ttc ?? 0),
    persons: Number(p.persons ?? p.nb_personnes ?? p.servings ?? 1),
    image: String(p.image ?? p.image_url ?? p.photo ?? ""),
    allergens: Array.isArray(p.allergens) ? (p.allergens as string[]) : [],
    description: String(p.description ?? ""),
    category: String(p.category ?? p.categorie ?? p.type ?? "Traiteur"),
    menu_step: p.menu_step ? String(p.menu_step) : undefined,
  };
}

/**
 * Extract products from the raw tool_results array returned by the SSE stream.
 *
 * The Carrefour Traiteur backend flattens individual product dicts directly into
 * tool_results (via `tool_results.extend(raw_data)`), so each element may itself
 * be a product object rather than a container.  We detect both shapes:
 *
 *   1. Flat product  — the element has `sku`/`id` + `name` at the top level.
 *   2. Wrapped array — the element has products nested under a known key
 *                      (products, items, results, data, filtered_data).
 *
 * We process ALL elements (no early break) so Phase 3 multi-step searches
 * (one call per course) are fully captured.
 */
export function extractProducts(toolResults: unknown[]): Product[] {
  const products: Product[] = [];
  const seen = new Set<string>();

  const push = (p: Record<string, unknown>) => {
    const product = buildProduct(p);
    if (product && !seen.has(product.id)) {
      seen.add(product.id);
      products.push(product);
    }
  };

  for (const result of toolResults) {
    if (!result || typeof result !== "object") continue;
    const r = result as Record<string, unknown>;

    // Shape 1: the element is itself a product (has name + some id field)
    const hasDirectId = r.id || r.sku || r.product_id || r.ean;
    const hasDirectName = r.name || r.title || r.libelle;
    if (hasDirectId && hasDirectName) {
      push(r);
      continue;
    }

    // Shape 2: products are nested under a known container key
    const containers = [
      r.filtered_data,
      r.products,
      r.items,
      r.results,
      r.data,
    ];
    for (const candidate of containers) {
      if (!Array.isArray(candidate)) continue;
      for (const item of candidate) {
        if (item && typeof item === "object") {
          push(item as Record<string, unknown>);
        }
      }
      break; // found a container — stop looking at other keys for this element
    }
  }

  return products;
}
