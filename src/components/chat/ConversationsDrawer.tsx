import { h } from "preact";
import { useMemo, useState } from "preact/hooks";
import {
  ConversationSummary,
  fakeConversationTitle,
} from "../../api/conversations";

interface Props {
  open: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}

/**
 * Left drawer — "Discussions récentes" (search + title list), matching the
 * Carrefour Traiteur mock. Titles are fake placeholders for now.
 */
export function ConversationsDrawer({
  open,
  conversations,
  activeConversationId,
  onClose,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.map((c, i) => {
      const title = fakeConversationTitle(i);
      return { ...c, displayTitle: title };
    }).filter((c) => !q || c.displayTitle.toLowerCase().includes(q));
  }, [conversations, query]);

  if (!open) return null;

  return (
    <div class="absolute inset-0 z-40 flex" role="dialog" aria-modal="true" aria-label="Discussions récentes">
      <button
        type="button"
        class="absolute inset-0 bg-black/25 border-0 cursor-pointer"
        aria-label="Fermer"
        onClick={onClose}
      />
      <aside class="relative z-10 h-full w-[min(100%,320px)] md:w-[340px] bg-white shadow-[4px_0_24px_rgba(0,0,0,.12)] flex flex-col">
        <div class="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 class="m-0 text-[18px] md:text-[20px] font-semibold text-[#1A1A2E] tracking-[-0.01em]">
            Discussions récentes
          </h2>
          <button
            type="button"
            class="w-9 h-9 flex items-center justify-center bg-transparent border-0 text-[#1A1A2E] cursor-pointer text-[22px] leading-none hover:opacity-70"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div class="px-5 pb-3">
          <label class="relative block">
            <span class="sr-only">Rechercher</span>
            <input
              type="search"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Rechercher"
              class="w-full h-11 rounded-full border border-[#D8D5CF] bg-white pl-4 pr-11 text-[14px] text-[#1A1A2E] placeholder:text-[#9A958C] outline-none focus:border-[#C7B287]"
            />
            <span
              class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#9A958C]"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
              </svg>
            </span>
          </label>
        </div>

        <ul class="list-none m-0 px-5 pb-6 overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <li class="text-[14px] text-[#9A958C] py-3">Aucune discussion</li>
          ) : (
            rows.map((c) => {
              const active = c.conversation_id === activeConversationId;
              return (
                <li key={c.conversation_id} class="border-0">
                  <button
                    type="button"
                    class={`w-full text-left py-3.5 px-0 bg-transparent border-0 border-b border-[#EEEAE4] cursor-pointer text-[14px] md:text-[15px] leading-[1.35] ${
                      active ? "text-[#C7B287] font-semibold" : "text-[#1A1A2E] font-normal hover:text-[#C7B287]"
                    }`}
                    onClick={() => onSelect(c.conversation_id)}
                  >
                    {c.displayTitle}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>
    </div>
  );
}
