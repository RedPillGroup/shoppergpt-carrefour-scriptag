import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { ALL_MENU_STEPS, StepSuggestionItem } from '../../types';

// Steps fully hidden from the toggle card (not even as a manual "add" option).
// Sauces is intentionally NOT here anymore — it's now a normal toggleable step,
// just never pre-selected by recommend_menu_steps (see info.py), same as
// Table & Déco.
const EXCLUDED_STEPS = new Set<string>([]);

interface Props {
  /** Recommended (preselected) steps from recommend_menu_steps. */
  items: StepSuggestionItem[];
  /** Fired whenever the selection changes (including on mount) so the current
   * selection can ride with the next chat message (see getClientState) — there is
   * no submit button, the user confirms by typing a normal message. */
  onChange: (selectedSteps: string[]) => void;
  /** Freezes the card once the conversation has moved on — kept visible (chat
   * history stays readable) but no longer interactive. */
  disabled?: boolean;
  /** "Valider" button — sends the current selection immediately as a chat message
   * instead of waiting for the user to type something. Hidden once disabled, same
   * as the "add a step" chips below. */
  onValidate?: () => void;
}

const ALL_TOGGLEABLE_STEPS = ALL_MENU_STEPS.filter(s => !EXCLUDED_STEPS.has(s));

export function StepToggleCard({ items, onChange, disabled = false, onValidate }: Props) {
  const recommended = new Set(items.map(i => i.step));
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_TOGGLEABLE_STEPS.map(s => [s, recommended.has(s)]))
  );
  // Freezes the card the instant "Valider" is clicked — the parent's `disabled` prop
  // only flips once the composed menu actually comes back (or a newer step card
  // appears), which lags behind the click by the whole compose_menu round-trip.
  // This local flag gives the same immediate feedback as clicking a store/mode pick.
  const [validated, setValidated] = useState(false);
  const frozen = disabled || validated;

  const onSteps = ALL_TOGGLEABLE_STEPS.filter(s => enabled[s]);
  const offSteps = ALL_TOGGLEABLE_STEPS.filter(s => !enabled[s]);

  useEffect(() => {
    onChange(onSteps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const toggle = (step: string) => {
    if (frozen) return;
    setEnabled(prev => ({ ...prev, [step]: !prev[step] }));
  };

  const handleValidate = () => {
    if (!onValidate) return;
    setValidated(true);
    onValidate();
  };

  return (
    <div class="mt-2 w-full max-w-full flex flex-col gap-1.5">
      <div class={`flex flex-wrap gap-1.5 p-2 ${frozen ? 'opacity-50' : ''}`}>
        {onSteps.map(step => (
          <button
            key={step}
            type="button"
            onClick={() => toggle(step)}
            disabled={frozen}
            class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold text-white bg-[#C7B287] ${
              frozen ? 'cursor-default' : 'cursor-pointer'
            }`}
          >
            <span>{step}</span>
            <span class="shrink-0 text-[12px] leading-none">✕</span>
          </button>
        ))}
      </div>

      {!frozen && onValidate && (
        <div class="px-2 flex">
          <button
            type="button"
            onClick={handleValidate}
            disabled={onSteps.length === 0}
            class="inline-flex items-center justify-center gap-1.5 p-2 px-4 rounded-xl font-semibold text-[12px] text-white bg-[#2E2E2E] cursor-pointer hover:bg-[#1A1A1A] active:scale-[.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Valider la sélection</span>
          </button>
        </div>
      )}

      {!frozen && offSteps.length > 0 && (
        <div class="mt-1 flex flex-col gap-1">
          <span class="text-[11px] text-[#6B7280]">Et si vous souhaitez vous pouvez ajouter :</span>
          <div class="flex flex-wrap gap-1.5 p-2">
            {offSteps.map(step => (
              <button
                key={step}
                type="button"
                onClick={() => toggle(step)}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium text-[#6B7280] bg-white border border-[#E8ECF0] cursor-pointer"
              >
                <span>{step}</span>
                <span class="shrink-0 text-[12px] leading-none text-[#C7B287]">+</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
