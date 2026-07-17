import { h, Fragment } from 'preact';
import { useRef, useMemo, useState } from 'preact/hooks';
import { AnimatePresence } from 'framer-motion';
import { EventRequirements, Product } from '../../types';
import { getStepIcon } from './icons';
import { MenuProductCard } from './MenuProductCard';
import { ShoppingListModal } from './ShoppingListModal';
import cartIcon from '../../assets/icons/cart.svg?raw';
import upIcon from '../../assets/icons/up.svg?raw';
import leftIcon from '../../assets/icons/left.svg?raw';
import rightIcon from '../../assets/icons/right.svg?raw';

// Hosted on a public GCS bucket rather than bundled — 16+ images inlined as base64
// would have bloated the widget's single-file bundle by several MB downloaded on
// every page. Keyed by event_requirements.visual_theme (LLM-inferred, see
// set_event_info) — "generique" is the fallback used before a theme is known or
// when none fits. "buffet" has its own visual, distinct from "apero" (see
// info.py's visual_theme enum).
const BACKGROUNDS_BASE_URL = 'https://storage.googleapis.com/carrefour-shoppergpt-backgrounds';
// Per-theme version suffix — bump just one theme's entry when only that image is
// re-exported, so unrelated themes don't need re-uploading to pick a new name.
const VISUAL_THEME_VERSIONS: Record<string, string> = {
  generique: 'v7',
  anniv: 'v8',
  apero: 'v7',
  bbq: 'v7',
  gouter: 'v7',
  mariage: 'v7',
  picnic: 'v8',
  tv: 'v7',
  amoureux: 'v7',
  bapteme: 'v7',
  brunch: 'v7',
  paques: 'v8',
  noel: 'v7',
  buffet: 'v10',
};
const BACKGROUNDS: Record<string, { before: string; after: string }> = Object.fromEntries(
  Object.entries(VISUAL_THEME_VERSIONS).map(([theme, version]) => [
    theme,
    { before: `${BACKGROUNDS_BASE_URL}/${theme}-1-${version}.webp`, after: `${BACKGROUNDS_BASE_URL}/${theme}-2-${version}.webp` }
  ])
);

