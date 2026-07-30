import { h, Fragment } from 'preact';
import { useRef, useMemo, useState, useEffect } from 'preact/hooks';
import { AnimatePresence } from 'framer-motion';
import { EventRequirements, Product } from '../../types';
import { useShopperStore } from '../../store';
import { getStepIcon } from './icons';
import { MenuProductCard } from './MenuProductCard';
import { ShoppingListModal } from './ShoppingListModal';
import cartIcon from '../../assets/icons/cart.svg?raw';
import upIcon from '../../assets/icons/up.svg?raw';
import leftIcon from '../../assets/icons/left.svg?raw';
import rightIcon from '../../assets/icons/right.svg?raw';

// Hosted on a public GCS bucket rather than bundled — 16+ images inlined as base64
// would have bloated the widget's single-file bundle by several MB downloaded on
// every page. Keyed by event_requirements.event_theme (LLM-inferred, see
// set_event_info) — "generique" is the fallback used before a theme is known or
// when none fits. "buffet" has its own visual, distinct from "apero" (see
// info.py's theme enum).
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
  buffet: 'v10'
};
const BACKGROUNDS: Record<string, { before: string; after: string }> = Object.fromEntries(
  Object.entries(VISUAL_THEME_VERSIONS).map(([theme, version]) => [
    theme,
    {
      before: `${BACKGROUNDS_BASE_URL}/${theme}-1-${version}.webp`,
      after: `${BACKGROUNDS_BASE_URL}/${theme}-2-${version}.webp`
    }
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
  /** Fired when the user taps the "Nouvelle proposition de produits" card for a
   * step — parent owns the actual API call (see AssistantExperience). */
  onSuggestMore?: (step: string) => void;
  /** Step currently awaiting a suggest_products response, if any — shows a
   * loading state on that one card only. */
  suggestingStep?: string | null;
  /** "Ajouter au panier" in ShoppingListModal — parent owns the actual API call
   * (POST /cart/confirm, no-op outside the real Carrefour context) and any
   * error messaging; this panel just forwards the tap. */
  onConfirmCart?: () => void;
}

/** Format a number as "1 234,56 €" (French locale). */
function fmtEur(value: number): string {
  return (
    value.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
  );
}

/** Big-integer / small-decimals price display (desktop gold stats bar) — the
 * whole-number part reads at a much larger size than the ",XX €" tail, e.g.
 * "113" large next to a small ",50 €", instead of one uniform font size. */
function PriceBig({ value }: { value: number }) {
  const [intPart, decPart] = value
    .toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .split(',');
  return (
    <span class="tabular-nums font-[500] text-white whitespace-nowrap">
      <span class="text-[17px] md:text-[20px] leading-none">{intPart}</span>
      <span class="text-[12px] md:text-[14px] leading-none">,{decPart} €</span>
    </span>
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

/** Dashed, grayed-out card offering a couple more event-coherent product ideas
 * for this step — sits last in the grid so it never displaces real products.
 *
 * Self-sized to match MenuProductCard's own height with NO measurement, JS,
 * or "sibling in the same row" dependency (which is what kept drifting out of
 * sync — a card alone on its own last grid row has no taller sibling for
 * flex/grid stretch to size against). MenuProductCard's own height is really
 * just: an aspect-square image (height = column width, since the image is
 * `w-full aspect-square`) + a content block whose height is fixed by its
 * text/line-clamp/padding, not by width. So mirroring THAT exact shape here —
 * same aspect-square area, same content block dimensions via invisible
 * placeholders — lands on the same total height at any grid width, in any
 * grid (mobile expanded, desktop), automatically, no JS required. */
function SuggestMoreCard({
  step,
  loading,
  onClick,
  horizontal = false
}: {
  step: string;
  loading: boolean;
  onClick: (step: string) => void;
  horizontal?: boolean;
}) {
  const label = loading ? (
    <svg
      class="animate-spin w-5 h-5 text-[#C8B288]"
      viewBox="0 0 24 24"
      fill="none"
      aria-label="Chargement"
    >
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  ) : (
    <span class="border-[1px] border-white inline-block p-2 max-w-[85%] rounded-full bg-[#C8B288] text-white text-[8px] lg:text-[10px] font-semibold uppercase tracking-wide text-center leading-tight whitespace-pre-line">
      Nouvelle proposition de produits
    </span>
  );

  // Mobile horizontal-scroll row: the wrapping card there already has an
  // explicit h-full (capped at max-h-[200px], same as real horizontal
  // MenuProductCards in that row) — just fill it, no aspect-ratio needed.
  if (horizontal) {
    return (
      <button
        type="button"
        onClick={() => onClick(step)}
        disabled={loading}
        class="flex items-center justify-center w-full h-full border-[2px] border-dashed border-[#C8B288] bg-white/40 cursor-pointer disabled:cursor-wait"
      >
        {label}
      </button>
    );
  }

  return (
    // Border + background on the OUTER button — spanning image AND placeholder
    // — so the dashed box reads as one continuous card the full height of a
    // real MenuProductCard, not just a small square with a blank gap below it.
    // `aspect-square` (not h-full) is what actually makes this self-sizing:
    // with the grid's `items-start` (no row-stretch), there's no ancestor with
    // a definite height for h-full to resolve against — aspect-ratio derives
    // height from the column's own width instead, which always exists.
    <button
      type="button"
      onClick={() => onClick(step)}
      disabled={loading}
      class="relative flex flex-col w-full border-[2px] border-dashed border-[#C8B288] bg-white/40 cursor-pointer disabled:cursor-wait h-full"
    >
      {/* aspect-square + placeholder below are layout-only (sizing), kept
          invisible/empty — the label is a separate absolutely-positioned
          overlay centered on the WHOLE card (image + placeholder), not just
          the top square, via inset-0 on this wrapper. */}
      <div class="w-full aspect-square" aria-hidden="true" />
      <div class="px-2.5 pt-2 pb-3 flex flex-col gap-0.5 invisible" aria-hidden="true">
        <span class="text-[18px] leading-none">0,00 €</span>
        <div class="text-[11px] leading-snug line-clamp-2 min-h-[2.75em]">&nbsp;</div>
      </div>
      <div class="absolute inset-0 flex items-center justify-center">{label}</div>
    </button>
  );
}

export function MenuBuilderPanel({
  requirements,
  productsByStep,
  quantities,
  onQuantityChange,
  syncing = false,
  mobileExpanded = false,
  onRetractMobile,
  onSuggestMore,
  suggestingStep = null,
  onConfirmCart
}: Props) {
  const [shoppingListOpen, setShoppingListOpen] = useState(false);

  // Confirmed steps drive tab bar order + section order
  const steps: string[] = useMemo(() => {
    const confirmed = requirements.menu_steps ?? [];
    return confirmed.length > 0 ? confirmed : Object.keys(productsByStep);
  }, [requirements.menu_steps, productsByStep]);

  // A build-your-own plateau in the menu (is_composable, qty > 0) that isn't
  // FULLY composed can't become a real cart line — a partial selection (or
  // none at all, if the Composer modal was never opened) is passed down to
  // ShoppingListModal, which surfaces it as a warning and disables "Ajouter
  // au panier" there (see that component) rather than blocking entry to the
  // recap itself. plateau_target_qty is only ever set once the Composer
  // modal has been validated at least once (see ComposeProductModal /
  // handleComposeValidate) — undefined means "never composed", itself
  // incomplete, not a pass.
  const incompleteComposableProducts = useMemo(() => {
    const incomplete: Product[] = [];
    for (const items of Object.values(productsByStep)) {
      for (const p of items) {
        if (!p.is_composable) continue;
        if ((quantities[p.id] ?? 0) <= 0) continue;
        const chosenQty = p.plateau_selection
          ? Object.values(p.plateau_selection).reduce((sum, q) => sum + q, 0)
          : 0;
        const complete = p.plateau_target_qty != null && chosenQty === p.plateau_target_qty;
        if (!complete) incomplete.push(p);
      }
    }
    return incomplete;
  }, [productsByStep, quantities]);

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
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setMobileStepIndex(clamped);
    productsScrollRef.current?.scrollTo({ top: 0 });
  };

  // Server-driven navigation: when a sync changed exactly one step (see
  // AssistantExperience's applyPanelState diff), bring that step into view.
  // Both navigation modes are driven unconditionally rather than sniffing the
  // viewport: the mobile pager index is invisible on desktop, and scrollIntoView
  // on a section the mobile layout isn't showing is a no-op — so each mode's
  // call is simply inert on the other. Steps not currently confirmed (not in
  // `steps`) are ignored: there is no section to show.
  const stepScrollRequest = useShopperStore(s => s.stepScrollRequest);
  useEffect(() => {
    if (!stepScrollRequest) return;
    const idx = steps.indexOf(stepScrollRequest.step);
    if (idx === -1) return;
    goToMobileStep(idx);
    sectionRefs.current[stepScrollRequest.step]?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepScrollRequest]);

  // Mobile-only: let a horizontal scroll/swipe on the sticky step bar itself
  // change the step too, not just its arrow buttons — the bar has no content
  // to actually scroll (just an icon + name), so a wheel deltaX / touch swipe
  // is reinterpreted as "go to next/prev step" once past a small threshold,
  // then reset so each gesture only moves one step at a time.
  const stepBarWheelAccumRef = useRef(0);
  const stepBarTouchStartXRef = useRef<number | null>(null);
  const SWIPE_THRESHOLD = 40;

  const handleStepBarWheel = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    stepBarWheelAccumRef.current += delta;
    if (Math.abs(stepBarWheelAccumRef.current) >= SWIPE_THRESHOLD) {
      goToMobileStep(currentMobileIndex + (stepBarWheelAccumRef.current > 0 ? 1 : -1));
      stepBarWheelAccumRef.current = 0;
    }
  };

  const handleStepBarTouchStart = (e: TouchEvent) => {
    stepBarTouchStartXRef.current = e.touches[0].clientX;
  };

  const handleStepBarTouchEnd = (e: TouchEvent) => {
    const startX = stepBarTouchStartXRef.current;
    stepBarTouchStartXRef.current = null;
    if (startX == null) return;
    const deltaX = startX - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD) {
      goToMobileStep(currentMobileIndex + (deltaX > 0 ? 1 : -1));
    }
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
  const background = BACKGROUNDS[requirements.event_theme ?? ''] ?? BACKGROUNDS.generique;

  const eventLabel = requirements.event_name
    ? menuEventLabel(requirements.event_name)
    : 'Mon menu traiteur';
  const dateLabel = requirements.date ? `le ${requirements.date}` : null;

  return (
    // inset (not a regular bottom box-shadow) — this panel sits inside a
    // same-size overflow-hidden wrapper in AssistantExperience, which clips
    // any shadow that needs to bleed OUTSIDE this box before it ever renders.
    // inset paints INSIDE this box's own bottom edge instead, so it survives
    // that clipping.
    <div
      class={`flex-1 min-h-0 flex flex-col overflow-hidden relative shadow-[inset_0_-6px_8px_-6px_rgba(0,0,0,0.12)] transition-opacity duration-200 ${
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
          <div class="bg-white/90 backdrop-blur-[3px] px-6 py-2.5 rounded-[100px] shadow-md">
            <span class="font-['Satisfy'] text-[#C7B287] text-[20px] md:text-[24px] leading-none whitespace-nowrap">
              {eventLabel}
            </span>
          </div>
          {dateLabel && (
            <div class="bg-white/90 backdrop-blur-[3px] px-5 py-2 rounded-[100px] shadow-sm">
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
            <div class="bg-white/90 backdrop-blur-[2px] px-6 py-2.5 rounded-[100px] shadow-sm">
              <span class="font-['Satisfy'] text-[#C7B287] text-[18px] md:text-[20px] leading-none whitespace-nowrap">
                {eventLabel}
              </span>
            </div>
            {dateLabel && (
              <div class="bg-white/90 backdrop-blur-[2px] px-5 py-2.5 rounded-[100px] shadow-sm">
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
            <div
              class="md:hidden shrink-0 sticky top-0 z-20 flex items-center justify-between bg-[#FFF]/90 px-10 py-2.5"
              onWheel={handleStepBarWheel}
              onTouchStart={handleStepBarTouchStart}
              onTouchEnd={handleStepBarTouchEnd}
            >
                <button
                  type="button"
                  onClick={() => currentMobileIndex > 0 && goToMobileStep(currentMobileIndex - 1)}
                  disabled={currentMobileIndex === 0}
                  aria-label="Étape précédente"
                  class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent disabled:opacity-30 cursor-pointer disabled:cursor-default"
                >
                  <span
                    class="inline-flex w-[18px] h-[18px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: leftIcon }}
                  />
                </button>
                <div class="flex items-center gap-2 mb-2">
                  <span class="h-[26px] w-[26px] flex items-center justify-center shrink-0 [&_svg]:h-full [&_svg]:w-full">
                    {getStepIcon(steps[currentMobileIndex], 26)}
                  </span>
                  <span class="font-semibold uppercase tracking-wide text-[13px] text-[##878787] leading-none pt-2">
                    {steps[currentMobileIndex]}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    currentMobileIndex < steps.length - 1 && goToMobileStep(currentMobileIndex + 1)
                  }
                  disabled={currentMobileIndex === steps.length - 1}
                  aria-label="Étape suivante"
                  class="shrink-0 w-8 h-8 flex items-center justify-center rounded-full border-0 bg-transparent disabled:opacity-30 cursor-pointer disabled:cursor-default"
                >
                  <span
                    class="inline-flex w-[18px] h-[18px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
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
            <div
              class={`flex flex-col gap-8 ${!mobileExpanded ? 'flex-1 min-h-0 md:flex-none md:min-h-0' : ''}`}
            >
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
                    <div
                      class={`${mobileExpanded ? 'flex' : 'hidden md:flex'} items-center justify-center mb-4`}
                    >
                      <div class="bg-white p-6 py-2 rounded-full shrink-0 shadow-sm">
                        <h2 class="font-['Satisfy'] text-[#C7B287] text-2xl leading-none m-0">
                          {step}
                        </h2>
                      </div>
                    </div>

                    {products.length === 0 ? (
                      onSuggestMore ? (
                        <div class="flex justify-center px-4">
                          <div class="w-full max-w-[220px]">
                            <SuggestMoreCard
                              step={step}
                              loading={suggestingStep === step}
                              onClick={onSuggestMore}
                            />
                          </div>
                        </div>
                      ) : (
                        <p class="text-center text-[11px] text-[#CBCBCB] py-4 m-0">
                          Aucun produit disponible pour ce service.
                        </p>
                      )
                    ) : mobileExpanded ? (
                      // Expanded mobile: same grid as desktop. flex-wrap (not CSS
                      // grid) — grid places a partial last row's items left-aligned
                      // in the track (leftover columns just sit empty on the
                      // right), it never centers the group; flex-wrap's
                      // justify-center does. Each card now derives its own height
                      // purely from its own aspect-ratio (not from row-stretch —
                      // see SuggestMoreCard), so equal-width flex-basis items in
                      // the same row already land at the same natural height
                      // without needing align-items to do anything.
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
                        {onSuggestMore && (
                          <div class="flex-[0_0_calc(50%-6px)] md:flex-[0_0_calc(25%-9px)]">
                            <SuggestMoreCard
                              step={step}
                              loading={suggestingStep === step}
                              onClick={onSuggestMore}
                            />
                          </div>
                        )}
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
                            <div
                              key={p.id}
                              class="w-[300px] h-full max-h-[200px] max-w-[300px] shrink-0 snap-center"
                            >
                              <MenuProductCard
                                product={p}
                                quantity={quantities[p.id] ?? 0}
                                onQuantityChange={delta => onQuantityChange(p.id, delta)}
                                horizontal
                              />
                            </div>
                          ))}
                          {onSuggestMore && (
                            <div class="w-[300px] h-full max-h-[200px] max-w-[300px] shrink-0 snap-center">
                              <SuggestMoreCard
                                step={step}
                                loading={suggestingStep === step}
                                onClick={onSuggestMore}
                                horizontal
                              />
                            </div>
                          )}
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
                          {onSuggestMore && (
                            <div class="md:flex-[0_0_calc(25%-9px)]">
                              <SuggestMoreCard
                                step={step}
                                loading={suggestingStep === step}
                                onClick={onSuggestMore}
                              />
                            </div>
                          )}
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
        <div class="shrink-0 md:shrink md:flex-none bg-[#FFF] px-3 py-1 md:px-4 md:py-3 flex flex-col justify-center gap-0 md:gap-1.5">
          {/* h-5/h-7 + items-center on both rows here, matching the gold side's
              row height exactly — that's what actually keeps the two columns'
              label-to-label rhythm in sync, not just an equal `gap` value (see
              the gold side's comment: its price text is much taller than an
              11px label, so equal gaps alone still produced uneven-looking
              spacing since each ROW's own height differed between columns).
              Only md: needs the taller h-7 — desktop is the only place both
              sides show 2 rows each (mobile hides Prix/pers., so the gold
              side is a single row there); forcing h-7 on mobile too just made
              the WHOLE bar noticeably taller than it needs to be there. */}
          <div class="flex items-center h-5 md:h-7 gap-2">
            <span class="text-[11px] md:text-[11px] font-[500] uppercase tracking-wide text-[#878787] shrink-0">
              Convives
            </span>
            <span class="md:hidden text-[11px] text-[#C8B288] tabular-nums font-[800]">
              {totalGuests || '—'}
            </span>
            <span class="hidden md:inline text-[11px] tabular-nums font-[500] text-[#878787]">
              <span class="text-[#C8B288]">{requirements.guests_adults ?? '—'}</span> adultes ·{' '}
              <span class="text-[#C8B288]">{requirements.guests_kids ?? '—'}</span> enf.
            </span>
          </div>
          <div class="flex items-center h-5 md:h-7 gap-2">
            <span class="text-[11px] md:text-[11px] font-[500] uppercase tracking-wide text-[#878787] shrink-0">
              Budget
            </span>
            <span class="text-[11px] md:text-[11px] text-[#878787] tabular-nums font-[500] text-[#C8B288]">
              {requirements.budget !== undefined ? fmtEur(requirements.budget) : '—'}
            </span>
          </div>
        </div>

        <div class="flex-1 min-w-0 md:flex-none bg-[#C8B288] text-white px-3 py-1 md:px-4 md:py-3 flex items-center justify-between gap-2">
          {/* w-[78px] on both labels (not justify-between) — a fixed label
              column keeps the two prices' numbers starting at the same x
              regardless of "Coût total" vs "Prix/pers." having different
              lengths; justify-between let the shorter label's value creep
              left, misaligning the two rows. h-5/h-7 + items-center on each
              row (instead of items-baseline) — PriceBig's big number has a
              much taller line box than the small label text, so the same
              gap between rows still LOOKED bigger here than on the
              Convives/Budget side; fixing both rows to the same height makes
              the visual rhythm between rows match the other column's. Only
              md: needs h-7 — mobile hides Prix/pers. entirely (single row). */}
          <div class="flex flex-col gap-0 md:gap-1.5 min-w-0">
            <div class="flex items-center h-5 md:h-7 gap-2">
              <span class="w-[78px] text-[11px] md:text-[11px] font-[500] uppercase text-white shrink-0">
                Coût total
              </span>
              {totalCost > 0 ? <PriceBig value={totalCost} /> : <span class="text-white">—</span>}
            </div>
            <div class="hidden md:flex items-center h-7 gap-2">
              <span class="w-[78px] text-[11px] font-[500] uppercase text-white shrink-0">Prix/pers.</span>
              {pricePerPerson !== undefined ? (
                <PriceBig value={pricePerPerson} />
              ) : (
                <span class="text-white">—</span>
              )}
            </div>
          </div>

          {/* Valider ma liste — opens the shopping-list recap modal.
              Two distinct buttons (not one toggling its content): a plain round
              icon-only button below 1000px (no room next to the price stats — mirrors
              the basket-icon circle in the mobile mockup), and a fixed-size text CTA
              at 1000px+ using the exact desktop spec (142×32, white fill, #AAAAAA
              1px border, 30px radius). Icon and label never show at the same time. */}
          {hasProducts && (
            <Fragment>
              {/* Always openable — an incomplete plateau is surfaced INSIDE the
                  recap modal (a warning + the disabled "Ajouter au panier"),
                  not by blocking entry to the recap itself. Seeing what's
                  incomplete needs the modal open, not a tooltip on a button
                  that's easy to miss on a small/mobile screen. */}
              {/* cart.svg now bakes in its own white circle background, so this
                  is just the icon itself — no extra button chrome/wrapper. */}
              <button
                onClick={() => setShoppingListOpen(true)}
                aria-label="Valider mon menu"
                class="min-[1000px]:hidden shrink-0 flex items-center justify-center border-0 bg-transparent p-0 cursor-pointer transition-opacity hover:opacity-90"
              >
                <span
                  class="inline-flex w-[36px] h-[36px] shrink-0 [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
                  dangerouslySetInnerHTML={{ __html: cartIcon }}
                />
              </button>
              <button
                onClick={() => setShoppingListOpen(true)}
                class="hidden min-[1000px]:flex shrink-0 items-center justify-center cursor-pointer bg-white hover:bg-[#F7F2E6] transition-colors border-2 border-[#AAAAAA] rounded-30px py-1 px-3 rounded-full"
              >
                <span class="text-[9px] font-[500] uppercase tracking-wide text-[#8D7A4E] whitespace-nowrap">
                  Valider mon menu
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
            incompleteComposableProducts={incompleteComposableProducts}
            onClose={() => setShoppingListOpen(false)}
            onValidate={() => {
              setShoppingListOpen(false);
              onConfirmCart?.();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
