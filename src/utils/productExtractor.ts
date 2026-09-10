import { Product } from '../types';

/**
 * Read the per-plateau compositions off a raw backend product.
 *
 * Also accepts the single-selection `plateau_selection` this replaced, wrapping
 * it as the first plateau: a session that had composed a plateau before the
 * per-unit model landed would otherwise come back reading "not composed" and
 * silently lose that work on the next sync.
 */
function readPlateauSelections(
  p: Record<string, unknown>
): Record<string, number>[] | undefined {
  if (Array.isArray(p.plateau_selections)) {
    return p.plateau_selections.filter(
      (sel): sel is Record<string, number> => !!sel && typeof sel === 'object'
    );
  }
  if (p.plateau_selection && typeof p.plateau_selection === 'object') {
    return [p.plateau_selection as Record<string, number>];
  }
  return undefined;
}

/**
 * Build a Product from a raw backend object.
 * Handles field aliases from GET /menu (sku → id, price_eur → price, etc.).
 */
export function buildProduct(p: Record<string, unknown>): Product | null {
  const id = String(p.id ?? p.sku ?? p.product_id ?? p.ean ?? '').trim();
  const name = String(p.name ?? p.title ?? p.libelle ?? '').trim();
  if (!id || !name) return null;

  const rawPersons = p.persons ?? p.nb_personnes ?? p.servings;
  return {
    id,
    name,
    price: Number(p.price ?? p.price_eur ?? p.prix ?? p.price_ttc ?? 0),
    persons: rawPersons != null ? Number(rawPersons) : null,
    image: String(p.image ?? p.image_url ?? p.photo ?? ''),
    description: String(p.description ?? ''),
    category: String(p.category ?? p.categorie ?? p.type ?? 'Traiteur'),
    menu_step: p.menu_step ? String(p.menu_step) : undefined,
    recommended_quantity:
      p.recommended_quantity != null ? Number(p.recommended_quantity) : undefined,
    expression_pvc: p.expression_pvc != null ? String(p.expression_pvc) : null,
    volume: p.volume != null ? String(p.volume) : null,
    nb_pieces: p.nb_pieces != null ? Number(p.nb_pieces) : null,
    is_composable: Boolean(p.is_composable),
    plateau_selections: readPlateauSelections(p),
    plateau_target_qty: p.plateau_target_qty != null ? Number(p.plateau_target_qty) : undefined
  };
}