interface Props {
  requirements: EventRequirements;
  productsByStep: Record<string, Product[]>;
  quantities: Record<string, number>;
  onQuantityChange: (productId: string, delta: number) => void;
  /** True while GET /menu is refreshing after a menu-changing turn. */
  syncing?: boolean;
  /** Mobile-only "retract" handle — rendered as a direct child of this panel
   * (not a sibling's descendant) so it never has to fight the footer bar's own
   * z-10 for stacking: as the last child here, it simply paints after it. Only
   * shown while the panel is expanded (see AssistantExperience); the "expand"
   * trigger itself lives in the chat pane below, since that direction only
   * needs to sit within the chat pane's own bounds. */
  mobileExpanded?: boolean;
  onRetractMobile?: () => void;
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
  syncing = false,
  mobileExpanded = false,
  onRetractMobile
}: Props) {
  const [shoppingListOpen, setShoppingListOpen] = useState(false);

  // Confirmed steps drive tab bar order + section order
  const steps: string[] = useMemo(() => {
    const confirmed = requirements.menu_steps ?? [];
    return confirmed.length > 0 ? confirmed : Object.keys(productsByStep);
  }, [requirements.menu_steps, productsByStep]);

  // Refs for smooth scroll-to on tab click (desktop bottom tab bar)
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  const scrollToStep = (step: string) => {
    sectionRefs.current[step]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Mobile-only: one step shown at a time, paged via the sticky top bar's
  // arrows (see below) instead of the bottom icon tab bar (desktop keeps all
  // steps stacked + that tab bar, unaffected). Clamped in case `steps` shrinks.
  const [mobileStepIndex, setMobileStepIndex] = useState(0);
  const currentMobileIndex = Math.min(mobileStepIndex, Math.max(steps.length - 1, 0));
  const productsScrollRef = useRef<HTMLDivElement | null>(null);
  const goToMobileStep = (index: number) => {
    setMobileStepIndex(index);
    productsScrollRef.current?.scrollTo({ top: 0 });
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
  const background = BACKGROUNDS[requirements.visual_theme ?? ''] ?? BACKGROUNDS.generique;

  const eventLabel = requirements.event_type
    ? menuEventLabel(requirements.event_type)
    : 'Mon menu traiteur';
  const dateLabel = requirements.event_date ? `le ${requirements.event_date}` : null;

  return (
    <div
      class={`flex-1 min-h-0 flex flex-col overflow-hidden relative transition-opacity duration-200 ${
        syncing ? 'opacity-60 pointer-events-none' : ''
      }`}
    >
      {/* ── Full-panel background image (theme "before" on first screen, "after" with menu).
          The source images themselves are edited (see carrefour_bgs_edited/) with extra
          plain-color canvas so the subject never reaches the zone where the event/date
          chips render, however tall the panel is — no need to constrain the image itself. ── */}
      <img
        src={hasProducts ? background.after : background.before}
        alt=""
        class="absolute inset-0 w-full h-full object-cover object-top z-0"
      />

      {/* ── No products: chips centred over full image ────────────────────────── */}
      {!hasProducts && (
        <div class="relative z-10 flex-1 flex flex-col items-center justify-center gap-3 px-6">
          <div class="bg-white/90 backdrop-blur-[3px] px-6 py-2.5 rounded-full shadow-md">
            <span class="font-['Satisfy'] text-[#C7B287] text-[20px] md:text-[24px] leading-none whitespace-nowrap">
              {eventLabel}
            </span>
          </div>
          {dateLabel && (
            <div class="bg-white/90 backdrop-blur-[3px] px-5 py-2 rounded-full shadow-sm">
              <span class="font-['Satisfy'] text-[#B09A6E] text-[14px] md:text-[16px] leading-none">
                {dateLabel}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── With products: chips + scrollable products over the image ────────── */}
      {hasProducts && (
        <div
          ref={productsScrollRef}
          class="relative z-10 flex-1 flex flex-col overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]"
        >
          {/* Chips — scroll away. Hidden on mobile once products exist: the
              sticky step bar right below already carries the current context,
              and there's no room for both. Desktop keeps them, unaffected. */}
          <div class="hidden md:flex shrink-0 flex-row items-center justify-center gap-3 px-6 pt-8 pb-5 flex-wrap">
            <div class="bg-white/90 backdrop-blur-[2px] px-6 py-2.5 rounded-2xl shadow-sm">
              <span class="font-['Satisfy'] text-[#C7B287] text-[18px] md:text-[20px] leading-none whitespace-nowrap">
                {eventLabel}
              </span>
            </div>
            {dateLabel && (
              <div class="bg-white/90 backdrop-blur-[2px] px-5 py-2.5 rounded-2xl shadow-sm">
                <span class="font-['Satisfy'] text-[#C7B287] text-[18px] md:text-[20px] leading-none whitespace-nowrap">
                  {dateLabel}
                </span>
              </div>
            )}
          </div>

          {/* Mobile-only sticky step nav — a real top bar (not a per-section chip),
              stays pinned while the products below scroll. Replaces the bottom
              icon tab bar entirely on mobile (see that bar further down, now
              `hidden md:block`); desktop keeps browsing via that tab bar instead,
              with all steps stacked below as before. Also hidden once the panel
              is expanded — expanded mobile shows every step stacked, same as
              desktop, so one-step-at-a-time paging no longer applies. */}
          {steps.length > 0 && !mobileExpanded && (
            <div class="md:hidden shrink-0 sticky top-0 z-20 flex items-center justify-between bg-[#FFF]/60 px-1 py-2.5">
              <button
                type="button"
                onClick={() => currentMobileIndex > 0 && goToMobileStep(currentMobileIndex - 1)}
                disabled={currentMobileIndex === 0}
                aria-label="Étape précédente"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent disabled:opacity-30 cursor-pointer disabled:cursor-default"
              >
                <span
                  class="inline-flex w-[10px] h-[12px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: leftIcon }}
                />
              </button>
              <div class="flex items-center gap-2">
                <span class="h-[26px] w-[26px] flex items-center justify-center shrink-0 [&_svg]:h-full [&_svg]:w-full">
                  {getStepIcon(steps[currentMobileIndex], 26)}
                </span>
                <span class="font-semibold uppercase tracking-wide text-[13px] text-[##878787] leading-none pt-2">
                  {steps[currentMobileIndex]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => currentMobileIndex < steps.length - 1 && goToMobileStep(currentMobileIndex + 1)}
                disabled={currentMobileIndex === steps.length - 1}
                aria-label="Étape suivante"
                class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent disabled:opacity-30 cursor-pointer disabled:cursor-default"
              >
                <span
                  class="inline-flex w-[10px] h-[12px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: rightIcon }}
                />
              </button>
            </div>
          )}

          {/* flex-1 + justify-center: when a step's product row is shorter than
              the available panel height (e.g. just 1-2 cards), it centers
              vertically in the leftover space instead of sitting flush at the
              top with dead space below. min-h-0 lets it shrink back below its
              content size once there's enough to actually scroll. Only applies
              to the one-step-at-a-time mobile view — expanded shows every step
              stacked (same as desktop), which is generally tall enough that
              centering would just look wrong, so it's suppressed then. */}
          <div
            class={`flex-1 min-h-0 flex flex-col px-4 md:px-6 ${mobileExpanded ? 'pt-8' : 'pt-2'}`}
          >
            {/* Collapsed mobile: stretches to fill the available height, so the
                single visible section's horizontal card strip below can in turn
                fill IT (flex-1 all the way down) instead of relying on a fixed
                px height. Expanded/desktop: normal block flow, unaffected. */}
            <div class={`flex flex-col gap-8 ${!mobileExpanded ? 'flex-1 min-h-0 md:flex-none md:min-h-0' : ''}`}>
              {steps.map((step, stepIdx) => {
                // Keep backend order stable, only push qty-0 suggestions to the end.
                // This avoids cards jumping around when users tweak quantities.
                const products = [...(productsByStep[step] ?? [])].sort((a, b) => {
                  const aIsEmpty = (quantities[a.id] ?? 0) <= 0;
                  const bIsEmpty = (quantities[b.id] ?? 0) <= 0;
                  if (aIsEmpty === bIsEmpty) return 0;
                  return aIsEmpty ? 1 : -1;
                });
                return (
                  <section
                    key={step}
                    ref={el => {
                      sectionRefs.current[step] = el as HTMLElement | null;
                    }}
                    style="scroll-margin-top: 20px"
                    // Mobile (collapsed): only the step matching the sticky top
                    // bar's current index is shown — one step at a time, and that
                    // section stretches to fill the available height (flex-1) so
                    // its card strip can in turn fill IT, no fixed px height
                    // needed. Mobile (expanded) and desktop always show every
                    // step stacked as plain blocks (unaffected either way).
                    class={
                      mobileExpanded
                        ? ''
                        : stepIdx === currentMobileIndex
                          ? 'flex-1 min-h-0 flex flex-col md:flex-none md:min-h-0 md:block'
                          : 'hidden md:block'
                    }
                  >
                    {/* Step heading chip — hidden in the collapsed mobile view
                        (its step name lives in the sticky top bar instead), but
                        shown once expanded — same as desktop. */}
                    <div class={`${mobileExpanded ? 'flex' : 'hidden md:flex'} items-center justify-center mb-4`}>
                      <div class="bg-white px-4 py-1.5 rounded-full shrink-0 shadow-sm">
                        <h2 class="font-['Satisfy'] text-[#C7B287] text-2xl leading-none m-0">
                          {step}
                        </h2>
                      </div>
                    </div>

                    {products.length === 0 ? (
                      <p class="text-center text-[11px] text-[#CBCBCB] py-4 m-0">
                        Aucun produit disponible pour ce service.
                      </p>
                    ) : mobileExpanded ? (
                      // Expanded mobile: same grid as desktop (flex-wrap + justify-center,
                      // not a rigid 3/4-col grid, so a partial row centers as a group
                      // instead of starting flush left with dead trailing columns).
                      <div class="flex flex-wrap justify-center gap-3">
                        {products.map(p => (
                          <div key={p.id} class="flex-[0_0_calc(50%-6px)] md:flex-[0_0_calc(25%-9px)]">
                            <MenuProductCard
                              product={p}
                              quantity={quantities[p.id] ?? 0}
                              onQuantityChange={delta => onQuantityChange(p.id, delta)}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Collapsed: mobile scrolls this step's products horizontally
                      // (one mostly-full-width card at a time, row layout — see
                      // MenuProductCard's `horizontal` prop), desktop keeps the usual
                      // grid. Both are rendered; CSS picks one per breakpoint since
                      // `mobileExpanded` alone can't tell "mobile, collapsed" apart
                      // from "desktop" — it's false in both cases.
                      <Fragment>
                        {/* flex-1 + min-h-0: fills the section's available height
                            (the section itself stretches via the class above) —
                            no fixed px height. py-4 keeps it clear of the sticky
                            step bar above and the footer below instead of
                            touching them. Each card is h-full of that padded
                            box (capped at max-h-[200px] — without the sandbox's
                            navbar/footer around it, e.g. on a short embedded
                            viewport, this area can end up with way more height
                            than a single product card should ever need), so the
                            image column grows tall enough for a 3-line name
                            without clipping it (see MenuProductCard's horizontal
                            branch). */}
                        <div class="flex md:hidden items-center flex-1 min-h-0 py-4 overflow-x-auto gap-3 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden -mx-4 px-4">
                          {products.map(p => (
                            <div key={p.id} class="w-[300px] h-full max-h-[200px] max-w-[300px] shrink-0 snap-center">
                              <MenuProductCard
                                product={p}
                                quantity={quantities[p.id] ?? 0}
                                onQuantityChange={delta => onQuantityChange(p.id, delta)}
                                horizontal
                              />
                            </div>
                          ))}
                        </div>
                        <div class="hidden md:flex flex-wrap justify-center gap-3">
                          {products.map(p => (
                            <div key={p.id} class="md:flex-[0_0_calc(25%-9px)]">
                              <MenuProductCard
                                product={p}
                                quantity={quantities[p.id] ?? 0}
                                onQuantityChange={delta => onQuantityChange(p.id, delta)}
                              />
                            </div>
                          ))}
                        </div>
                      </Fragment>
                    )}
                  </section>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom step tab bar — scrolls to section on click. Hidden on mobile,
          replaced by the prev/next arrows flanking each step's heading chip. ── */}
      {steps.length > 0 && (
        <div class="hidden md:block relative z-10 shrink-0 mt-4 bg-white border-t border-[#E8ECF0]">
          <div class="flex items-stretch overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {steps.map(step => {
              const icon = getStepIcon(step, 24);
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
                  <span class="h-[24px] w-[24px] flex items-center justify-center shrink-0 mt-1">
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

      {/* Mobile-only "retract" handle — a plain sibling sitting right before the
          footer in the HTML (not nested inside it, not pulled out via absolute
          positioning). `relative z-20` keeps it in normal flow while still
          reliably painting above the footer below (which is `position:relative`
          + `z-10`). No padding/margin of its own — takes up exactly its own
          icon size, no extra space reserved before the footer. */}
      {mobileExpanded && onRetractMobile && (
        <button
          type="button"
          class="hidden max-md:flex relative z-20 shrink-0 mx-auto p-0 cursor-pointer"
          onClick={onRetractMobile}
          aria-label="Réduire le menu"
          aria-expanded="true"
          dangerouslySetInnerHTML={{ __html: upIcon }}
        />
      )}

      {/* ── Stats footer — mobile: narrower white side (40/60 instead of 50/50),
          "Convives" collapsed to just a total headcount, "Prix/pers." dropped
          entirely (only "Coût total" shown). Desktop keeps the full detail via
          md: overrides, unaffected. ─────────────────────────────────────────── */}
      <div class="relative z-10 shrink-0 flex md:grid md:grid-cols-2 shadow-[0_-4px_14px_rgba(17,24,39,0.06)]">
        {/* Mobile: sized to its own content + padding (shrink-0), not a fixed
            track — the gold side (flex-1) soaks up whatever's left. Desktop
            reverts to an even grid-cols-2 split via md:. */}
        <div class="shrink-0 md:shrink md:flex-none bg-[#F3F1EE] px-3 py-2.5 md:px-4 md:py-3 flex flex-col gap-1.5">
          <div class="flex items-baseline gap-2">
            <span class="text-[11px] md:text-[11px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Convives
            </span>
            <span class="md:hidden text-[11px] text-[#8D7A4E] tabular-nums font-semibold">
              {totalGuests || '—'}
            </span>
            <span class="hidden md:inline text-[11px] text-[#8D7A4E] tabular-nums font-semibold">
              {requirements.guests_adults ?? '—'} adultes · {requirements.guests_kids ?? '—'} enf.
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-[11px] md:text-[11px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Budget
            </span>
            <span class="text-[11px] md:text-[11px] text-[#8D7A4E] tabular-nums font-semibold">
              {requirements.budget !== undefined ? fmtEur(requirements.budget) : '—'}
            </span>
          </div>
        </div>

        <div class="flex-1 min-w-0 md:flex-none bg-[#C7B287] text-white px-3 py-2.5 md:px-4 md:py-3 flex items-center justify-between gap-2">
          <div class="flex flex-col gap-1.5 min-w-0">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-[11px] md:text-[11px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
                Coût total
              </span>
              <span class="text-[12px] md:text-[11px] text-white tabular-nums font-semibold">
                {totalCost > 0 ? fmtEur(totalCost) : '—'}
              </span>
            </div>
            <div class="hidden md:flex items-baseline justify-between gap-2">
              <span class="text-[11px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
                Prix/pers.
              </span>
              <span class="text-[11px] text-white tabular-nums font-semibold">
                {pricePerPerson !== undefined ? fmtEur(pricePerPerson) : '—'}
              </span>
            </div>
          </div>

          {/* Ajouter au panier — opens the shopping-list recap modal.
              Two distinct buttons (not one toggling its content): a plain round
              icon-only button below 1000px (no room next to the price stats — mirrors
              the basket-icon circle in the mobile mockup), and a fixed-size text CTA
              at 1000px+ using the exact desktop spec (142×32, white fill, #AAAAAA
              1px border, 30px radius). Icon and label never show at the same time. */}
          {hasProducts && (
            <Fragment>
              {/* cart.svg now bakes in its own white circle background, so this
                  is just the icon itself — no extra button chrome/wrapper. */}
              <button
                onClick={() => setShoppingListOpen(true)}
                aria-label="Ajouter au panier"
                class="min-[1000px]:hidden shrink-0 flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer transition-opacity hover:opacity-90"
              >
                <span
                  class="inline-flex w-[36px] h-[36px] shrink-0 [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: cartIcon }}
                />
              </button>
              <button
                onClick={() => setShoppingListOpen(true)}
                class="hidden min-[1000px]:flex shrink-0 items-center justify-center cursor-pointer bg-white hover:bg-[#F7F2E6] transition-colors"
                style="width:142px; height:32px; border-radius:30px; border:1px solid #AAAAAA; padding:3px 7px;"
              >
                <span class="text-[10px] font-bold uppercase tracking-wide text-[#8D7A4E] whitespace-nowrap">
                  Ajouter au panier
                </span>
              </button>
            </Fragment>
          )}
        </div>
      </div>

      {/* ── Shopping list recap modal ────────────────────────────────────────── */}
      <AnimatePresence>
        {shoppingListOpen && (
          <ShoppingListModal
            productsByStep={productsByStep}
            quantities={quantities}
            steps={steps}
            totalGuests={totalGuests}
            onClose={() => setShoppingListOpen(false)}
            onValidate={() => setShoppingListOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
