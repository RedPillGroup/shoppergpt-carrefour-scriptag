import { h } from 'preact';
import { useState } from 'preact/hooks';
import { ModeOptions } from '../../types';

const MODE_LABELS: Record<string, string> = {
  retrait: 'Retrait en magasin',
  drive: 'Drive',
  livraison: 'Livraison',
};

interface Props {
  item: ModeOptions;
  /** Clicking a mode sends its label as a normal chat message (quick-reply style). */
  onSelect: (modeLabel: string) => void;
  disabled?: boolean;
}

export function ModeSelectionCard({ item, onSelect, disabled = false }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const pick = (mode: string) => {
    if (disabled || selected) return;
    setSelected(mode);
    onSelect(MODE_LABELS[mode] ?? mode);
  };

  return (
    <div class={`mt-2 w-full max-w-full flex flex-col gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      {item.modes.map(mode => {
        const isSelected = selected === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => pick(mode)}
            disabled={disabled || Boolean(selected)}
            class={`flex items-center w-full px-3.5 py-2 rounded-full border text-left text-[12px] ${
              isSelected
                ? 'bg-[#C7B287] border-[#C7B287] text-white font-semibold'
                : 'bg-white border-[#E8ECF0] text-[#6B7280]'
            } ${disabled || selected ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span class="truncate">{MODE_LABELS[mode] ?? mode}</span>
          </button>
        );
      })}
    </div>
  );
}
