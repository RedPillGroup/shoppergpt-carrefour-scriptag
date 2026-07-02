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
    <div class={`mt-2 w-full max-w-full flex flex-wrap gap-1.5 p-2 ${disabled ? 'opacity-50' : ''}`}>
      {item.modes.map(mode => {
        const isSelected = selected === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => pick(mode)}
            disabled={disabled || Boolean(selected)}
            class={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold ${
              isSelected
                ? 'bg-[#C7B287] text-white'
                : 'bg-white border border-[#E8ECF0] text-[#6B7280]'
            } ${disabled || selected ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span>{MODE_LABELS[mode] ?? mode}</span>
          </button>
        );
      })}
    </div>
  );
}
