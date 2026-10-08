import { h } from 'preact';

/**
 * Shown instead of the assistant when the widget is built with
 * SHOPPERGPT_DISABLED=1 (e.g. while a client's production contract is pending).
 *
 * It looks like the chat — title, message, composer — but every control is
 * disabled and nothing here talks to the backend: no session, no menu sync, no
 * store lookup. Re-enabling is a Vercel env change + redeploy, no code change.
 */
export function DisabledNotice() {
  return (
    <div class="flex flex-col h-full min-h-0 bg-[#FAF9F7]" role="status" aria-live="polite">
      <div class="flex flex-1 min-h-0 flex-col items-center justify-center gap-3 px-6 text-center">
        <span class="font-['Satisfy'] font-normal text-[#C7B287] text-[40px] leading-none">
          Cathia
        </span>
        <p class="m-0 max-w-[420px] text-[16px] leading-relaxed text-[#1A1A2E]">
          Cathia n&apos;est pas encore disponible. Revenez très bientôt pour composer vos menus avec
          elle !
        </p>
      </div>

      <div class="shrink-0 px-4 pb-4 md:px-8 md:pb-6">
        <div class="mx-auto flex h-12 w-full max-w-[720px] items-center gap-2 rounded-full border border-[#D8D5CF] bg-white/60 pl-5 pr-1.5 opacity-60">
          <input
            type="text"
            disabled
            aria-label="Votre message (indisponible)"
            placeholder="Je voudrais..."
            class="min-w-0 flex-1 cursor-not-allowed border-0 bg-transparent text-[16px] text-[#1A1A2E] outline-none placeholder:text-[#B0A898]"
          />
          <button
            type="button"
            disabled
            aria-label="Envoyer (indisponible)"
            class="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-full border-0 bg-[#C7B287] p-0 text-white"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
