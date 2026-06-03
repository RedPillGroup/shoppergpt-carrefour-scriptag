import { h } from 'preact';
import { useRef, useMemo } from 'preact/hooks';
import { EventRequirements, Product } from '../../types';
import { getStepIcon } from './icons';
import { MenuProductCard } from './MenuProductCard';

interface Props {
  requirements: EventRequirements;
  productsByStep: Record<string, Product[]>;
  quantities: Record<string, number>;
  onQuantityChange: (productId: string, delta: number) => void;
  /** True while GET /menu is refreshing after a menu-changing turn. */
  syncing?: boolean;
}

/** Format a number as "1 234,56 €" (French locale). */
function fmtEur(value: number): string {
  return (
    value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  );
}

/** "Menu d'anniversaire" vs "Menu de soirée" (élision before vowel / mute h). */
function menuEventLabel(eventType: string): string {
  const t = eventType.trim();
  if (!t) return 'Mon menu traiteur';
  const first = t.charAt(0).toLowerCase();
  if (/^[aeiouyhéèêëàâîïôûù]/.test(first)) {
    return `Menu d'${t}`;
  }
  return `Menu de ${t}`;
}

export function MenuBuilderPanel({
  requirements,
  productsByStep,
  quantities,
  onQuantityChange,
  syncing = false
}: Props) {
  // Confirmed steps drive tab bar order + section order
  const steps: string[] = useMemo(() => {
    const confirmed = requirements.menu_steps ?? [];
    return confirmed.length > 0 ? confirmed : Object.keys(productsByStep);
  }, [requirements.menu_steps, productsByStep]);

  // Refs for smooth scroll-to on tab click
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToStep = (step: string) => {
    sectionRefs.current[step]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── derived stats ─────────────────────────────────────────────────────────
  const totalCost = useMemo(() => {
    let sum = 0;
    for (const [id, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue;
      for (const products of Object.values(productsByStep)) {
        const p = products.find(x => x.id === id);
        if (p) {
          sum += p.price * qty;
          break;
        }
      }
    }
    return sum;
  }, [quantities, productsByStep]);

  const totalGuests = (requirements.guests_adults ?? 0) + (requirements.guests_kids ?? 0);
  const pricePerPerson = totalGuests > 0 && totalCost > 0 ? totalCost / totalGuests : undefined;


  const hasProducts = Object.keys(productsByStep).length > 0;
  const hasSelectedProducts = useMemo(
    () => Object.values(quantities).some(qty => qty > 0),
    [quantities],
  );

  const eventLabel = requirements.event_type
    ? menuEventLabel(requirements.event_type)
    : 'Mon menu traiteur';
  const dateLabel = requirements.event_date ? `le ${requirements.event_date}` : null;

  return (
    <div
      class={`flex-1 min-h-0 flex flex-col overflow-hidden bg-[#FAF9F7] transition-opacity duration-200 ${
        syncing ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* ── Sticky top bar — event title + date + voir la liste ─────────────── */}
      <div class="bg-white border-b border-[#E8ECF0] px-4 py-5 md:px-5 flex gap-3">
        {/* Cursive event info — centred in the space beside the list button, using elegant font */}
        <div class="flex-1 flex flex-col gap-2 min-w-0 items-center justify-center text-center">
          <span class="text-[#C7B287] text-[15px] md:text-[18px] leading-none">
            {eventLabel}
          </span>
          {dateLabel && (
            <span class="text-[12px] md:text-[13px] text-[#B09A6E] leading-none">
              {dateLabel}
            </span>
          )}
        </div>

        {hasSelectedProducts && (
          <button
            class="flex flex-col items-center gap-1 text-[#9A8C78] hover:text-[#C7B287] transition-colors border border-[#E8D9C0] rounded-xl px-2.5 py-2 bg-white justify-center shrink-0"
            title="Ajouter au panier"
          >
            <p class="text-[7px] md:text-[8px] uppercase tracking-wide font-semibold text-center leading-none">
              Ajouter au panier
            </p>
          </button>
        )}
      </div>

      {/* ── Scrollable product sections ──────────────────────────────────────── */}
      <div
        class="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]"
      >
        <div class="px-4 pt-5 pb-6 md:px-6 md:pt-6">
          {!hasProducts ? (
            /* Empty state — waiting for LLM to return products */
            <div class="flex flex-col items-center justify-center py-16 gap-3">
              {/* <div class="w-12 h-12 rounded-full bg-[#F4EFE5] flex items-center justify-center text-[#C7B287]">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  width="22"
                  height="22"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4l3 3" />
                </svg>
              </div>
              <p class="text-sm text-[#9A8C78] text-center max-w-[200px] leading-relaxed m-0">
                {steps.length > 0
                  ? 'Les produits pour votre menu arrivent…'
                  : 'Les produits apparaîtront ici une fois les étapes confirmées.'}
              </p> */}
            </div>
          ) : (
            <div class="flex flex-col gap-8">
              {steps.map(step => {
                // Keep backend order stable, only push qty-0 suggestions to the end.
                // This avoids cards jumping around when users tweak quantities.
                const products = [...(productsByStep[step] ?? [])].sort(
                  (a, b) => {
                    const aIsEmpty = (quantities[a.id] ?? 0) <= 0;
                    const bIsEmpty = (quantities[b.id] ?? 0) <= 0;
                    if (aIsEmpty === bIsEmpty) return 0;
                    return aIsEmpty ? 1 : -1;
                  },
                );
                return (
                  <section
                    key={step}
                    ref={el => {
                      sectionRefs.current[step] = el as HTMLElement | null;
                    }}
                    style="scroll-margin-top: 20px"
                  >
                    {/* Cursive step heading with hairline dividers */}
                    <div class="flex items-center gap-3 mb-4">
                      <div class="flex-1 h-px bg-[#E8D9C0]" />
                      <h2 class="font-['Satisfy'] text-[#C7B287] text-xl md:text-2xl leading-none shrink-0">
                        {step}
                      </h2>
                      <div class="flex-1 h-px bg-[#E8D9C0]" />
                    </div>

                    {products.length === 0 ? (
                      <p class="text-center text-[11px] text-[#CBCBCB] py-4 m-0">
                        Aucun produit disponible pour ce service.
                      </p>
                    ) : (
                      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {products.map(p => (
                          <MenuProductCard
                            key={p.id}
                            product={p}
                            quantity={quantities[p.id] ?? 0}
                            onQuantityChange={delta => onQuantityChange(p.id, delta)}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom step tab bar — scrolls to section on click ───────────────── */}
      {steps.length > 0 && (
        <div class="shrink-0 bg-white border-t border-[#E8ECF0]">
          <div class="flex items-stretch overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {steps.map(step => {
              const icon = getStepIcon(step, 18);
              if (!icon) return null;
              const hasProductsForStep = (productsByStep[step]?.length ?? 0) > 0;
              return (
                <button
                  key={step}
                  onClick={() => scrollToStep(step)}
                  class={`flex-1 min-w-[52px] flex flex-col items-center gap-1 py-2.5 px-1 border-0 cursor-pointer transition-colors duration-150 ${
                    hasProductsForStep
                      ? 'text-[#9A8C78] hover:text-[#C7B287] bg-white'
                      : 'text-[#D1D5DB] bg-[#FAFAF9]'
                  }`}
                >
                  <span class="h-[18px] w-[18px] flex items-center justify-center shrink-0 mt-1">
                    {icon}
                  </span>
                  <span class="text-[7px] md:text-[8px] uppercase tracking-wide leading-none font-medium">
                    {step}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Stats footer ─────────────────────────────────────────────────────── */}
      <div class="shrink-0 grid grid-cols-2 border-t border-[#E8ECF0] shadow-[0_-4px_14px_rgba(17,24,39,0.06)]">
        <div class="bg-[#F3F1EE] px-3 py-2.5 md:px-4 md:py-3 flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Convives
            </span>
            <span class="text-[9px] md:text-[10px] text-[#8D7A4E] text-right tabular-nums">
              {requirements.guests_adults ?? '—'} adultes · {requirements.guests_kids ?? '—'} enf.
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Budget
            </span>
            <span class="text-[9px] md:text-[10px] text-[#8D7A4E] tabular-nums">
              {requirements.budget !== undefined ? fmtEur(requirements.budget) : '—'}
            </span>
          </div>
        </div>

        <div class="bg-[#C7B287] text-white px-3 py-2.5 md:px-4 md:py-3 flex flex-col gap-1.5">
          <div class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
              Coût total
            </span>
            <span class="text-[9px] md:text-[10px] text-white tabular-nums font-semibold">
              {totalCost > 0 ? fmtEur(totalCost) : '—'}
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-1">
            <span class="text-[9px] md:text-[10px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
              Prix/pers.
            </span>
            <span class="text-[9px] md:text-[10px] text-white tabular-nums font-semibold">
              {pricePerPerson !== undefined ? fmtEur(pricePerPerson) : '—'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
