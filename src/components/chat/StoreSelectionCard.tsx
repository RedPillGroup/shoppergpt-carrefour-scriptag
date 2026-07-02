import { h } from 'preact';
import { useState } from 'preact/hooks';
import { StoreOptionItem } from '../../types';

interface Props {
  items: StoreOptionItem[];
  /** Clicking a store sends its name as a normal chat message (quick-reply
   * style) — no deferred sync, the click IS the confirmation. */
  onSelect: (storeName: string) => void;
  disabled?: boolean;
}

export function StoreSelectionCard({ items, onSelect, disabled = false }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const pick = (storeName: string) => {
    if (disabled || selected) return;
    setSelected(storeName);
    onSelect(storeName);
  };

  return (
    <div class={`mt-2 w-full max-w-full flex flex-col gap-1.5 ${disabled ? 'opacity-50' : ''}`}>
      {items.map(store => {
        const isSelected = selected === store.name;
        return (
          <button
            key={store.store_id}
            type="button"
            onClick={() => pick(store.name)}
            disabled={disabled || Boolean(selected)}
            class={`flex items-center w-full px-3.5 py-2 rounded-full border text-left text-[12px] ${
              isSelected
                ? 'bg-[#C7B287] border-[#C7B287] text-white font-semibold'
                : 'bg-white border-[#E8ECF0] text-[#6B7280]'
            } ${disabled || selected ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <span class="truncate">
              {store.name} ({store.distance_km.toFixed(1)} km) : {store.modes.join(' et ')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
