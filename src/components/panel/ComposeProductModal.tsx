import { h } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { motion } from 'framer-motion';
import { getApiUrl } from '../../api/config';
import { sessionHeaders } from '../../api/menu';
import { useShopperStore } from '../../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import {
  PlateauSelection,
  isPlateauComplete,
  resizeSelections,
  selectionSize
} from '../../utils/plateau';

interface CompositionPiece {
  code: string;
  name: string;
  conditionnement?: string | null;
  image_url?: string | null;
  extra_price?: number | null;
  /** Per-piece composition/allergen text (HTML) — only some pieces have it in
   * Carrefour's data. The info icon is only rendered when this is present;
   * no icon promising info that doesn't exist. */
  ingredients?: string | null;
}

interface CompositionGroup {
  name: string;
  pieces: CompositionPiece[];
}

interface CompositionPlateau {
  title: string;
  qty: number | null;
  groups: CompositionGroup[];
}

interface ProductDetail {
  id: string;
  name: string;
  price_eur?: number | null;
  persons?: number | null;
  image_url?: string | null;
  expression_pvc?: string | null;
  bac_type?: string | null;
  delai_prepa?: number | null;
  is_composable?: boolean;
  composition_plateau?: CompositionPlateau | null;
}

interface Props {
  productId: string;
  onClose: () => void;
  /** The product's previously-saved compositions (Product.plateau_selections),
   * if any — re-opening this modal must start from what the user picked last
   * time, plateau by plateau, not blank. */
  initialSelections?: Record<string, number>[];
  /** How many plateaux are ordered (the product's qty in the menu, at least 1)
   * — each one is composed separately here, because Carrefour prepares one
   * physical plateau per unit. */
  unitCount: number;
  /** Called with one selection per plateau AND the pieces a single plateau
   * takes (composition_plateau.qty). The panel needs the target alongside the
   * selections to tell a genuinely complete order apart from a partially
   * composed one (see MenuBuilderPanel's "Valider mon menu" gate), and the
   * backend turns each selection into its own cart line.
   *
   * Also called on close with partial work, so a composition interrupted
   * halfway through 5 plateaux resumes where it left off instead of being
   * thrown away. */
  onValidate: (selections: Record<string, number>[], targetQty: number) => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'%3E%3Crect width='200' height='160' fill='%23F3F1EE'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C7B287' font-size='36'%3E🧀%3C/text%3E%3C/svg%3E";

/**
 * ComposeProductModal — the "Composer" flow for build-your-own plateaux
 * (is_composable products, real structured composition_plateau data — see
 * ingest/derive.py's derive_composable). Opened INSTEAD of ProductDetailModal
 * for these products (see AssistantExperience's selectedProduct branch), but
 * still surfaces the product's own basic details (image/name/price/prep delay)
 * above the picker, since those can matter (allergies, delay) even when the
 * main point of this modal is choosing pieces.
 *
 * When several plateaux are ordered, this walks them ONE AT A TIME: Carrefour
 * prepares a separate plateau per unit, so "5 plateaux de 10 fromages" is five
 * compositions the user can make different, not one repeated five times. The
 * flow makes that obligation explicit (a per-plateau stepper, a footer that
 * says which plateau is being composed and how many are left) and offers two
 * shortcuts so identical plateaux stay one click away: "appliquer à tous" and
 * "copier le plateau précédent".
 */
export function ComposeProductModal({
  productId,
  onClose,
  initialSelections,
  unitCount,
  onValidate
}: Props) {
  const jwt = useShopperStore(s => s.jwt);
  const sessionId = useShopperStore(s => s.sessionId);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const plateauCount = Math.max(1, unitCount);
  // One selection (code -> chosen qty) per ordered plateau, always exactly
  // `plateauCount` long so a plateau can be addressed by index — seeded from
  // whatever was composed before, not always blank.
  const [selections, setSelections] = useState<PlateauSelection[]>(() =>
    resizeSelections(initialSelections, plateauCount)
  );
  const [activeIndex, setActiveIndex] = useState(0);
  // When on, every edit to the active plateau is mirrored onto every other one
  // instead of just itself — for the common case where all N plateaux are
  // meant to be identical, so the user composes once instead of N times.
  // Checking it also syncs immediately (not just future edits), and it stays
  // on across plateau navigation: that's the point of a persistent toggle
  // over the one-shot "apply now" button this replaced.
  const [syncAll, setSyncAll] = useState(false);
  // Compositions for units beyond the CURRENT quantity — kept aside and saved
  // back untouched, so lowering the quantity and raising it again returns the
  // plateaux the user had already composed instead of blank ones. The
  // completeness gates only ever look at the first `qty` entries, so carrying
  // this tail around can't make a short order read as ready.
  const preservedTail = useMemo(
    () => (initialSelections ?? []).slice(plateauCount).map(sel => ({ ...sel })),
    [initialSelections, plateauCount]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    // X-Session-Id must ride along: GET /product/{id} resolves the selected
    // store from it, and without it the API answers with the cross-store median
    // price and the global lead time — so the modal contradicted the very menu
    // it was opened from, for the exact same sku.
    const headers = sessionHeaders(sessionId);
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    fetch(`${getApiUrl()}/product/${productId}`, { headers })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ProductDetail>;
      })
      .then(data => {
        if (!cancelled) {
          setDetail(data);
          setLoading(false);
        }
      })
      .catch(err => {
        // err.message here is either "HTTP 404" (ours) or the browser's own raw
        // fetch error ("Failed to fetch" in Chrome, etc.) — never in French. Show
        // a fixed French message; keep the raw detail in the console only.
        if (!cancelled) {
          console.warn('[shopper-gpt] compose product fetch failed:', err);
          setError('Impossible de charger ce produit. Veuillez réessayer.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId, jwt, sessionId]);

  const targetQty = detail?.composition_plateau?.qty ?? 0;
  const selection = useMemo(() => selections[activeIndex] ?? {}, [selections, activeIndex]);
  const chosenQty = useMemo(() => selectionSize(selection), [selection]);
  const remaining = Math.max(0, targetQty - chosenQty);
  const activeComplete = isPlateauComplete(selection, targetQty);
  // Which plateaux are still missing pieces — drives the stepper, the footer
  // copy, and whether "Terminer" is allowed at all. The whole order has to be
  // composed here: leaving one plateau blank would silently drop a product the
  // user believes they ordered (see routes.py's own matching gate).
  const incompleteIndexes = useMemo(
    () =>
      selections
        .map((sel, i) => (isPlateauComplete(sel, targetQty) ? -1 : i))
        .filter(i => i >= 0),
    [selections, targetQty]
  );
  const allComplete = targetQty > 0 && incompleteIndexes.length === 0;
  const isMulti = plateauCount > 1;

  // Persist whatever has been composed so far when the modal closes, instead
  // of only on "Terminer". Composing five plateaux is real work; losing all of
  // it because the user stepped away mid-flow (or wanted to check something in
  // the panel) would be the worst part of this journey. Partial selections are
  // stored as-is and read back as "not composed yet" by the completeness gate,
  // so this can never make an unfinished order look ready.
  const persist = () => onValidate([...selections, ...preservedTail], targetQty);

  const closeAndPersist = () => {
    if (targetQty > 0 && selections.some(sel => selectionSize(sel) > 0)) {
      persist();
    }
    onClose();
  };

  // Escape / focus containment closes through the same path, so a plateau
  // composed and then dismissed with Esc is saved like any other close.
  const panelRef = useFocusTrap(closeAndPersist);

  const updateActive = (mutate: (current: PlateauSelection) => PlateauSelection) => {
    setSelections(prev => {
      if (syncAll) {
        // Mutate from the ACTIVE plateau's current selection, then broadcast
        // that single result everywhere — mutating each plateau independently
        // would preserve whatever they'd diverged to instead of converging
        // them, which defeats the point of "keep them all identical".
        const next = mutate(prev[activeIndex] ?? {});
        return prev.map(() => ({ ...next }));
      }
      return prev.map((sel, i) => (i === activeIndex ? mutate(sel) : sel));
    });
  };

  const addPiece = (code: string) => {
    if (chosenQty >= targetQty) return; // already full — must remove one first
    updateActive(current => ({ ...current, [code]: (current[code] ?? 0) + 1 }));
  };
  const removePiece = (code: string) => {
    updateActive(current => {
      const next = { ...current };
      const value = next[code] ?? 0;
      if (value <= 1) delete next[code];
      else next[code] = value - 1;
      return next;
    });
  };

  /** Turn "identical plateaux" mode on or off. Turning it on syncs every
   * plateau to the active one right away (not just from here on) — otherwise
   * checking the box on plateau 3 would leave 1 and 2 out of step with what
   * the user clearly just said they want: all of them the same. */
  const toggleSyncAll = (checked: boolean) => {
    setSyncAll(checked);
    if (checked) setSelections(prev => prev.map(() => ({ ...selection })));
  };

  /** Move to the next plateau that still needs pieces, or stay put if none. */
  const goToNextIncomplete = () => {
    const next = incompleteIndexes.find(i => i > activeIndex) ?? incompleteIndexes[0];
    if (next != null) setActiveIndex(next);
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={closeAndPersist}
    >
      {/* Backdrop */}
      <motion.div
        class="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Modal panel */}
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={detail?.composition_plateau?.title ?? 'Composez votre plateau'}
        tabIndex={-1}
        class="relative z-10 bg-white shadow-2xl w-full max-w-[420px] max-h-[90%] overflow-hidden flex flex-col outline-none"
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.97 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Close button */}
        <button
          onClick={closeAndPersist}
          class="absolute top-3 right-3 z-20 w-7 h-7 rounded-full bg-white/90 shadow flex items-center justify-center text-[#6B7280] hover:text-[#1A1A2E] hover:bg-white transition-colors"
          aria-label="Fermer"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2l10 10M12 2L2 12"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>

        {loading && (
          <div class="p-6 flex flex-col gap-3 animate-pulse">
            <div class="h-4 w-2/3 bg-[#E8E4DE] rounded" />
            <div class="h-20 w-full bg-[#F3F1EE] rounded" />
          </div>
        )}
        {error && !loading && (
          <div class="p-6 text-center text-[#6B7280] text-sm">
            Impossible de charger ce produit à composer.
          </div>
        )}
        {detail && !loading && !detail.composition_plateau && (
          <div class="p-6 text-center text-[#6B7280] text-sm">
            Ce produit n'a pas (ou plus) de composition disponible.
          </div>
        )}

        {/* Product context — name/price/persons/delay still matter even though
            the main point of this modal is picking pieces, not reading a
            description. Leads the modal (above the plateau selector), so the
            product being composed reads as the frame around the whole flow,
            not just another row inside the scrolling content. */}
        {detail && !loading && detail.composition_plateau && (
          <div class="shrink-0 bg-white flex gap-3 p-4 pr-8">
            <img
              class="w-14 h-14 rounded-lg object-cover shrink-0 bg-[#F3F1EE]"
              src={detail.image_url || PLACEHOLDER}
              alt={detail.name}
              loading="lazy"
              onError={e => {
                (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
              }}
            />
            <div class="flex flex-col gap-0.5 min-w-0">
              <h2 class="m-0 text-[13px] font-bold text-[#1A1A2E] leading-snug truncate">
                {detail.name}
              </h2>
              <div class="flex items-baseline gap-2 flex-wrap">
                {detail.price_eur != null && (
                  <span class="text-[14px] font-bold text-[#E2422B]">
                    {detail.price_eur.toFixed(2).replace('.', ',')} €
                  </span>
                )}
                {detail.expression_pvc && (
                  <span class="text-[10px] text-[#6B7280]">{detail.expression_pvc}</span>
                )}
              </div>
              {detail.delai_prepa != null && detail.delai_prepa > 0 && (
                <span class="text-[10px] text-[#9A8C78]">
                  {detail.delai_prepa} jour{detail.delai_prepa > 1 ? 's' : ''} de préparation
                </span>
              )}
            </div>
          </div>
        )}

        {/* Per-plateau stepper — only when there's more than one to compose.
            Doubles as the statement of what's required (every plateau, not
            just this one) and as direct navigation: a user who wants to fix
            plateau 2 after finishing 5 shouldn't have to walk back through
            the others. */}
        {detail && !loading && detail.composition_plateau && isMulti && (
          <div class="shrink-0 border-t border-b border-[#F0EDE8] bg-[#FBF8F2] px-4 pt-2 pb-2.5 pr-8">
            {/* The chips themselves already say "which one, out of how many" —
                a highlighted chip among N is that position — so a separate
                "Plateau X sur Y" line only repeated the word "plateau" a
                second time for no new information. Leading with the selector
                also makes it the first thing read/seen, not an afterthought
                below a title that said the same thing. pr-8 on the whole
                block (not just this label) keeps a full row of chips from
                running under the close button too. */}
            <span class="block leading-none text-[10px] font-semibold uppercase tracking-wide text-[#9A8C78]">
              Plateaux
            </span>
            <div
              class="flex flex-wrap gap-1.5 mt-2"
              role="tablist"
              aria-label="Plateaux à composer"
            >
              {selections.map((sel, index) => {
                const complete = isPlateauComplete(sel, targetQty);
                const isActive = index === activeIndex;
                const started = selectionSize(sel) > 0;
                return (
                  <button
                    key={index}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-label={`Plateau ${index + 1}${
                      complete ? ', composé' : started ? ', en cours' : ', à composer'
                    }`}
                    onClick={() => setActiveIndex(index)}
                    class={`relative h-7 min-w-[28px] px-2 rounded-full text-[11px] font-bold tabular-nums transition-colors ${
                      isActive
                        ? 'bg-[#C7B287] text-white shadow-sm'
                        : complete
                          ? 'bg-white text-[#8D7A4E] border border-[#C7B287]'
                          : started
                            ? 'bg-white text-[#9A8C78] border border-dashed border-[#C7B287]'
                            : 'bg-white text-[#B9AFA0] border border-[#E8E4DE]'
                    }`}
                  >
                    {index + 1}
                    {complete && (
                      <span
                        aria-hidden="true"
                        class={`absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[7px] font-bold ${
                          isActive ? 'bg-white text-[#C7B287]' : 'bg-[#C7B287] text-white'
                        }`}
                      >
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p class="mt-2 text-[10px] leading-snug text-[#9A8C78]">
              Chaque plateau est préparé séparément : composez-les tous, à l'identique ou
              différemment.
            </p>
          </div>
        )}

        {detail && !loading && detail.composition_plateau && (
          <ComposeContent
            plateau={detail.composition_plateau}
            selection={selection}
            activeIndex={activeIndex}
            onAdd={addPiece}
            onRemove={removePiece}
          />
        )}

        {detail?.composition_plateau && isMulti && (
          <div class="shrink-0 border-t border-b border-[#F0EDE8] bg-[#FBF8F2] px-4 py-2">
            {/* A persistent toggle, not a one-shot action — checking it syncs
                every plateau to this one immediately AND keeps them in step
                as the user keeps composing, for the common "N identical
                plateaux" case. Always here (not just once complete): the
                point is to let the user opt in before doing the work once,
                not after doing it N times. */}
            <label class="flex items-center gap-2 text-[10px] font-semibold text-[#1A1A2E] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={syncAll}
                onChange={e => toggleSyncAll((e.target as HTMLInputElement).checked)}
                class="h-4 w-4 rounded accent-black cursor-pointer"
              />
              Appliquer à tous les plateaux
            </label>
          </div>
        )}

        {detail?.composition_plateau && (
          <div class="shrink-0 border-t bg-[#C8B288] px-4 py-3 flex items-center justify-between gap-3">
            <div class="flex flex-col">
              <span class="text-[13px] font-400 text-white">
                {remaining > 0
                  ? 'Sélectionnez encore'
                  : isMulti && !allComplete
                    ? `Reste ${incompleteIndexes.length} plateau${
                        incompleteIndexes.length > 1 ? 'x' : ''
                      } à composer`
                    : 'Sélection complète'}
              </span>
              {remaining > 0 && (
                <span class="text-[20px] font-700 text-white mt-[-4px]">
                  {remaining} produit{remaining > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {/* One primary action that always means "move this forward":
                finish the order when everything is composed, otherwise jump
                to the next plateau that still needs pieces. Disabled while
                the current plateau is unfinished, so the button never skips
                over incomplete work. */}
            <button
              type="button"
              disabled={!activeComplete}
              onClick={() => {
                if (allComplete) {
                  persist();
                  onClose();
                  return;
                }
                goToNextIncomplete();
              }}
              class={`px-5 py-2 rounded-full text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                activeComplete
                  ? 'bg-white text-[#C7B287] cursor-pointer hover:bg-[#FBF8F2]'
                  : 'bg-white/40 text-white/70 cursor-not-allowed'
              }`}
            >
              {!isMulti ? 'Valider' : allComplete ? 'Terminer' : 'Plateau suivant'}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ComposeContent({
  plateau,
  selection,
  activeIndex,
  onAdd,
  onRemove
}: {
  plateau: CompositionPlateau;
  selection: Record<string, number>;
  /** Which plateau is being composed — only used to reset the scroll position
   * when moving between them, so each one starts at the top of the picker
   * instead of wherever the previous plateau was left scrolled to. */
  activeIndex: number;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const targetQty = plateau.qty ?? 0;
  const chosenQty = Object.values(selection).reduce((sum, q) => sum + q, 0);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Scrolled, not remounted (no `key` on this component): remounting would
  // re-request every piece image and flash the whole grid on each plateau.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [activeIndex]);

  return (
    <div
      ref={scrollRef}
      class="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]"
    >
      <div class="px-4 py-3">
        <h3 class="my-2 mt-4 text-[20px] font-['Satisfy'] text-[#C7B287] leading-tight text-center">
          {plateau.title || 'Composez votre plateau'}
        </h3>
        <div class="flex flex-col gap-4">
          {plateau.groups.map(group => (
            <div key={group.name}>
              <p class="my-5 text-[11px] font-semibold uppercase tracking-wide text-[#878787] text-center ">
                {group.name}
              </p>
              <div class="grid grid-cols-2 gap-2">
                {group.pieces.map(piece => {
                  const qty = selection[piece.code] ?? 0;
                  const atCapacity = chosenQty >= targetQty && qty === 0;
                  return (
                    <div
                      key={piece.code}
                      class={`relative flex flex-col items-center text-center p-2 rounded-xl border transition-colors ${
                        qty > 0 ? 'border-[#C7B287] bg-[#FBF8F2]' : 'border-[#F0EDE8]'
                      }`}
                    >
                      {/* Info icon — hover only, not a click target: a plain
                          span (not a button) with a `group`/`group-hover`
                          tooltip, same pattern as the Ajouter au panier
                          tooltip elsewhere. Only rendered when there's real
                          per-piece data (composition/allergens) to show — no
                          icon promising info that doesn't exist. focus-within
                          keeps it reachable via keyboard (Tab), not just mouse. */}
                      {piece.ingredients && (
                        <span
                          tabIndex={0}
                          role="img"
                          aria-label={`Informations sur ${piece.name}`}
                          class="group/info absolute top-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[#D1D5DB] bg-white text-[10px] font-serif italic text-[#9A8C78] hover:border-[#C7B287] hover:text-[#C7B287] focus:outline-none"
                        >
                          i
                          <span class="pointer-events-none absolute top-6 left-0 z-20 w-48 rounded-lg bg-[#1A1A2E] p-2.5 text-left text-[10px] font-sans font-normal not-italic leading-snug text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover/info:opacity-100 group-focus-within/info:opacity-100 [&_b]:font-semibold [&_br]:block">
                            <span dangerouslySetInnerHTML={{ __html: piece.ingredients }} />
                          </span>
                        </span>
                      )}

                      <img
                        src={piece.image_url || PLACEHOLDER}
                        alt=""
                        class="w-16 h-16 rounded-full object-cover my-2.5"
                        onError={e => {
                          (e.currentTarget as HTMLImageElement).src = PLACEHOLDER;
                        }}
                      />
                      <span class="text-[10px] font-medium text-[#1A1A2E] leading-snug line-clamp-2">
                        {piece.name}
                      </span>
                      {piece.conditionnement && (
                        <span class="text-[9px] text-[#9A8C78] mt-0.5">
                          {piece.conditionnement}
                        </span>
                      )}
                      <div class="flex items-center gap-1 mt-1.5 bg-white rounded-full shadow-sm px-1 py-0.5">
                        <button
                          type="button"
                          onClick={() => onRemove(piece.code)}
                          disabled={qty === 0}
                          class={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${
                            qty > 0
                              ? 'text-[#C7B287] hover:bg-[#F4EFE5]'
                              : 'text-[#D1D5DB] cursor-not-allowed'
                          }`}
                        >
                          −
                        </button>
                        <span class="min-w-[14px] text-center text-[11px] font-bold tabular-nums text-[#1A1A2E]">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAdd(piece.code)}
                          disabled={atCapacity}
                          class={`w-5 h-5 rounded-full flex items-center justify-center text-[12px] font-bold ${
                            !atCapacity
                              ? 'text-[#C7B287] hover:bg-[#F4EFE5]'
                              : 'text-[#D1D5DB] cursor-not-allowed'
                          }`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
