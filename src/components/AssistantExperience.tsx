import { h } from 'preact';
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShopperStore } from '../store';
import { EventRequirements, Message, Product } from '../types';
import { useChatAnswer } from '../hooks/useChatAnswer';
import { fetchServerMenu, menuResponseToPanelState } from '../api/menu';
import { getMockScreen } from '../api/config';
import { EditorialPanel } from './panel/EditorialPanel';
import { MessageBubble } from './chat/MessageBubble';
import { TypingIndicator } from './chat/TypingIndicator';
import { ComposingIndicator } from './chat/ComposingIndicator';
import { StreamingBubble } from './chat/StreamingBubble';
import { ChatInputBar } from './chat/ChatInputBar';
import { MenuBuilderPanel } from './panel/MenuBuilderPanel';
import { ProductDetailModal } from './panel/ProductDetailModal';
import downIcon from '../assets/icons/down.svg?raw';

export function AssistantExperience() {
  const { messages, addMessage, isLoading, setIsLoading, jwt, setJwt, sessionId, selectedProduct, setSelectedProduct, store } = useShopperStore();
  const shouldReduceMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  // Set from the backend's early `event: phase` when a long tool (compose_menu)
  // starts — drives the staged "Je compose…" indicator. Reset each turn.
  const [composePhase, setComposePhase] = useState<string | null>(null);
  const [eventRequirements, setEventRequirements] = useState<EventRequirements>({});
  const [eventScreenEnabled, setEventScreenEnabled] = useState(false);
  const [productsByStep, setProductsByStep] = useState<Record<string, Product[]>>({});
  const [menuQuantities, setMenuQuantities] = useState<Record<string, number>>({});
  const [panelSyncing, setPanelSyncing] = useState(false);
  // Mobile-only: the product/menu panel sits on top and the chat below (reversed
  // from desktop's side-by-side layout — see the drag-handle chevron between them).
  // Collapsed (default) gives the chat most of the height; expanded flips the ratio
  // so the panel can show a full menu without the user scrolling a tiny viewport.
  const [mobilePanelExpanded, setMobilePanelExpanded] = useState(false);
  // Mobile-only: while the chat input is focused, show ONLY the chat (the
  // panel shrinks to 0 — see the chat pane's flexBasis below) instead of
  // trying to still share the screen with the panel while iOS's keyboard +
  // its accessory bar eat a big chunk of it. Simpler to just not compete for
  // space at all than to fight that OS chrome pixel by pixel.
  const [chatFocused, setChatFocused] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const jwtRef = useRef(jwt);
  const sessionIdRef = useRef(sessionId);
  const menuRevisionRef = useRef(0);
  const menuEtagRef = useRef<string | null>(null);
  const productsByStepRef = useRef(productsByStep);
  const menuQuantitiesRef = useRef(menuQuantities);
  const panelSyncedThisTurnRef = useRef(false);
  const stepSuggestionRef = useRef<Message['stepSuggestion']>(undefined);
  // Live selection from the interactive step-toggle card — no submit button, this
  // rides with the user's next chat message (see getClientState / sync_state).
  const pendingStepSelectionRef = useRef<string[] | null>(null);
  const storeOptionsRef = useRef<Message['storeOptions']>(undefined);
  const modeOptionsRef = useRef<Message['modeOptions']>(undefined);
  const storeResolvedRef = useRef(false);
  jwtRef.current = jwt;
  sessionIdRef.current = sessionId;
  productsByStepRef.current = productsByStep;
  menuQuantitiesRef.current = menuQuantities;

  const applyPanelState = useCallback((panel: ReturnType<typeof menuResponseToPanelState>) => {
    setProductsByStep(panel.productsByStep);
    setMenuQuantities(panel.menuQuantities);
    setEventRequirements(panel.eventRequirements);
    menuRevisionRef.current = panel.menuRevision;
    if (panel.hasMenu) {
      setEventScreenEnabled(true);
    }
    // Store selected server-side (e.g. by the assistant via manage_store) → reflect it
    // in the store + notify the host page so its header updates (sandbox navbar / Carrefour).
    if (panel.store && panel.store.store_id) {
      const cur = useShopperStore.getState().store;
      if (!cur || String(cur.store_id) !== String(panel.store.store_id) || cur.mode !== panel.store.mode) {
        useShopperStore.getState().setStore(panel.store);
        window.dispatchEvent(
          new CustomEvent("shoppergpt:change_shop", {
            detail: {
              store_id: panel.store.store_id,
              store_name: panel.store.store_name,
              mode: panel.store.mode,
            },
          })
        );
      }
    }
  }, []);

  /** Authoritative panel sync from MongoDB (GET /menu + ETag). */
  const syncPanelFromServer = useCallback(async (force = false) => {
    const token = sessionIdRef.current;
    if (!token) return;
    setPanelSyncing(true);
    try {
      const { data, etag, notModified } = await fetchServerMenu(token, {
        ifNoneMatch: force ? null : menuEtagRef.current,
      });
      if (etag) menuEtagRef.current = etag;
      if (notModified || !data) return;
      applyPanelState(menuResponseToPanelState(data));
    } catch (err) {
      console.warn('[shopper-gpt] GET /menu failed:', err);
    } finally {
      setPanelSyncing(false);
    }
  }, [applyPanelState]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  useEffect(() => {
    // Skip the real GET /menu sync in mock mode — it would immediately
    // overwrite the canned data below with the (empty) actual server state.
    if (sessionId && !getMockScreen()) void syncPanelFromServer();
  }, [sessionId, syncPanelFromServer]);

  // Dev/testing only — jump straight to a MenuBuilderPanel screen with canned
  // data via data-mock-screen="event"|"products" on the script tag, instead of
  // re-chatting through postcode → event → compose on every reload. Never set
  // in production embeds (see getMockScreen).
  useEffect(() => {
    const mock = getMockScreen();
    if (!mock) return;

    setEventRequirements({
      event_type: 'anniversaire',
      event_date: '27 août 2026',
      guests_adults: 10,
      guests_kids: 0,
      budget: 200,
      visual_theme: 'anniv',
      menu_steps: ['Apéritifs', 'Plats', 'Fromages', 'Desserts', 'Boissons', 'Pains'],
    });
    setEventScreenEnabled(true);

    if (mock === 'products') {
      const mk = (id: string, name: string, price: number, step: string): Product => ({
        id,
        name,
        price,
        persons: 4,
        image: '',
        menu_step: step,
      });
      setProductsByStep({
        'Apéritifs': [
          mk('mock-1', '6 Verrines tartare de tomates et thon', 7.95, 'Apéritifs'),
          mk('mock-2', '4 verrines noix de Saint-Jacques et tartare basilic', 4.99, 'Apéritifs'),
        ],
        'Plats': [
          mk('mock-3', 'Filet de Bœuf Wellington en croûte', 32.9, 'Plats'),
          mk('mock-4', 'Gratin dauphinois', 3.0, 'Plats'),
        ],
        'Fromages': [mk('mock-5', 'Plateau de 4 fromages', 10.9, 'Fromages')],
        'Desserts': [mk('mock-6', 'Tarte aux fraises', 9.99, 'Desserts')],
        'Boissons': [mk('mock-7', 'Macarons framboises', 12.5, 'Boissons')],
        'Pains': [mk('mock-8', 'Macarons', 19.0, 'Pains')],
      });
      setMenuQuantities({
        'mock-1': 6,
        'mock-2': 0,
        'mock-3': 2,
        'mock-4': 10,
        'mock-5': 1,
        'mock-6': 2,
        'mock-7': 0,
        'mock-8': 0
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshot the current panel (products + user-adjusted quantities) so the
  // backend can sync manual edits before the LLM answers. Read at request time.
  const getClientState = (): Record<string, unknown> | null => {
    const products = Object.entries(productsByStepRef.current).flatMap(([step, list]) =>
      list.map(p => {
        const qty = menuQuantitiesRef.current[p.id] ?? 0;
        return {
          sku: p.id,
          menu_step: step,
          qty,
          recommended_quantity: qty,
        };
      }),
    );
    const base: Record<string, unknown> = { menu_revision: menuRevisionRef.current };
    if (pendingStepSelectionRef.current) {
      base.menu_steps = pendingStepSelectionRef.current;
      // One-shot: consumed by this request only, so a stale snapshot can't later
      // overwrite a more recent server-side menu_steps change (e.g. via compose_menu).
      pendingStepSelectionRef.current = null;
    }
    return products.length > 0 ? { ...base, products } : base;
  };

  useChatAnswer(question, jwt, {
    onJwt: newJwt => {
      setJwt(newJwt);
      jwtRef.current = newJwt;
    },
    onPhase: phase => setComposePhase(phase),
    onToken: token => setStreamingText(prev => prev + token),
    onMeta: meta => {
      const needsSync =
        Boolean(meta.sync_conflict) ||
        meta.menu_changed === true ||
        meta.store_changed === true ||
        (typeof meta.menu_revision === 'number' && meta.menu_revision > menuRevisionRef.current);
      if (needsSync) {
        panelSyncedThisTurnRef.current = true;
        void syncPanelFromServer(true);
      }
      if (meta.step_suggestion?.steps?.length) {
        stepSuggestionRef.current = meta.step_suggestion.steps;
      }
      if (meta.store_options?.stores?.length) {
        storeOptionsRef.current = meta.store_options.stores;
      }
      if (meta.mode_options?.name) {
        modeOptionsRef.current = meta.mode_options;
      }
      // select_store ran this turn and did NOT come back needing a mode → the
      // selection was actually finalized this turn (as opposed to store_changed
      // alone, which also fires for a needs_mode round-trip).
      if (meta.store_changed && !meta.mode_options) {
        storeResolvedRef.current = true;
      }
    },
    onComplete: fullText => {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
        stepSuggestion: stepSuggestionRef.current,
        storeOptions: storeOptionsRef.current,
        modeOptions: modeOptionsRef.current,
        storeResolved: storeResolvedRef.current || undefined
      });
      stepSuggestionRef.current = undefined;
      storeOptionsRef.current = undefined;
      modeOptionsRef.current = undefined;
      storeResolvedRef.current = false;
      setStreamingText('');
      setComposePhase(null);
      setIsLoading(false);
      setQuestion(null);
      if (!panelSyncedThisTurnRef.current) {
        void syncPanelFromServer();
      }
      panelSyncedThisTurnRef.current = false;
    },
    onError: msg => {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ Une erreur est survenue : ${msg}`,
        timestamp: new Date()
      });
      stepSuggestionRef.current = undefined;
      storeOptionsRef.current = undefined;
      modeOptionsRef.current = undefined;
      storeResolvedRef.current = false;
      setStreamingText('');
      setComposePhase(null);
      setIsLoading(false);
      setQuestion(null);
    }
  }, getClientState);

  const send = useCallback((text?: string) => {
    const t = (text ?? input).trim();
    if (!t || isLoading) return;
    addMessage({ id: Date.now().toString(), role: 'user', content: t, timestamp: new Date() });
    setInput('');
    setStreamingText('');
    setComposePhase(null);
    setIsLoading(true);
    panelSyncedThisTurnRef.current = false;
    stepSuggestionRef.current = undefined;
    storeOptionsRef.current = undefined;
    modeOptionsRef.current = undefined;
    storeResolvedRef.current = false;
    // Mobile: sending a message means the user wants to keep chatting — retract
    // the expanded panel so the chat (and their own message) is visible again,
    // instead of leaving them staring at the still-expanded product view.
    setMobilePanelExpanded(false);
    setQuestion(t);
  }, [input, isLoading, addMessage, setIsLoading]);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }, [send]);

  const handleQuantityChange = useCallback((productId: string, delta: number) => {
    setMenuQuantities(prev => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  }, []);

  const isStreaming = isLoading && streamingText.length > 0;
  const isWaiting = isLoading && streamingText.length === 0;

  const noStoreGreeting =
    "Je suis là pour vous aider à composer le menu parfait pour votre événement ✨\n\n" +
    "Pour commencer... quel est votre code postal ? Chaque magasin Carrefour propose sa propre " +
    "sélection traiteur — je trouverai le plus proche de chez vous pour vous composer un menu sur mesure.";
  const storeGreeting =
    "Je suis là pour vous aider à composer le menu parfait pour votre événement ✨\n\n" +
    "Pour commencer... quel est l'heureux événement que vous souhaitez célébrer ?";
  const initialGreeting: import('../types').Message = {
    id: 'w1',
    role: 'assistant',
    content: store ? storeGreeting : noStoreGreeting,
    timestamp: new Date(0),
  };

  return (
    <div class="relative flex flex-col h-full min-h-0 bg-[#FAF9F7]">
      <div class="flex flex-col md:grid flex-1 md:grid-rows-1 md:grid-cols-[38%_1fr] overflow-hidden min-h-0">
        <div
          class="relative flex order-3 md:order-none md:col-start-1 flex-col bg-white border-b md:border-b-0 md:border-r border-[#E8ECF0] min-h-0 transition-[flex-basis] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
          style={{
            flexGrow: 0,
            flexShrink: 0,
            // Focused: chat takes 100% (panel's own flexGrow:1/flexBasis:0
            // below just yields to 0 automatically — no separate change needed
            // there). Collapsed: chat takes the bulk of the height (a %, in
            // sync with the panel's complementary flexGrow). Expanded: shrunk
            // to a fixed px height too small for the message list, so it
            // visually disappears — ChatInputBar (shrink-0) still forces
            // itself to its full intrinsic height, keeping the input + mic
            // reachable. All plain lengths (not 'auto'/a flexGrow toggle), so
            // the transition interpolates smoothly.
            flexBasis: chatFocused ? '100%' : mobilePanelExpanded ? '64px' : '60%',
          }}
        >
          {/* Mobile-only "expand" trigger — sits at the chat pane's own top edge
              (the seam with the panel above), extending down into the chat pane's
              own bounds only, so it never needs to reach over into the panel's
              stacking context. The "retract" handle for the expanded state lives
              inside MenuBuilderPanel instead (see its mobileExpanded/onRetractMobile
              props) — that direction needs to sit within the PANEL's own bounds,
              which this chat-pane child can't safely do (fighting the panel
              footer's z-10 for stacking is what caused it to render underneath).
              Hidden on desktop and once the panel is already expanded (the panel
              itself takes over showing the retract handle then). */}
          {eventScreenEnabled && !mobilePanelExpanded && (
            <button
              type="button"
              class="hidden max-md:flex absolute top-0 left-1/2 z-10 cursor-pointer"
              onClick={() => setMobilePanelExpanded(true)}
              aria-label="Agrandir le menu"
              aria-expanded={false}
              dangerouslySetInnerHTML={{ __html: downIcon }}
            />
          )}

          <div
            class={`flex flex-1 overflow-y-auto min-h-0 flex-col [scroll-behavior:smooth] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db] ${
              // A margin (not padding) — this shifts the scrollable box's own top
              // edge down below the drag handle's visible half, so its own
              // overflow clipping keeps EVERY message (not just the first one)
              // from ever scrolling behind the handle. Padding alone only
              // guarded the very first message; anything scrolled up from
              // further down the list had no such protection. Desktop doesn't
              // render the handle at all, so no offset needed there. Skipped
              // while expanded: this pane is squeezed down to just fit
              // ChatInputBar then (see flexBasis '64px' above) — adding 32px of
              // margin on top of that pushed the whole pane taller than intended,
              // leaving a sliver of chat visible instead of it being fully hidden
              // behind the panel, and shoving the input bar down with it.
              eventScreenEnabled && !mobilePanelExpanded ? 'mt-8 md:mt-0' : ''
            }`}
          >
            {/* Standalone header greeting — separate from the initialGreeting
                MessageBubble below. Only makes sense before the conversation has
                actually started, so it animates out once the user sends anything
                (AnimatePresence handles the exit; a plain `&&` would just yank it
                away with no transition). */}
            <AnimatePresence initial={false}>
              {messages.length === 0 && (
                <motion.div
                  class="shrink-0 overflow-hidden px-5 md:px-8"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.998 }}
                  animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1, height: 'auto' }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: 0.02 }
                  }
                >
                  <p class="m-0 pt-3 pb-5 md:py-10 font-normal text-[#C7B287] text-base md:text-lg leading-[1.45]">
                    Bonjour et bienvenue, je suis{' '}
                    <span class="font-['Satisfy'] font-normal text-[#C7B287] text-base md:text-xl">Cathia</span> votre agent
                    intelligent traiteur. Que puis-je faire pour vous&nbsp;?
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div
              class={`shrink-0 px-3.5 pb-3 md:px-5 md:pb-4 flex flex-col gap-0.5 ${
                messages.length === 0 ? '' : 'pt-4 md:pt-6'
              }`}
            >
              {/* Initial greeting — rendered outside the messages array so it stays
                  reactive to store state without polluting chat history. */}
              <MessageBubble
                key={initialGreeting.id + (store ? '-store' : '-nostore')}
                message={initialGreeting}
                showSender={true}
                fadeInOnMount={true}
                fadeInDelay={0.1}
              />
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  showSender={
                    m.role === 'assistant' && i > 0 && messages[i - 1].role !== 'assistant'
                  }
                  fadeInOnMount={false}
                  fadeInDelay={0}
                  stepSelectionDisabled={
                    // A newer step-toggle card supersedes this one, OR the menu has
                    // actually been composed since — NOT merely "a newer message
                    // exists" (the user may have asked something unrelated in the
                    // meantime and should still be able to adjust steps afterwards).
                    messages.slice(i + 1).some(msg => msg.stepSuggestion) ||
                    Object.keys(productsByStep).length > 0
                  }
                  onStepSelectionChange={steps => {
                    pendingStepSelectionRef.current = steps;
                  }}
                  onValidateSteps={() => send('Ces étapes me conviennent, vous pouvez composer le menu.')}
                  choiceCardsDisabled={
                    // Same principle as stepSelectionDisabled above: only freeze once
                    // the flow has actually moved past THIS card (a newer store/mode
                    // card superseded it, or its own selection got resolved) — deliberately
                    // NOT based on the globally currently-selected store, since that stays
                    // true forever after the FIRST resolution and would freeze every later
                    // re-generated card (e.g. after "je veux en choisir un autre") too.
                    messages.slice(i + 1).some(msg => msg.storeOptions || msg.modeOptions || msg.storeResolved)
                  }
                  onSelectStore={storeName => send(storeName)}
                  onSelectMode={modeLabel => send(modeLabel)}
                />
              ))}
              {isWaiting && (composePhase ? <ComposingIndicator /> : <TypingIndicator />)}
              {isStreaming && <StreamingBubble text={streamingText.replace(/__NEWLINE__/g, '\n')} />}
            </div>

            <div ref={bottomRef} />
          </div>

          <ChatInputBar
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSend={() => send()}
            onKeyDown={handleKey}
            // Mobile: while typing, show only the chat (see chatFocused above)
            // instead of fighting the iOS keyboard + accessory bar for space.
            // Also drop any panel expansion so the layout returns to normal
            // collapsed proportions once focus/typing is done.
            onFocus={() => {
              setChatFocused(true);
              setMobilePanelExpanded(false);
            }}
            onBlur={() => setChatFocused(false)}
          />
        </div>

        <div
          class="order-1 md:order-none md:col-start-2 flex flex-col overflow-hidden min-h-0"
          style={{ flexGrow: 1, flexShrink: 1, flexBasis: 0 }}
        >
          {eventScreenEnabled ? (
            <MenuBuilderPanel
              requirements={eventRequirements}
              productsByStep={productsByStep}
              quantities={menuQuantities}
              onQuantityChange={handleQuantityChange}
              syncing={panelSyncing}
              mobileExpanded={mobilePanelExpanded}
              onRetractMobile={() => setMobilePanelExpanded(false)}
            />
          ) : (
            <EditorialPanel onSelect={q => send(q)} />
          )}
        </div>
      </div>

      {/* Product detail modal — rendered above everything else inside the widget */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetailModal
            productId={selectedProduct.id}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
