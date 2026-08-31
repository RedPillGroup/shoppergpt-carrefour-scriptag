import { h } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { ConversationSummary } from '../../api/conversations';
import newChatIcon from '../../assets/icons/new-chat.svg?raw';

interface Props {
  open: boolean;
  conversations: ConversationSummary[];
  activeConversationId: string | null;
  onClose: () => void;
  onSelect: (conversationId: string) => void;
  /** Start a fresh thread — clears the chat and the panel, keeps the store. */
  onNewConversation: () => void;
}

/** "31 juil., 14:32" — always shows both date and time (never just the time, even for
 * today) so two conversations on different days are never shown with the same
 * ambiguous label. Kept as a plain short date rather than "Aujourd'hui"/"Hier" so the
 * label width stays consistent from row to row. */
function formatConversationDate(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const day = date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Paris'
  });
  const time = date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris'
  });
  return `${day}, ${time}`;
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
  onNewConversation
}: Props) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .map(c => ({
        ...c,
        displayTitle: (c.title || 'Nouvelle conversation').trim(),
        displayDate: formatConversationDate(c.updated_at || c.created_at)
      }))
      .filter(c => !q || c.displayTitle.toLowerCase().includes(q));
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
        <div class="flex items-center justify-end px-6 pt-5">
          <button
            type="button"
            class="w-10 h-10 flex items-center justify-center bg-transparent border-0 text-[#1A1A2E] cursor-pointer text-[24px] leading-none hover:opacity-70 shrink-0"
            aria-label="Fermer"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div class="px-6 pt-2 pb-6">
          {/* Same pointer-events-none / full-cover hit-layer pattern as the drawer's
              own trigger in ChatInputBar: an SVG only hit-tests where it's painted,
              so leaving it in the hit path makes the cursor flicker as the pointer
              crosses its transparent parts. */}
          <button
            type="button"
            class="relative inline-flex items-center gap-2.5 bg-transparent border-0 p-0 cursor-pointer text-[#1A1A2E] hover:opacity-70 [&_*]:cursor-pointer"
            onClick={onNewConversation}
          >
            <span
              class="inline-flex w-[18px] h-[18px] items-center justify-center pointer-events-none [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: newChatIcon }}
            />
            <span class="text-[16px] font-semibold tracking-[-0.01em] pointer-events-none">
              Nouvelle discussion
            </span>
            <span class="absolute inset-0 z-10 cursor-pointer" aria-hidden="true" />
          </button>
        </div>

        <div class="px-6 pb-6">
          <label class="relative block">
            <span class="sr-only">Rechercher</span>
            <input
              type="search"
              value={query}
              onInput={e => setQuery((e.target as HTMLInputElement).value)}
              placeholder="Rechercher"
              class="w-full h-12 rounded-full border border-[#D8D5CF] bg-white pl-5 pr-12 text-[16px] text-[#1A1A2E] placeholder:text-[#9A958C] outline-none focus:border-[#C7B287]"
            />
            <span
              class="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9A958C]"
              aria-hidden="true"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" stroke-linecap="round" />
              </svg>
            </span>
          </label>
        </div>

        <h2 class="m-0 px-6 pb-3 text-[16px] font-semibold text-[#1A1A2E] tracking-[-0.01em]">
          Discussions récentes
        </h2>

        <ul class="list-none m-0 px-6 pb-8 overflow-y-auto flex-1">
          {rows.length === 0 ? (
            <li class="text-[16px] text-[#9A958C] py-3">Aucune discussion</li>
          ) : (
            rows.map(c => {
              const active = c.conversation_id === activeConversationId;
              return (
                <li key={c.conversation_id} class="border-0">
                  <button
                    type="button"
                    class={`w-full flex items-baseline gap-3 text-left py-3 px-0 bg-transparent border-0 cursor-pointer text-[16px] leading-[1.4] ${
                      active
                        ? 'text-[#C7B287] font-semibold'
                        : 'text-[#1A1A2E] font-normal hover:text-[#C7B287]'
                    }`}
                    onClick={() => onSelect(c.conversation_id)}
                  >
                    <span class="shrink-0 w-24 text-[13px] text-[#9A958C]">{c.displayDate}</span>
                    <span class="min-w-0 truncate">{c.displayTitle}</span>
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
