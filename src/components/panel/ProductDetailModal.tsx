import { h } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { motion } from 'framer-motion';
import { getApiUrl, getClientId } from '../../api/config';
import { useShopperStore } from '../../store';

interface CompositionPiece {
  name: string;
  qty?: number | null;
  image_url?: string | null;
}

interface Composition {
  title: string;
  pieces: CompositionPiece[];
}

interface ProductDetail {
  id: string;
  sku?: string;
  name: string;
  price_eur?: number | null;
  persons?: number | null;
  image_url?: string | null;
  bac_type?: string | null;
  tags?: string[];
  composition?: Composition | null;
  menu_step?: string | null;
  department?: string | null;
  delai_prepa?: number | null;
  origine?: string | null;
  elabore_en?: string | null;
  conservation?: string | null;
  conseil_prepa?: string | null;
  ingredients?: string | null;
  en_savoir_plus?: string | null;
}

interface Props {
  productId: string;
  onClose: () => void;
}

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='160' viewBox='0 0 200 160'%3E%3Crect width='200' height='160' fill='%23F3F1EE'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23C7B287' font-size='36'%3E🍽%3C/text%3E%3C/svg%3E";

// ── Focus trap ────────────────────────────────────────────────────────────────
// Shadow-DOM-safe: listens on document (events from inside Shadow DOM bubble up)
// and uses e.composedPath() to see the real focused element across the boundary.

const FOCUSABLE_SELECTORS =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS));
}

function useFocusTrap(onEscape: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Keep onEscape stable inside the effect without re-running it.
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    // Move focus into the panel so keyboard users are immediately inside.
    // tabIndex={-1} on the panel div makes it programmatically focusable.
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

      // composedPath()[0] is the real focused element even inside a Shadow root.
      const active = e.composedPath()[0] as HTMLElement;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];

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
  }, []); // runs once on mount; onEscape always current via ref

  return panelRef;
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ProductDetailModal — fetches and displays full product detail for a given productId.
 *
 * Rendered as a Framer Motion animated overlay on top of the widget.
 * Fetches fresh data from GET /product/{productId} on mount so that
 * composition, tags, and other rich fields are always up to date.
 *
 * A11y: focus is trapped inside the panel, Escape closes it, ARIA role/modal
 * attributes are set. All implemented without a library so Shadow DOM styling
 * is never disturbed (no portal to document.body).
 */
export function ProductDetailModal({ productId, onClose }: Props) {
  const jwt = useShopperStore(s => s.jwt);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useFocusTrap(onClose);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-client-id': getClientId(),
    };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;

    fetch(`${getApiUrl()}/product/${productId}`, { headers })
      .then(async res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ProductDetail>;
      })
      .then(data => { if (!cancelled) { setDetail(data); setLoading(false); } })
      .catch(err => { if (!cancelled) { setError(err.message ?? 'Erreur'); setLoading(false); } });

    return () => { cancelled = true; };
  }, [productId, jwt]);

  return (
    <div class="absolute inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <motion.div
        class="absolute inset-0 bg-black/40"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      />

      {/* Modal panel */}
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={detail?.name ?? 'Détails du produit'}
        tabIndex={-1}
        class="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-[400px] max-h-[90%] overflow-y-auto flex flex-col outline-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]"
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
            <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
          </svg>
        </button>

        {loading && <SkeletonContent />}
        {error && !loading && (
          <div class="p-6 text-center text-[#6B7280] text-sm">
            Impossible de charger les détails du produit.
          </div>
        )}
        {detail && !loading && <DetailContent detail={detail} />}
      </motion.div>
    </div>
  );
}

function SkeletonContent() {
  return (
    <div class="flex flex-col animate-pulse">
      <div class="w-full h-[200px] bg-[#F3F1EE] rounded-t-2xl" />
      <div class="px-4 pt-4 pb-6 flex flex-col gap-3">
        <div class="h-4 w-3/4 bg-[#E8E4DE] rounded" />
        <div class="h-3 w-1/3 bg-[#E8E4DE] rounded" />
        <div class="h-3 w-1/2 bg-[#E8E4DE] rounded" />
        <div class="h-3 w-2/3 bg-[#E8E4DE] rounded" />
      </div>
    </div>
  );
}

