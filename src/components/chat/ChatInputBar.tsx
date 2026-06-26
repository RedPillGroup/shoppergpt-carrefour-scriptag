import { h } from 'preact';
import { useRef, useEffect } from 'preact/hooks';
import { SendHorizonal } from 'lucide-preact';

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
          class="w-[32px] h-[32px] md:w-[36px] md:h-[36px] bg-[#E2422B] border-0 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all hover:bg-[#C73A25] active:scale-[.93] disabled:bg-[#E8A99E] disabled:cursor-not-allowed"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          title="Envoyer"
        >
          <SendHorizonal size={15} color="white" strokeWidth={2.2} />
        </button>
      </div>
    </div>
  );
}
