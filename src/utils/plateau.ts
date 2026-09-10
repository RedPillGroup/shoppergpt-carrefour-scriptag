import { Product } from '../types';

/**
 * Per-plateau composition helpers for build-your-own products (`is_composable`).
 *
 * Carrefour prepares ONE physical plateau per ordered unit, and the real cart
 * keys its lines by (sku, options) — so 5 plateaux are 5 compositions the user
 * can make different, not one selection repeated 5 times. Everything here
 * therefore reasons in terms of "the i-th plateau", and the same rules have to
 * hold in three places: the composition modal, the panel's "Valider mon menu"
 * gate, and the backend before it builds the cart payload. Keeping them in one
 * module is what stops those three from drifting apart.
 */

/** An empty selection means "this plateau hasn't been composed yet". */
export type PlateauSelection = Record<string, number>;

/** How many pieces a selection currently holds. */
export function selectionSize(selection: PlateauSelection | undefined): number {
  if (!selection) return 0;
  return Object.values(selection).reduce((sum, q) => sum + q, 0);
}

/** True when this one plateau holds exactly the pieces it takes. */
export function isPlateauComplete(
  selection: PlateauSelection | undefined,
  targetQty: number
): boolean {
  return targetQty > 0 && selectionSize(selection) === targetQty;
}

/**
 * The working list of compositions for `unitCount` plateaux, seeded from what
 * was saved before.
 *
 * Always exactly `unitCount` long, so a plateau can be addressed by index
 * without guarding for holes. Raising the quantity appends blank plateaux to
 * compose; lowering it keeps the extra compositions in the tail rather than
 * discarding them, so going 5 → 3 → 5 doesn't throw away work the user did.
 */
export function resizeSelections(
  saved: PlateauSelection[] | undefined,
  unitCount: number
): PlateauSelection[] {
  const source = saved ?? [];
  const next: PlateauSelection[] = [];
  for (let i = 0; i < unitCount; i += 1) next.push({ ...(source[i] ?? {}) });
  return next;
}

/**
 * True when EVERY ordered unit of this product is fully composed.
 *
 * `plateau_target_qty` is only written once the modal has been validated at
 * least once, so `undefined` means "never composed" — itself incomplete, not
 * a pass.
 */
export function isProductFullyComposed(product: Product, qty: number): boolean {
  if (!product.is_composable) return true;
  const target = product.plateau_target_qty;
  if (qty <= 0 || !target) return false;
  const selections = product.plateau_selections ?? [];
  if (selections.length < qty) return false;
  for (let i = 0; i < qty; i += 1) {
    if (!isPlateauComplete(selections[i], target)) return false;
  }
  return true;
}

/** How many of the `qty` plateaux still need composing — for progress copy. */
export function remainingPlateauCount(product: Product, qty: number): number {
  const target = product.plateau_target_qty;
  if (qty <= 0) return 0;
  if (!target) return qty;
  const selections = product.plateau_selections ?? [];
  let remaining = 0;
  for (let i = 0; i < qty; i += 1) {
    if (!isPlateauComplete(selections[i], target)) remaining += 1;
  }
  return remaining;
}
