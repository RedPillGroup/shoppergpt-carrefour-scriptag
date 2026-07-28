import { h } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { motion } from 'framer-motion';
import { Product } from '../../types';

interface Props {
  productsByStep: Record<string, Product[]>;
  quantities: Record<string, number>;
  steps: string[];
  totalGuests: number;
  /** Build-your-own plateaux (is_composable, qty > 0) whose chosen pieces
   * don't yet add up to the required total — see MenuBuilderPanel. Surfaced
   * here as a per-item warning + what disables "Ajouter au panier", instead
   * of blocking entry to this recap in the first place. */
  incompleteComposableProducts?: Product[];
  onClose: () => void;
  onValidate: () => void;
}

/** Format a number as "1 234,56 €" (French locale). */
function fmtEur(value: number): string {
  return value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Focus trap (mirrors ProductDetailModal.tsx) ────────────────────────────────
const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

function useFocusTrap(onEscape: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    el.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscapeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = getFocusable(el);
      if (!focusable.length) { e.preventDefault(); return; }
      const active = e.composedPath()[0] as HTMLElement;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return panelRef;
}

/**
 * ShoppingListModal — read-only recap of everything currently in the menu (qty > 0),
 * grouped by step, with a per-step under-coverage warning (qty×persons < guests) and
 * a running total. Purely derived from props already held by MenuBuilderPanel — no
 * extra fetch. "Ajouter au panier" is a placeholder confirm action (no
 * cart/checkout integration exists yet in this widget); it just closes the modal.
 */
export function ShoppingListModal({
  productsByStep,
  quantities,
  steps,
  totalGuests,
  incompleteComposableProducts = [],
  onClose,
  onValidate,
}: Props) {
  const panelRef = useFocusTrap(onClose);

  const incompleteIds = new Set(incompleteComposableProducts.map(p => p.id));
  const canAddToCart = incompleteComposableProducts.length === 0;
  const addToCartTooltip = canAddToCart
    ? undefined
    : incompleteComposableProducts.length === 1
      ? `Terminez la composition de « ${incompleteComposableProducts[0].name} » avant d'ajouter au panier.`
      : `Terminez la composition de vos ${incompleteComposableProducts.length} plateaux avant d'ajouter au panier.`;

  let totalCost = 0;

  // Boissons never gets the "under guests" check: bottles/cans/packs don't map
  // 1:1 to "one person served" the way a dish does (a 6-pack of soda isn't
  // "for 6 people" in the coverage sense), and the backend itself judges drink
  // quantity by a totally different heuristic (servings per bottle), never by
  // headcount. Applying the dish-coverage math here only produces false alarms.
  const COVERAGE_EXEMPT_STEPS = new Set(['Boissons']);

  // "inférieur" must agree in gender with the step noun (all our steps are plural,
  // so it's really masc. plural "inférieurs" vs fem. plural "inférieures") — e.g.
  // "entrées" is feminine → "Nombre d'entrées inférieures", never "inférieur".
  const FEMININE_PLURAL_STEPS = new Set(['Entrées', 'Boissons', 'Sauces']);

  interface Row {
    step: string;
    items: { id: string; name: string; qty: number; lineTotal: number }[];
    underCovered: boolean;
  }

  const rows: Row[] = steps
    .map((step): Row | null => {
      const products = (productsByStep[step] ?? []).filter(p => (quantities[p.id] ?? 0) > 0);
      if (products.length === 0) return null;

      const items = products.map(p => {
        const qty = quantities[p.id] ?? 0;
        const lineTotal = p.price * qty;
        totalCost += lineTotal;
        return { id: p.id, name: p.name, qty, lineTotal };
      });

      // Only sum products with a KNOWN persons-per-unit — a missing value means we
      // simply don't know its coverage, so it must be excluded from the sum rather
      // than assumed to cover just 1 person (that assumption is what caused false
      // "insufficient" warnings on multi-packs with no persons data, e.g. drinks).
      const knownPersonsProducts = products.filter(p => p.persons != null);
      const hasUnknownPersonsProduct = knownPersonsProducts.length < products.length;
      const knownCoverage = knownPersonsProducts.reduce(
        (sum, p) => sum + (p.persons as number) * (quantities[p.id] ?? 0),
        0
      );
      // If even ONE product in this step has no persons data, its real coverage is
      // unknown — it could already cover everyone on its own. Warning on the KNOWN
      // subset alone would be a guess dressed up as a fact, so skip it entirely
      // rather than risk a false "insuffisant" for a step that's actually fine.
      const underCovered =
        !COVERAGE_EXEMPT_STEPS.has(step) &&
        !hasUnknownPersonsProduct &&
        knownPersonsProducts.length > 0 &&
        totalGuests > 0 &&
        knownCoverage < totalGuests;
      return { step, items, underCovered };
    })
    .filter((s): s is Row => s !== null);

  return (
    // fixed (not absolute): the panel this modal lives in is only the top
    // fraction of the screen on mobile-collapsed — `absolute inset-0` would
    // just cover that fraction (its own positioned ancestor), confining the
    // modal to a tiny box instead of centering over the whole widget/chat.
    // `fixed` escapes to the viewport instead, same size/style otherwise.
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        class="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Votre liste de courses"
        tabIndex={-1}
        class="relative z-10 bg-white shadow-2xl w-full max-w-[400px] max-h-[90%] overflow-hidden flex flex-col outline-none"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Header — no divider under the title, matches the reference design */}
        <div class="relative shrink-0 px-5 pt-5 pb-2">
          <h2 class="m-0 font-['Satisfy'] font-normal text-[#C7B287] text-2xl leading-none">
            Votre liste de courses
          </h2>
          <button
            onClick={onClose}
            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-[#C7B287] shadow flex items-center justify-center text-white hover:bg-[#B8A176] transition-colors border-0"
            aria-label="Fermer"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div class="flex-1 overflow-y-auto min-h-0 px-5 pt-2 pb-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]">
          {rows.length === 0 ? (
            <p class="text-center text-[12px] text-[#9A8C78] py-6 m-0">
              Votre liste est vide pour l'instant.
            </p>
          ) : (
            <div class="flex flex-col gap-4">
              {rows.map(({ step, items, underCovered }) => (
                <div key={step}>
                  <h3 class="m-0 mb-2 pb-1 border-b-[2px] border-[#878787] border-solid text-[11px] font-bold uppercase tracking-wide text-[#878787]">
                    {step}
                  </h3>
                  {underCovered && (
                    <div class="flex items-start gap-1.5 mb-2 text-[#D14343]">
                      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" class="shrink-0 mt-[1px]">
                        <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.4" />
                        <path d="M10 6v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                        <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
                      </svg>
                      <span class="text-[11px] leading-snug">
                        Nombre {step.toLowerCase().startsWith('a') || step.toLowerCase().startsWith('e')
                          ? "d'"
                          : 'de '}
                        {step.toLowerCase()} {FEMININE_PLURAL_STEPS.has(step) ? 'inférieures' : 'inférieurs'} au nombre de convives
                      </span>
                    </div>
                  )}
                  <ul class="m-0 p-0 list-none flex flex-col gap-2">
                    {items.map(item => (
                      <li key={item.id} class="flex flex-col gap-1">
                        <div class="flex items-center gap-3">
                          <span class="text-[12px] font-semibold text-[#878787] shrink-0">
                            {item.qty} X
                          </span>
                          <span class="flex-1 text-[12px] text-[#878787] leading-snug">
                            {item.name}
                          </span>
                          <span class="text-[12px] font-semibold text-[#878787] shrink-0 tabular-nums">
                            {fmtEur(item.lineTotal)}
                          </span>
                        </div>
                        {incompleteIds.has(item.id) && (
                          <div class="flex items-start gap-1.5 text-[#D14343]">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" class="shrink-0 mt-[1px]">
                              <circle cx="10" cy="10" r="8.5" stroke="currentColor" stroke-width="1.4" />
                              <path d="M10 6v5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
                              <circle cx="10" cy="13.6" r="0.9" fill="currentColor" />
                            </svg>
                            <span class="text-[11px] leading-snug">
                              Plateau pas encore composé — ouvrez-le pour choisir vos produits
                            </span>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer — total + confirm. Smaller on mobile (less padding, smaller
            price/button) — the md: sizes below restore the original desktop scale. */}
        <div class="shrink-0 bg-[#C7B287] px-4 py-2.5 md:px-5 md:py-4 flex flex-col items-center gap-1.5 md:gap-3">
          <div class="w-full flex items-center justify-between gap-2">
            <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-[#F7F2E6]">
              Coût total
            </span>
            <span class="text-[17px] md:text-[22px] font-bold text-white tabular-nums">
              {fmtEur(totalCost)}
            </span>
          </div>
          {/* Empty list uses the native `disabled` (nothing to explain there).
              An incomplete plateau instead guards the click handler +
              aria-disabled + dimmed styling — same reasoning as the tooltip
              pattern elsewhere: native `disabled` kills hover in Chrome,
              which would kill the tooltip explaining WHY right along with it. */}
          <span class="relative group">
            <button
              onClick={() => canAddToCart && onValidate()}
              disabled={rows.length === 0}
              aria-disabled={!canAddToCart}
              class={`rounded-[30px] px-4 py-1 border border-[#AAAAAA] text-[#8D7A4E] text-[10px] md:text-[11px] font-bold uppercase tracking-wide transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${
                canAddToCart ? 'bg-white cursor-pointer hover:opacity-90' : 'bg-[#F0EDE8] cursor-not-allowed opacity-70'
              }`}
            >
              Ajouter au panier
            </button>
            {addToCartTooltip && (
              <span class="pointer-events-none absolute bottom-full right-0 mb-2 w-56 rounded-lg bg-[#1A1A2E] px-3 py-2 text-[11px] leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-30">
                {addToCartTooltip}
                <span class="absolute top-full right-4 -mt-1 h-2 w-2 rotate-45 bg-[#1A1A2E]" />
              </span>
            )}
          </span>
        </div>
      </motion.div>
    </div>
  );
}
