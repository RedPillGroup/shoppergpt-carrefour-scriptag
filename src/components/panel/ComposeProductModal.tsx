import { h } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { motion } from 'framer-motion';
import { getApiUrl, getClientId } from '../../api/config';
import { useShopperStore } from '../../store';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CompositionPiece {
  code: string;
  name: string;
  conditionnement?: string | null;
  image_url?: string | null;
  extra_price?: number | null;
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
  /** The product's previously-saved choice (Product.plateau_selection), if
   * any — re-opening this modal on an already-composed plateau must start
   * from what the user picked last time, not blank. */
  initialSelection?: Record<string, number>;
  /** Called with the chosen pieces (code → qty) once the user validates —
   * the real add-to-cart call (POST /cart/add with options.plateau, per the
   * Carrefour Cart API doc) is a separate, later integration; for now this
   * just marks the plateau as "in the menu" like any other product. */
  onValidate: (selection: Record<string, number>) => void;
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
 */
export function ComposeProductModal({ productId, onClose, initialSelection, onValidate }: Props) {
  const jwt = useShopperStore(s => s.jwt);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // code -> chosen qty (only pieces with qty > 0 are kept) — seeded from the
  // product's previously-saved choice, not always blank.
  const [selection, setSelection] = useState<Record<string, number>>(initialSelection ?? {});

  const panelRef = useFocusTrap(onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': getClientId()
    };
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
        if (!cancelled) {
          setError(err.message ?? 'Erreur');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [productId, jwt]);

  const targetQty = detail?.composition_plateau?.qty ?? 0;
  const chosenQty = useMemo(
    () => Object.values(selection).reduce((sum, q) => sum + q, 0),
    [selection]
  );
  const remaining = Math.max(0, targetQty - chosenQty);
  const canValidate = targetQty > 0 && chosenQty === targetQty;

  const addPiece = (code: string) => {
    if (chosenQty >= targetQty) return; // already full — must remove one first
    setSelection(prev => ({ ...prev, [code]: (prev[code] ?? 0) + 1 }));
  };
  const removePiece = (code: string) => {
    setSelection(prev => {
      const next = { ...prev };
      const current = next[code] ?? 0;
      if (current <= 1) delete next[code];
      else next[code] = current - 1;
      return next;
    });
  };

  return (
    <div class="absolute inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
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
          onClick={onClose}
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

        {detail && !loading && detail.composition_plateau && (
          <ComposeContent
            detail={detail}
            plateau={detail.composition_plateau}
            selection={selection}
            onAdd={addPiece}
            onRemove={removePiece}
          />
        )}

        {detail?.composition_plateau && (
          <div class="shrink-0 border-t px-4 py-3 flex items-center justify-between gap-3 bg-[#C8B288]">
            <div class="flex flex-col">
              <span class="text-[13px] font-400 text-white">
                {remaining > 0 ? `Sélectionnez encore` : 'Sélection complète'}
              </span>
              {remaining > 0 && (
                <span class="text-[20px] font-700 text-white mt-[-4px]">
                  {remaining} produit{remaining > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <button
              type="button"
              disabled={!canValidate}
              onClick={() => {
                onValidate(selection);
                onClose();
              }}
              class={`px-5 py-2 rounded-full text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                canValidate
                  ? 'bg-white text-[#C7B287] cursor-pointer hover:bg-[#FBF8F2]'
                  : 'bg-white/40 text-white/70 cursor-not-allowed'
              }`}
            >
              Valider
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function ComposeContent({
  detail,
  plateau,
  selection,
  onAdd,
  onRemove
}: {
  detail: ProductDetail;
  plateau: CompositionPlateau;
  selection: Record<string, number>;
  onAdd: (code: string) => void;
  onRemove: (code: string) => void;
}) {
  const targetQty = plateau.qty ?? 0;
  const chosenQty = Object.values(selection).reduce((sum, q) => sum + q, 0);

  return (
    <div class="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]">
      {/* Compact product context — name/price/persons/delay still matter even
          though the main point here is picking pieces, not reading a description. */}
      <div class="flex gap-3 p-4 border-b border-[#F0EDE8]">
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
          <h2 class="m-0 text-[13px] font-bold text-[#1A1A2E] leading-snug truncate pr-6">
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
