import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';

interface Props {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
}

export function ChatInputBar({ input, isLoading, onInputChange, onSend, onKeyDown }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  return (
    <div class="py-2.5 px-3.5 md:py-3.5 md:px-[18px] border-t border-[#E8ECF0] flex items-center gap-1.5 md:gap-2 shrink-0 bg-white">
      <div class="flex-1 bg-[#F5F3F0] rounded-3xl min-h-9 md:min-h-10 px-1.5 py-1 flex items-center gap-1">
        <textarea
          ref={textareaRef}
          class="flex-1 bg-transparent border-0 py-1.5 px-2.5 md:px-3 text-[13px] md:text-[13.5px] text-[#1A1A2E] resize-none outline-none leading-[1.4] max-h-[90px] min-h-0 overflow-y-auto placeholder:text-[#B0A898]"
          rows={1}
          placeholder="Je voudrais..."
          value={input}
          onInput={e => onInputChange((e.target as HTMLTextAreaElement).value)}
          onKeyDown={onKeyDown}
        />

        <button
          class="w-[30px] h-[30px] md:w-[34px] md:h-[34px] bg-transparent text-[#C7B287] border-0 rounded-none flex items-center justify-center cursor-pointer shrink-0 transition-all hover:text-[#B79B69] active:text-[#A78958] active:scale-[.93] disabled:text-[#9CA3AF] disabled:cursor-not-allowed"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          title="Envoyer"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="13"
            height="13"
            class="md:w-[15px] md:h-[15px]"
          >
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