function DetailContent({ detail }: { detail: ProductDetail }) {
  const [ingredientsOpen, setIngredientsOpen] = useState(false);

  const hasTags = (detail.tags?.length ?? 0) > 0;
  const hasComposition = detail.composition != null && (detail.composition.pieces?.length ?? 0) > 0;
  const hasIngredients = !!detail.ingredients?.trim();

  // Quick info chips: bac_type, origine, delai_prepa
  const chips: string[] = [];
  if (detail.bac_type) chips.push(detail.bac_type);
  if (detail.origine) chips.push(detail.origine);
  if (detail.delai_prepa != null && detail.delai_prepa > 0)
    chips.push(`${detail.delai_prepa} jour${detail.delai_prepa > 1 ? 's' : ''} de préparation`);

  return (
    <div class="flex flex-col">
      {/* Image — natural ratio, no crop */}
      <div class="relative shrink-0">
        <img
          class="w-full object-contain rounded-t-2xl block bg-[#F3F1EE]"
          src={detail.image_url || PLACEHOLDER}
          alt={detail.name}
          loading="lazy"
          onError={(e) => { (e.currentTarget as HTMLImageElement).src = PLACEHOLDER; }}
        />
        {detail.menu_step && (
          <span class="absolute bottom-2 left-2 text-[10px] font-semibold bg-white/90 text-[#C7B287] px-2 py-0.5 rounded-full shadow-sm">
            {detail.menu_step}
          </span>
        )}
      </div>

      <div class="px-4 pt-3 pb-5 flex flex-col gap-3">

        {/* Name */}
        <h2 class="m-0 text-[15px] font-bold text-[#1A1A2E] leading-snug pr-6">
          {detail.name}
        </h2>

        {/* Price + persons */}
        <div class="flex items-baseline gap-2 flex-wrap">
          {detail.price_eur != null && (
            <span class="text-[16px] font-bold text-[#C7B287]">
              {detail.price_eur.toFixed(2).replace('.', ',')} €
            </span>
          )}
          {detail.persons != null && detail.persons > 0 && (
            <span class="text-[11px] text-[#6B7280]">
              Pour {detail.persons} personne{detail.persons > 1 ? 's' : ''}
            </span>
          )}
          {detail.price_eur != null && detail.persons != null && detail.persons > 1 && (
            <span class="text-[10px] text-[#B0A898]">
              · {(detail.price_eur / detail.persons).toFixed(2).replace('.', ',')} €/pers.
            </span>
          )}
        </div>

        {/* Quick info chips: Frais · France · 5 jours de préparation */}
        {chips.length > 0 && (
          <div class="flex flex-wrap gap-1">
            {chips.map(chip => (
              <span key={chip} class="text-[10px] font-medium bg-[#F0EDE8] text-[#6B7280] px-2 py-0.5 rounded-full">
                {chip}
              </span>
            ))}
          </div>
        )}

        {/* Tags — raw Carrefour product tags (dietary, flavour, temperature…) */}
        {hasTags && (
          <div class="flex flex-wrap gap-1">
            {detail.tags!.map(tag => (
              <span key={tag} class="text-[10px] bg-[#F4EFE5] text-[#9A8C78] px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Elaboré en — may contain HTML from Carrefour export */}
        {detail.elabore_en && (
          <p
            class="m-0 text-[11px] italic text-[#9A8C78] [&_p]:inline [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: detail.elabore_en }}
          />
        )}

        {/* Conservation + conseil — may contain HTML entities and tags */}
        {(detail.conservation || detail.conseil_prepa) && (
          <div class="flex flex-col gap-1 pt-1 border-t border-[#F0EDE8]">
            {detail.conservation && (
              <div class="text-[11px] text-[#6B7280] [&_p]:inline [&_p]:m-0 [&_strong]:font-semibold">
                <span class="font-medium">Conservation : </span>
                <span dangerouslySetInnerHTML={{ __html: detail.conservation }} />
              </div>
            )}
            {detail.conseil_prepa && (
              <div class="text-[11px] text-[#6B7280] [&_p]:inline [&_p]:m-0 [&_strong]:font-semibold">
                <span class="font-medium">Conseil : </span>
                <span dangerouslySetInnerHTML={{ __html: detail.conseil_prepa }} />
              </div>
            )}
          </div>
        )}

        {/* Composition */}
        {hasComposition && (
          <div class="pt-2 border-t border-[#F0EDE8]">
            {detail.composition!.title && (
              <p class="m-0 mb-2 text-[12px] font-semibold text-[#1A1A2E]">
                {detail.composition!.title}
              </p>
            )}
            <ul class="m-0 p-0 list-none flex flex-col gap-2">
              {detail.composition!.pieces.map((piece, i) => (
                <li key={i} class="flex items-start gap-2">
                  {piece.image_url && (
                    <img
                      src={piece.image_url}
                      alt=""
                      class="w-9 h-9 rounded-lg object-cover shrink-0 mt-0.5"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                    />
                  )}
                  <span class="text-[11px] text-[#1A1A2E] leading-snug flex-1">
                    {/* Piece names can contain HTML (<b>, <br/>) from Carrefour */}
                    <span dangerouslySetInnerHTML={{ __html: piece.name }} />
                    {piece.qty != null && piece.qty > 1 && (
                      <span class="text-[#9A8C78]"> × {piece.qty}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ingredients — collapsible */}
        {hasIngredients && (
          <div class="pt-2 border-t border-[#F0EDE8]">
            <button
              class="w-full flex items-center justify-between text-[12px] font-semibold text-[#1A1A2E] bg-transparent border-none p-0 cursor-pointer"
              onClick={() => setIngredientsOpen(o => !o)}
              aria-expanded={ingredientsOpen}
            >
              <span>Ingrédients</span>
              <svg
                width="14" height="14" viewBox="0 0 14 14" fill="none"
                class={`transition-transform duration-200 ${ingredientsOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              >
                <path d="M2 5l5 5 5-5" stroke="#9A8C78" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            {ingredientsOpen && (
              <div
                class="mt-2 text-[10px] text-[#6B7280] leading-relaxed [&_b]:font-semibold [&_strong]:font-semibold [&_br]:block"
                dangerouslySetInnerHTML={{ __html: detail.ingredients! }}
              />
            )}
          </div>
        )}

      </div>
    </div>
  );
}
