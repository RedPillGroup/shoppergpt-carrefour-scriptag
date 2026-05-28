import { h } from 'preact';
import { EventRequirements } from '../../types';
import { getCurrencyParts } from '../../utils/currency';
import { getStepIcon } from './icons';

interface Props {
  requirements: EventRequirements;
}

function CurrencyValue({ value, fallback = '—' }: { value: number | undefined; fallback?: string }) {
  const parts = getCurrencyParts(value);
  if (!parts) {
    return (
      <span class="inline-flex items-end gap-0.5 tabular-nums">
        <span class="text-[11px] md:text-[12px] leading-none">{fallback}</span>
        <span class="text-[8px] md:text-[9px] leading-none pb-[1px]">€</span>
      </span>
    );
  }

  return (
    <span class="inline-flex items-end gap-0.5 tabular-nums">
      <span class="text-[11px] md:text-[12px] leading-none">{parts.whole}</span>
      <span class="text-[8px] md:text-[9px] leading-none pb-[1px]">,{parts.fraction}</span>
      <span class="text-[8px] md:text-[9px] leading-none pb-[1px]">€</span>
    </span>
  );
}

export function EventRequirementsPanel({ requirements }: Props) {
  const adults = requirements.guests_adults;
  const kids = requirements.guests_kids;
  const costTotal: number | undefined = undefined;
  const pricePerPerson: number | undefined = undefined;

  const activeSteps = (requirements.menu_steps ?? [])
    .map(step => ({ label: step, icon: getStepIcon(step, 22) }))
    .filter((cat): cat is { label: string; icon: h.JSX.Element } => cat.icon !== null);
  const hasSteps = activeSteps.length > 0;

  return (
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-y-auto bg-[#FAF9F7] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db] flex items-center justify-center">
        <div class="text-center px-6 py-10">
          <div class="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F4EFE5] flex items-center justify-center text-[#C7B287]">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="22" height="22">
              <path d="M3 12h18M3 12c0 4.97 4.03 9 9 9s9-4.03 9-9" />
              <path d="M12 3v4M8 5l1.5 2M16 5l-1.5 2" />
            </svg>
          </div>
          <p class="m-0 text-sm text-[#9A8C78] leading-relaxed max-w-[220px] mx-auto">
            Les produits de votre menu apparaîtront ici une fois sélectionnés.
          </p>
        </div>
      </div>

      {/* Category tab bar — slides in only after the user has confirmed the course structure */}
      <div
        class={`border-t border-[#E8ECF0] bg-white shrink-0 overflow-hidden transition-all duration-500 ease-out ${
          hasSteps ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
        }`}
      >
        <div class="flex items-stretch overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {activeSteps.map(cat => (
            <button
              key={cat.label}
              class="flex-1 min-w-[60px] flex flex-col items-center gap-2 py-3 px-1 border-0 bg-transparent text-[#B0A898] cursor-pointer hover:text-[#C7B287] transition-colors"
            >
              <span class="h-[22px] w-[22px] flex items-center justify-center shrink-0">
                {cat.icon}
              </span>
              <span class="text-[9px] md:text-[10px] uppercase tracking-wide leading-none">
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div class="grid grid-cols-[1.3fr_1fr] border-t border-[#E8ECF0] shadow-[0_-4px_14px_rgba(17,24,39,0.07)] shrink-0">
        <div class="bg-[#F3F1EE] px-4 py-3 md:px-5 md:py-3.5 flex flex-col gap-2.5">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Nombre de convives
            </span>
            <span class="text-[10px] md:text-[11px] text-[#8D7A4E] text-right">
              <span class="text-[11px] md:text-[12px]">{adults ?? '—'}</span> adultes{' '}
              <span class="text-[11px] md:text-[12px]">{kids ?? '—'}</span> enfants
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-[#8A8070] shrink-0">
              Prix par personne
            </span>
            <span class="text-[#8D7A4E]">
              <CurrencyValue value={pricePerPerson} fallback="—" />
            </span>
          </div>
        </div>

        <div class="bg-[#C7B287] text-white px-4 py-3 md:px-5 md:py-3.5 flex flex-col gap-2.5">
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
              Budget
            </span>
            <span class="text-white">
              <CurrencyValue value={requirements.budget} fallback="—" />
            </span>
          </div>
          <div class="flex items-baseline justify-between gap-2">
            <span class="text-[10px] md:text-[11px] font-semibold uppercase tracking-wide text-[#F7F2E6] shrink-0">
              Coût total
            </span>
            <span class="text-white">
              <CurrencyValue value={costTotal} fallback="—" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
