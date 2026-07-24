import { h } from "preact";
import { useMemo, useState } from "preact/hooks";
import { ConversationSummary } from "../../api/conversations";

interface Props {
  open: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
}

/**
 * Covers the chat column fully — "Discussions récentes" (search + title list).
 * Titles come from the API (event_type / first user question).
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
    return conversations
      .map((c) => ({
        ...c,
        displayTitle: (c.title || "Nouvelle conversation").trim(),
      }))
      .filter((c) => !q || c.displayTitle.toLowerCase().includes(q));
  }, [conversations, query]);

  if (!open) return null;

  return (
    <div
      class="absolute inset-0 z-50 flex"
      role="dialog"
      aria-modal="true"
      aria-label="Discussions récentes"
    >
      <aside class="relative z-10 h-full w-full bg-white flex flex-col border-r border-[#E8E4DC]">
        <div class="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 class="m-0 text-[20px] md:text-[22px] font-semibold text-[#1A1A2E] tracking-[-0.01em]">
            Discussions récentes
          </h2>
          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center bg-transparent border-0 text-[#1A1A2E] cursor-pointer text-[24px] leading-none hover:opacity-70"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div class="px-6 pb-4">
          <label class="relative block">
            <span class="sr-only">Rechercher</span>
            <input
              type="search"
              value={query}
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Rechercher"
              class="w-full h-12 rounded-full border border-[#D8D5CF] bg-white pl-5 pr-12 text-[15px] text-[#1A1A2E] placeholder:text-[#9A958C] outline-none focus:border-[#C7B287]"
            />
            <span
              class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9A958C]"
              aria-hidden="true"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
              </svg>
            </span>
          </label>
        </div>

        <ul class="list-none m-0 px-6 pb-8 overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <li class="text-[15px] text-[#9A958C] py-4">Aucune discussion</li>
          ) : (
            rows.map((c) => {
              const active = c.conversation_id === activeConversationId;
              return (
                <li key={c.conversation_id} class="border-0">
                  <button
                    type="button"
                    class={`w-full text-left py-4 px-0 bg-transparent border-0 border-b border-[#EEEAE4] cursor-pointer text-[15px] md:text-[16px] leading-[1.4] ${
                      active
                        ? "text-[#C7B287] font-semibold"
                        : "text-[#1A1A2E] font-normal hover:text-[#C7B287]"
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
