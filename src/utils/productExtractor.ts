import { Product } from "../types";
import { MetaPayload } from "../hooks/useChatAnswer";

/**
 * Extracts Product objects from SSE meta tool_results.
 * The API may nest the array under different keys; this function handles
 * the common shapes without requiring an exact schema contract.
 */
export function extractProductsFromMeta(meta: MetaPayload): Product[] {
  const toolResults = meta.tool_results ?? [];
  return extractProducts(toolResults);
}

export function extractProducts(toolResults: unknown[]): Product[] {
  const products: Product[] = [];

  for (const result of toolResults) {
    if (!result || typeof result !== "object") continue;
    const r = result as Record<string, unknown>;

    // Products may live under various keys
    const candidates = [r.products, r.items, r.results, r.data, r];
    for (const candidate of candidates) {
      const arr = Array.isArray(candidate) ? candidate : null;
      if (!arr) continue;

      for (const item of arr) {
        if (!item || typeof item !== "object") continue;
        const p = item as Record<string, unknown>;

        const id = String(p.id ?? p.product_id ?? p.ean ?? "");
        const name = String(p.name ?? p.title ?? p.libelle ?? "");
        if (!id || !name) continue;

        products.push({
          id,
          name,
          price: Number(p.price ?? p.prix ?? p.price_ttc ?? 0),
          persons: Number(p.persons ?? p.nb_personnes ?? p.servings ?? 1),
          image: String(p.image ?? p.image_url ?? p.photo ?? ""),
          allergens: Array.isArray(p.allergens) ? (p.allergens as string[]) : [],
          description: String(p.description ?? ""),
          category: String(p.category ?? p.categorie ?? p.type ?? "Traiteur"),
        });
      }
      if (products.length > 0) break;
    }
    if (products.length > 0) break;
  }

  return products;
}
