import { h } from 'preact';
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShopperStore } from '../store';
import { ALL_MENU_STEPS, EventRequirements, MenuStep, Message, Product } from '../types';
import { useChatAnswer } from '../hooks/useChatAnswer';
import { adjustStepQuantities, fetchServerMenu, menuResponseToPanelState, suggestProducts, syncMenuState } from '../api/menu';
import { confirmCart } from '../api/cart';
import { getEnv, getInitialSessionId, getMockScreen } from '../api/config';
import { dispatchCartUpdated } from '../events';
import {
  fetchConversation,
  fetchConversations
} from '../api/conversations';
import { EditorialPanel } from './panel/EditorialPanel';
import { MessageBubble } from './chat/MessageBubble';
import { TypingIndicator } from './chat/TypingIndicator';
import { ComposingIndicator } from './chat/ComposingIndicator';
import { StreamingBubble } from './chat/StreamingBubble';
import { ChatInputBar } from './chat/ChatInputBar';
import { ConversationsDrawer } from './chat/ConversationsDrawer';
import { MenuBuilderPanel } from './panel/MenuBuilderPanel';
import { ProductDetailModal } from './panel/ProductDetailModal';
import { ComposeProductModal } from './panel/ComposeProductModal';
import downIcon from '../assets/icons/+(down).svg?raw';

export function AssistantExperience() {
  const {
    messages,
    addMessage,
    setMessages,
    isLoading,
    setIsLoading,
    jwt,
    setJwt,
    sessionId,
    conversationId,
    setConversationId,
    conversations,
    setConversations,
    selectedProduct,
    setSelectedProduct,
    store
  } = useShopperStore();
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
  const [conversationsOpen, setConversationsOpen] = useState(false);
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
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const jwtRef = useRef(jwt);
  const sessionIdRef = useRef(sessionId);
  const menuRevisionRef = useRef(0);
  const menuEtagRef = useRef<string | null>(null);
  const productsByStepRef = useRef(productsByStep);
  const menuQuantitiesRef = useRef(menuQuantities);
  const panelSyncedThisTurnRef = useRef(false);
  // Tracks an in-flight syncPanelFromServer() triggered by the PREVIOUS turn's
  // meta (see onMeta below). getClientState() reads menuRevisionRef synchronously,
  // so if the user edits the panel and sends a new message while that fetch is
  // still in flight, the request would go out tagged with the OLD revision —
  // the backend then rejects the whole edit as stale and silently reverts the
  // panel to server state, discarding the user's just-made selection. Awaiting
  // this before a send closes that race.
  const pendingPanelSyncRef = useRef<Promise<void> | null>(null);
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
    // Server-driven scroll: when THIS sync changes exactly one step (a quantity, an
    // addition, a removal — whatever tool produced it), bring that step into view.
    // Diffing what actually changed beats instrumenting each backend tool: it covers
    // tools that don't exist yet, and compose/optimize exclude themselves naturally
    // (they touch several steps → ambiguous destination → stay put). Two guards:
    //  · previous state empty = initial load / conversation switch — never scroll;
    //  · signatures only count qty > 0 lines, so suggestion (qty=0) churn is invisible.
    // The user's own panel edits are already IN the previous refs, so the server
    // echoing them back diffs to nothing — no jump while they're manipulating cards.
    const prevProducts = productsByStepRef.current;
    const prevQty = menuQuantitiesRef.current;
    if (Object.values(prevProducts).some(list => list.length > 0)) {
      const signature = (
        products: Product[] | undefined,
        qty: Record<string, number>
      ): string =>
        (products ?? [])
          .map(p => [p.id, qty[p.id] ?? 0] as const)
          .filter(([, q]) => q > 0)
          .map(([id, q]) => `${id}:${q}`)
          .sort()
          .join(',');
      const allSteps = new Set([
        ...Object.keys(prevProducts),
        ...Object.keys(panel.productsByStep)
      ]);
      const changedSteps = [...allSteps].filter(
        step =>
          signature(prevProducts[step], prevQty) !==
          signature(panel.productsByStep[step], panel.menuQuantities)
      );
      // Several steps changed → scroll to the FIRST one in canonical menu order
      // (not Set iteration order, which follows insertion and would make the
      // target depend on object key layout). Menu order is also how the panel
      // lays sections out top-to-bottom, so "first affected" reads naturally as
      // "the topmost section that changed".
      const target = ALL_MENU_STEPS.find(step => changedSteps.includes(step));
      if (target) {
        useShopperStore.getState().requestStepScroll(target);
      }
    }
    setProductsByStep(panel.productsByStep);
    setMenuQuantities(panel.menuQuantities);
    setEventRequirements(panel.eventRequirements);
    menuRevisionRef.current = panel.menuRevision;
    setEventScreenEnabled(panel.hasMenu);
    // Store selected server-side (e.g. by the assistant via manage_store) → reflect it
    // in the store + notify the host page so its header updates (sandbox navbar / Carrefour).
    if (panel.store && panel.store.store_id) {
      const cur = useShopperStore.getState().store;
      if (
        !cur ||
        String(cur.store_id) !== String(panel.store.store_id) ||
        cur.mode !== panel.store.mode
      ) {
        useShopperStore.getState().setStore(panel.store);
        window.dispatchEvent(
          new CustomEvent('shoppergpt:change_shop', {
            detail: {
              store_id: panel.store.store_id,
              store_name: panel.store.store_name,
              mode: panel.store.mode
            }
          })
        );
      }
    }
  }, []);

  /** Authoritative panel sync from MongoDB (GET /menu + ETag). */
  const syncPanelFromServer = useCallback(
    async (force = false) => {
      const token = sessionIdRef.current;
      if (!token) return;
      setPanelSyncing(true);
      try {
        const { data, etag, notModified } = await fetchServerMenu(token, {
          ifNoneMatch: force ? null : menuEtagRef.current
        });
        if (etag) menuEtagRef.current = etag;
        if (notModified || !data) return;
        applyPanelState(menuResponseToPanelState(data));
      } catch (err) {
        console.warn('[shopper-gpt] GET /menu failed:', err);
      } finally {
        setPanelSyncing(false);
      }
    },
    [applyPanelState]
  );

  // Awaited right before a chat request is actually sent (see useChatAnswer below) —
  // guarantees menuRevisionRef is caught up to the last known server state before
  // getClientState() snapshots it, closing the race described above.
  const waitForPendingSync = useCallback(async () => {
    if (pendingPanelSyncRef.current) {
      await pendingPanelSyncRef.current;
    }
  }, []);

  const resetPanelToDefault = useCallback(() => {
    setProductsByStep({});
    setMenuQuantities({});
    setEventRequirements({});
    setEventScreenEnabled(false);
    setMobilePanelExpanded(false);
    menuRevisionRef.current = 0;
    menuEtagRef.current = null;
  }, []);

  // Resume the last active conversation across a page reload (Carrefour triggers
  // location.reload() after a store change). The active conversation id is persisted
  // to sessionStorage per session; openConversationRef lets the resume-on-load effect
  // below call openConversation without a temporal-dead-zone (it's defined later).
  const openConversationRef = useRef<((id: string) => Promise<void>) | null>(null);
  const restoredSessionRef = useRef<string | null>(null);

  // First paint after a reload: if a conversation will be resumed (see the effect
  // below), suppress the welcome screen so it doesn't flash before the thread loads.
  // Initialised synchronously from sessionStorage so the very first render already
  // knows a resume is pending — no welcome flash. Stays false for fresh visitors
  // (no stored id) → their load is completely unchanged.
  const [restoring, setRestoring] = useState<boolean>(() => {
    if (getMockScreen()) return false;
    try {
      return !!sessionStorage.getItem('sgpt:active-conv:' + getInitialSessionId());
    } catch {
      return false;
    }
  });

  // Pin the chat list to the bottom on new/streaming messages by scrolling the
  // container itself — NOT scrollIntoView, which also scrolls the host PAGE to bring
  // the target into the viewport (with :host{overflow:hidden} on the mount, this
  // keeps auto-scroll fully inside the widget). Instant (scrollTop), NOT smooth:
  // during token streaming this fires on every token, and repeated smooth scrolls
  // interrupt one another and visibly stall (the "no scroll" regression).
  const scrollChatToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollChatToBottom();
    // Second pass next frame: a new message's enter transition can change its height
    // after the first layout, so re-pin once that's settled.
    const raf = requestAnimationFrame(scrollChatToBottom);
    return () => cancelAnimationFrame(raf);
  }, [messages, isLoading, streamingText, scrollChatToBottom]);

  useEffect(() => {
    // On (re)load: resume the last active conversation for this session if one was
    // stored — this survives a page reload (e.g. Carrefour's reload after a store
    // change) — otherwise land on the default editorial screen. Runs once per
    // session; openConversation restores messages + panel and falls back to the
    // default screen on any failure (stale/deleted id).
    if (!sessionId || getMockScreen()) return;
    if (restoredSessionRef.current === sessionId) return;
    restoredSessionRef.current = sessionId;
    let resumeId: string | null = null;
    try {
      resumeId = sessionStorage.getItem('sgpt:active-conv:' + sessionId);
    } catch {
      resumeId = null;
    }
    if (resumeId && openConversationRef.current) {
      // Clear `restoring` once the resume settles (success or failure) — openConversation
      // never rejects (it catches internally and falls back to the default screen).
      void openConversationRef.current(resumeId).finally(() => setRestoring(false));
    } else {
      setRestoring(false);
      resetPanelToDefault();
    }
  }, [sessionId, resetPanelToDefault]);

  // Dev/testing only — jump straight to a MenuBuilderPanel screen with canned
  // data via data-mock-screen="event"|"products" on the script tag, instead of
  // re-chatting through postcode → event → compose on every reload. Never set
  // in production embeds (see getMockScreen).
  useEffect(() => {
    const mock = getMockScreen();
    if (!mock) return;

    setEventRequirements({
      event_name: 'anniversaire',
      date: '27 août 2026',
      guests_adults: 10,
      guests_kids: 0,
      budget: 200,
      event_theme: 'bbq',
      menu_steps: ['Apéritifs', 'Plats', 'Fromages', 'Desserts', 'Boissons', 'Pains']
    });
    setEventScreenEnabled(true);

    if (mock === 'products') {
      // Real Carrefour Traiteur catalogue products (name/price/image straight from
      // the dev DB) instead of blank-image placeholders — so the mock actually
      // looks like a real composed menu when eyeballing layout/styling changes.
      const mk = (
        id: string,
        name: string,
        price: number,
        persons: number | null,
        step: string,
        image: string,
        isComposable = false
      ): Product => ({
        id,
        name,
        price,
        persons,
        image,
        menu_step: step,
        is_composable: isComposable
      });
      // Real SKUs (not made-up "mock-N" ids) — the product detail modal fetches
      // GET /product/{id} against the real catalogue, so a fake id would just
      // 404 the moment "voir détails" is tapped on a mock product.
      setProductsByStep({
        Apéritifs: [
          mk(
            '111',
            '6 Verrines tartare de tomates et thon',
            7.95,
            6,
            'Apéritifs',
            'https://traiteur.carrefour.fr/media/catalog/product/v/e/verrine_tomate_thon_carrefour_traiteur_2.jpg'
          ),
          mk(
            '24642',
            '4 verrines noix de Saint-Jacques et tartare de tomates basilic',
            4.95,
            4,
            'Apéritifs',
            'https://traiteur.carrefour.fr/media/catalog/product/v/e/verrines_1_.png'
          )
        ],
        Plats: [
          mk(
            '717',
            'Filet de Bœuf Wellington en croûte',
            32.9,
            7,
            'Plats',
            'https://traiteur.carrefour.fr/media/catalog/product/b/o/boeuf_en_croute_carrefour_1.jpg'
          ),
          mk(
            '88',
            'Gratin dauphinois',
            3.0,
            1,
            'Plats',
            'https://traiteur.carrefour.fr/media/catalog/product/g/r/gratin_dauphinois_carrefour_traiteur_2_.jpg'
          )
        ],
        Fromages: [
          mk(
            '454',
            'Plateau du fromager - 10 fromages',
            24.9,
            18,
            'Fromages',
            'https://traiteur.carrefour.fr/media/catalog/product/p/l/plateau_fromages_10_carrefour_traiteur.jpg'
          ),
          // is_composable: true — real "build-your-own" product (has actual
          // composition_plateau data ingested), opens the Composer modal
          // instead of the plain description on click. See derive_composable
          // in shopper-gpt-carrefour-ingest.
          mk(
            '406',
            'Plateau de 6 fromages',
            15.9,
            12,
            'Fromages',
            'https://traiteur.carrefour.fr/media/catalog/product/p/l/plateau_6_fromages_carrefour_traiteur_2.jpg',
            true
          )
        ],
        Desserts: [
          mk(
            '197',
            'Tarte aux fraises - 6 parts',
            9.99,
            6,
            'Desserts',
            'https://traiteur.carrefour.fr/media/catalog/product/_/t/_tarte_aux_fraises_500x500_.png'
          )
        ],
        Boissons: [
          mk(
            '4282',
            'Champagne brut, Nicolas Feuillatte Grande Réserve',
            23.95,
            null,
            'Boissons',
            'https://traiteur.carrefour.fr/media/catalog/product/c/h/champagne_brut__nicolas_feuillatte_grande_r_serve__carrefour_traiteur.jpg'
          )
        ],
        // Was mistakenly "72 Macarons" (a Desserts product) — swapped for a real
        // Pains item so step and product actually match.
        Pains: [
          mk(
            '8084',
            '4 baguettes campagnardes',
            2.97,
            16,
            'Pains',
            'https://traiteur.carrefour.fr/media/catalog/product/b/a/baguette_campagne_carrefour_traiteur_1.jpg'
          )
        ]
      });
      setMenuQuantities({
        '111': 6,
        '24642': 0,
        '717': 2,
        '88': 10,
        '454': 0,
        '406': 1,
        '197': 2,
        '4282': 0,
        '8084': 0
      });

      // Canned conversation history behind the mock menu — otherwise the
      // chat pane sits empty next to a fully-populated panel, which doesn't
      // match what a real in-progress session actually looks like.
      addMessage({
        id: 'mock-msg-1',
        role: 'user',
        content: 'Livraison',
        timestamp: new Date(0)
      });
      addMessage({
        id: 'mock-msg-2',
        role: 'assistant',
        content:
          "C'est entendu ! Voici une proposition de menu raffiné pour votre dîner : je vous suggère un Filet de Bœuf Wellington en croûte accompagné d'un gratin dauphinois fondant, le tout sublimé par une sélection de vins et un champagne Moët & Chandon pour débuter la soirée en beauté.\n\n" +
          'Le budget total de cette sélection est cohérent avec votre enveloppe. Que pensez-vous de cet ensemble ?',
        timestamp: new Date(0)
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
          // Rides along so the backend keeps it on the menu item (see
          // tools.sync_state) — otherwise a composed plateau's chosen pieces
          // (and the total needed to judge it complete) would be silently
          // dropped on the very next chat turn.
          ...(p.plateau_selection ? { plateau_selection: p.plateau_selection } : {}),
          ...(p.plateau_target_qty != null ? { plateau_target_qty: p.plateau_target_qty } : {})
        };
      })
    );
    // Sent every turn (cheap, idempotent) — see waib-api's state.set_env. Gates
    // whether a real Carrefour Cart API call can ever fire for this session.
    const base: Record<string, unknown> = { menu_revision: menuRevisionRef.current, env: getEnv() };
    if (pendingStepSelectionRef.current) {
      base.menu_steps = pendingStepSelectionRef.current;
      // One-shot: consumed by this request only, so a stale snapshot can't later
      // overwrite a more recent server-side menu_steps change (e.g. via compose_menu).
      pendingStepSelectionRef.current = null;
    }
    return products.length > 0 ? { ...base, products } : base;
  };

  const refreshConversations = useCallback(async () => {
    if (!sessionId) return;
    try {
      const list = await fetchConversations();
      setConversations(list);
    } catch (err) {
      console.warn('[shopper-gpt] GET /conversations failed:', err);
    }
  }, [sessionId, setConversations]);

  // Refresh lands on the default (empty) chat; conversationId is intentionally
  // not persisted. Same PHPSESSID → load sidebar list for the burger drawer.
  useEffect(() => {
    if (!sessionId) return;
    void refreshConversations();
  }, [sessionId, refreshConversations]);

  const openConversation = useCallback(
    async (id: string) => {
      try {
        setConversationsOpen(false);
        setIsLoading(true);
        const leavingId = useShopperStore.getState().conversationId;
        // Flush local-only edits (quantity changes, removed/kept suggestions) for
        // the conversation being left BEFORE switching — otherwise anything not
        // yet carried along by a chat message's client_state is lost the moment
        // we navigate away, since nothing else ever persisted it server-side.
        // Best-effort: a sync failure must never block the actual switch.
        if (leavingId) {
          try {
            await syncMenuState(sessionId, getClientState() ?? {});
          } catch (err) {
            console.warn('[shopper-gpt] pre-switch menu sync failed:', err);
          }
        }
        const data = await fetchConversation(id, {
          leavingConversationId: leavingId
        });
        setConversationId(id);
        const mapped: Message[] = (data.messages || [])
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map((m, i) => ({
            id: m.message_id || `${id}-${i}`,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
          }));
        setMessages(mapped);
        setStreamingText('');
        setComposePhase(null);
        setQuestion(null);
        // Right panel is per-conversation. Usable snapshot → render it.
        // Otherwise show the default editorial screen.
        if (data.has_panel_snapshot && data.menu) {
          const panel = menuResponseToPanelState(data.menu);
          if (panel.hasMenu) {
            applyPanelState(panel);
            menuEtagRef.current = null;
          } else {
            resetPanelToDefault();
          }
        } else {
          resetPanelToDefault();
        }
        void refreshConversations();
      } catch (err) {
        console.warn('[shopper-gpt] open conversation failed:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [
      sessionId,
      setConversationId,
      setMessages,
      setIsLoading,
      applyPanelState,
      resetPanelToDefault,
      refreshConversations
    ]
  );

  // Keep the ref pointing at the latest openConversation (read by the resume-on-load
  // effect above). Assigned during render — a standard "latest value" ref.
  openConversationRef.current = openConversation;

  // Persist / clear the active conversation id (per session) so a page reload can
  // resume it. sessionStorage → scoped to this tab session, so a brand-new visit
  // still starts on the welcome screen.
  useEffect(() => {
    if (!sessionId) return;
    const key = 'sgpt:active-conv:' + sessionId;
    try {
      if (conversationId) sessionStorage.setItem(key, conversationId);
      else sessionStorage.removeItem(key);
    } catch {
      /* storage disabled / private mode — resume simply won't happen */
    }
  }, [conversationId, sessionId]);

  /** Start a fresh thread from the drawer — same end state a page refresh lands on
   * (empty chat, no conversationId, default panel), minus the reload. Flushes the
   * outgoing conversation's local-only panel edits first, for exactly the reason
   * openConversation does: nothing else ever persists them server-side, so leaving
   * without this silently drops them. */
  const startNewConversation = useCallback(async () => {
    setConversationsOpen(false);
    const leavingId = useShopperStore.getState().conversationId;
    if (leavingId) {
      try {
        await syncMenuState(sessionId, getClientState() ?? {});
      } catch (err) {
        console.warn('[shopper-gpt] pre-new-conversation menu sync failed:', err);
      }
    }
    setConversationId(null);
    setMessages([]);
    setStreamingText('');
    setComposePhase(null);
    setQuestion(null);
    resetPanelToDefault();
    menuEtagRef.current = null;
    void refreshConversations();
  }, [
    sessionId,
    setConversationId,
    setMessages,
    resetPanelToDefault,
    refreshConversations
  ]);

  useChatAnswer(
    question,
    jwt,
    {
      onJwt: newJwt => {
        setJwt(newJwt);
        jwtRef.current = newJwt;
      },
      onPhase: phase => setComposePhase(phase),
      onToken: token => setStreamingText(prev => prev + token),
      onMeta: meta => {
        // Event wiped server-side (reset_event, user-confirmed) → back to the first screen.
        // Checked BEFORE needsSync and returning early: clear_live_panel bumps the revision,
        // so menu_changed is also true here, and syncing would race resetPanelToDefault over
        // the same refs for an empty state there is no point fetching.
        if (meta.panel_reset) {
          resetPanelToDefault();
          panelSyncedThisTurnRef.current = true;
          return;
        }
        const needsSync =
          Boolean(meta.sync_conflict) ||
          meta.menu_changed === true ||
          meta.store_changed === true ||
          (typeof meta.menu_revision === 'number' && meta.menu_revision > menuRevisionRef.current);
        if (needsSync) {
          panelSyncedThisTurnRef.current = true;
          pendingPanelSyncRef.current = syncPanelFromServer(true).finally(() => {
            pendingPanelSyncRef.current = null;
          });
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
        void refreshConversations();
      },
      onError: msg => {
        // msg is the raw fetch()/browser error (e.g. "Failed to fetch" in Chrome,
        // "NetworkError when attempting to fetch resource" in Firefox, "Load
        // failed" in Safari) — never in French regardless of the user's browser
        // locale, since it's the browser engine's own string, not ours. Always
        // show a fixed French message instead; keep the raw detail in the
        // console only, for debugging.
        console.warn('[shopper-gpt] /answer failed:', msg);
        // Only navigator.onLine is a reliable "no internet" signal — the error
        // TEXT itself can't distinguish "no internet" from "server unreachable"
        // (CORS block, backend down, connection refused all throw the exact same
        // "Failed to fetch"/"Load failed" from the browser). Guessing from the
        // message would misdirect the user to check their own connection when
        // the real problem is on our end — so anything except a confirmed
        // offline browser gets the honest generic message instead.
        const userMessage = !navigator.onLine
          ? 'Connexion internet indisponible. Vérifiez votre connexion et réessayez.'
          : 'Une erreur est survenue. Veuillez réessayer.';
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ ${userMessage}`,
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
    },
    getClientState,
    waitForPendingSync
  );

  const send = useCallback(
    (text?: string) => {
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
    },
    [input, isLoading, addMessage, setIsLoading]
  );

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    },
    [send]
  );

  // Per-step debounce timers for the activation-triggered rebalance below.
  const rebalanceTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  // Step whose rebalance is pending/in-flight — blocks the WHOLE panel (see
  // MenuBuilderPanel's `rebalancing` overlay). Set the instant a suggestion is
  // activated, not when the request fires: the gap between the two is exactly
  // where the user could keep clicking and stack concurrent /adjust_step calls
  // (the 3-calls-in-10s storm, then 409s, seen in QA).
  const [rebalancingStep, setRebalancingStep] = useState<string | null>(null);

  /** Auto-rebalance one step after a SUGGESTION was activated (qty 0 → ≥1).
   *
   * Trigger boundary (product decision): ONLY the 0→≥1 transition fires this —
   * ordinary +/- edits on an already-active product are the user's own manual
   * tuning and stay silent, no rebalance, no assistant message. The debounce
   * absorbs quick taps (0→1→2→3 = one call) and activate-then-deactivate
   * (checked again at fire time = zero calls).
   *
   * The route syncs our snapshot first (the activation only exists locally),
   * sizes the step within its logical share of the budget (+10%), then returns
   * a `message` we ALWAYS surface as an assistant bubble — including the overrun
   * warning when the menu now exceeds the global budget. A 409 means our
   * revision was stale: resync silently, never retry blindly. */
  const scheduleStepRebalance = useCallback((productId: string) => {
    const step = Object.entries(productsByStepRef.current).find(([, list]) =>
      list.some(p => p.id === productId)
    )?.[0];
    if (!step) return;
    setRebalancingStep(step);
    const timers = rebalanceTimersRef.current;
    if (timers[step]) clearTimeout(timers[step]);
    timers[step] = setTimeout(async () => {
      delete timers[step];
      // Deactivated again before the debounce fired → the activation was undone.
      if ((menuQuantitiesRef.current[productId] ?? 0) <= 0) {
        setRebalancingStep(null);
        return;
      }
      try {
        const result = await adjustStepQuantities(
          sessionIdRef.current,
          step,
          getClientState()
        );
        if (typeof result.menu_revision === 'number') {
          menuRevisionRef.current = Math.max(menuRevisionRef.current, result.menu_revision);
        }
        await syncPanelFromServer(true);
        if (result.message) {
          addMessage({
            id: `rebalance-${Date.now()}`,
            role: 'assistant',
            content: result.message,
            timestamp: new Date()
          });
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 409) {
          // Stale snapshot. The 409 body carries the server's revision — ADOPT it
          // before resyncing: GET /menu may well answer 304 (our cached payload is
          // current, only our revision counter was behind), in which case
          // applyPanelState never runs and the ref would stay stale forever — every
          // later activation then 409s again (the loop seen in QA at 11:44-11:45).
          const serverRev = (err as { serverRevision?: number }).serverRevision;
          if (typeof serverRev === 'number') {
            menuRevisionRef.current = Math.max(menuRevisionRef.current, serverRev);
          }
          await syncPanelFromServer(true);
        } else {
          console.error('adjust_step failed', err);
        }
      } finally {
        setRebalancingStep(null);
      }
    }, 800);
  }, [addMessage, syncPanelFromServer]);

  const handleQuantityChange = useCallback((productId: string, delta: number) => {
    const wasInactive = (menuQuantitiesRef.current[productId] ?? 0) <= 0;
    setMenuQuantities(prev => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
    // Activation of a suggestion (0 → ≥1) → schedule the step rebalance. Any other
    // edit (including deactivation) is manual tuning: silent by design.
    if (wasInactive && delta > 0) scheduleStepRebalance(productId);
  }, [scheduleStepRebalance]);

  // Saves the user's chosen pieces onto the plateau product itself (not a
  // separate map) — that's what makes it ride along the existing menu sync
  // (getClientState → sync_state → state.py) instead of being lost the moment
  // this modal closes, so it's already sitting there ready for "Ajouter au
  // panier" to build the real POST /cart/add {options:{plateau:{...}}} payload.
  const handleComposeValidate = useCallback(
    (productId: string, step: string, selection: Record<string, number>, targetQty: number) => {
      setProductsByStep(prev => {
        const list = prev[step];
        if (!list) return prev;
        const idx = list.findIndex(p => p.id === productId);
        if (idx === -1) return prev;
        const updated = {
          ...list[idx],
          plateau_selection: selection,
          plateau_target_qty: targetQty
        };
        const nextList = [...list];
        nextList[idx] = updated;
        return { ...prev, [step]: nextList };
      });
      if ((menuQuantitiesRef.current[productId] ?? 0) === 0) {
        handleQuantityChange(productId, 1);
      }
    },
    [handleQuantityChange]
  );

  const [suggestingStep, setSuggestingStep] = useState<string | null>(null);

  // "Nouvelle proposition de produits" card — a deterministic REST call (POST
  // /suggest_products), not a chat turn: the backend already persists the picks
  // server-side as showcase (qty=0) items, so the orchestrator picks them up via
  // live_context on its own next turn without us telling it anything here. We
  // just merge the same picks into local state so they render immediately,
  // without waiting on a GET /menu round trip.
  const handleSuggestMore = useCallback(
    async (step: string) => {
      if (suggestingStep) return;
      setSuggestingStep(step);
      try {
        const { products: newProducts, menuRevision } = await suggestProducts(sessionId, step);
        // Adopt the server's post-add revision BEFORE anything else, and even when no
        // product came back: the backend persisted showcase items, so it has moved ahead
        // of us either way. Skipping this leaves us stale, and sync_state then DISCARDS
        // our next snapshot — silently undoing panel edits the user made in the meantime.
        if (menuRevision !== null && menuRevision > menuRevisionRef.current) {
          menuRevisionRef.current = menuRevision;
        }
        if (newProducts.length === 0) return;
        setProductsByStep(prev => {
          const existingIds = new Set((prev[step] ?? []).map(p => p.id));
          const fresh = newProducts.filter(p => !existingIds.has(p.id));
          if (fresh.length === 0) return prev;
          return { ...prev, [step]: [...(prev[step] ?? []), ...fresh] };
        });
        setMenuQuantities(prev => {
          const next = { ...prev };
          for (const p of newProducts) next[p.id] ??= 0;
          return next;
        });
      } catch (err) {
        console.error('suggest_products failed', err);
      } finally {
        setSuggestingStep(null);
      }
    },
    [sessionId, suggestingStep]
  );

  // "Ajouter au panier" — pushes the composed menu to Carrefour's REAL cart via
  // POST /cart/confirm. No-op (status="skipped") outside the real Carrefour
  // context (our sandbox), by design — see api/cart.ts. Our own menu state is
  // never touched here regardless of outcome; a failure just shows a French
  // error message so the user knows the real cart wasn't updated and can retry.
  const handleConfirmCart = useCallback(async () => {
    try {
      const result = await confirmCart(sessionId);
      if (result.status === 'error') {
        console.warn('[shopper-gpt] cart/confirm failed:', result.detail);
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content:
            "❌ Impossible d'ajouter le menu à votre panier Carrefour. Veuillez réessayer.",
          timestamp: new Date()
        });
      } else if (result.status === 'ok') {
        // The real Carrefour cart just changed — notify the host page, carrying the
        // rendered .header-minicart HTML Carrefour returned so it can refresh the
        // mini-cart with no extra request (see shoppergpt:cart_updated).
        dispatchCartUpdated({
          success: true,
          action: 'confirm',
          minicart_html: result.minicart_html
        });
      }
    } catch (err) {
      console.warn('[shopper-gpt] cart/confirm request failed:', err);
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content:
          "❌ Impossible d'ajouter le menu à votre panier Carrefour. Veuillez réessayer.",
        timestamp: new Date()
      });
    }
  }, [sessionId, addMessage]);

  const isStreaming = isLoading && streamingText.length > 0;
  const isWaiting = isLoading && streamingText.length === 0;

  const noStoreGreeting =
    'Je suis là pour vous aider à composer le menu parfait pour votre événement ✨\n\n' +
    'Pour vous garantir la disponibilité de nos meilleurs produits traiteur, pourriez-vous m\'indiquer votre code postal ?';
  const storeGreeting =
    'Je suis là pour vous aider à composer le menu parfait pour votre événement ✨\n\n' +
    "Pour commencer... quel est l'heureux événement que vous souhaitez célébrer ?";
  const initialGreeting: import('../types').Message = {
    id: 'w1',
    role: 'assistant',
    content: store ? storeGreeting : noStoreGreeting,
    timestamp: new Date()
  };

  return (
    <div class="relative flex flex-col h-full min-h-0 bg-[#FAF9F7]">
      <div class="flex flex-col md:grid flex-1 md:grid-rows-1 md:grid-cols-[38%_1fr] overflow-hidden min-h-0">
        <div
          class={`relative flex order-3 md:order-none md:col-start-1 flex-col bg-white md:border-r border-[#E8ECF0] min-h-0 transition-[flex-basis] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            // The seam shadow needs to run the full width of the pane (it's the
            // boundary with the panel above), not just sit localized around the
            // small chevron handle — an inset shadow on this whole container's
            // top edge does that, instead of a per-icon drop-shadow.
            eventScreenEnabled && !mobilePanelExpanded
              ? 'max-md:shadow-[inset_0_6px_8px_-6px_rgba(0,0,0,.15)]'
              : ''
          }`}
          style={{
            flexGrow: 0,
            // flexShrink:1 (was 0) — the panel's own min-height floor (see its
            // wrapper below) needs somewhere to take space FROM on a short
            // viewport where 55%-for-chat + 350px-for-panel doesn't fit; a
            // non-shrinking chat pane made that floor unsatisfiable (the
            // panel just got clipped by its own overflow-hidden instead of
            // actually reaching 350px). Only bites when the panel's floor is
            // actually in play — on a normal-height screen there's enough
            // room for both and chat keeps its full 55%.
            flexShrink: 1,
            // Collapsed: chat takes the bulk of the height (a %, in sync with
            // the panel's complementary flexGrow). Expanded: shrunk to a fixed
            // px height too small for the message list, so it visually
            // disappears — ChatInputBar (shrink-0) still forces itself to its
            // full intrinsic height, keeping the input + mic reachable. Focus
            // no longer changes this — chatFocused only hides the expand
            // trigger now, the panel keeps its normal proportions.
            flexBasis: mobilePanelExpanded ? '64px' : '62%'
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
            // Add transparent gradient to make text disapear smoothly
            <div class="bg-gradient-to-b from-white to-transparent w-full h-8 absolute">
              <button
                type="button"
                // -translate-x-1/2: left-1/2 alone only puts this button's OWN left
                // edge at the pane's horizontal center, not the button itself — it
                // was sitting shifted right by half its own width. The seam shadow
                // itself now lives on the whole pane container (see its class
                // above) instead of a per-icon drop-shadow, so it reads as one
                // continuous line rather than a shadow local to just this handle.
                class="hidden max-md:flex absolute top-0 left-1/2 -translate-x-1/2 z-10 cursor-pointer"
                onClick={() => setMobilePanelExpanded(true)}
                aria-label="Agrandir le menu"
                aria-expanded={false}
                dangerouslySetInnerHTML={{ __html: downIcon }}
              />
            </div>
          )}

          <div
            ref={chatScrollRef}
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
              eventScreenEnabled && !mobilePanelExpanded ? 'md:mt-0 pt-2' : ''
            }`}
          >
            {/* Standalone header greeting — separate from the initialGreeting
                MessageBubble below. Only makes sense before the conversation has
                actually started, so it animates out once the user sends anything
                (AnimatePresence handles the exit; a plain `&&` would just yank it
                away with no transition). */}
            <AnimatePresence initial={false}>
              {messages.length === 0 && !restoring && (
                <motion.div
                  class="shrink-0 overflow-hidden px-5 md:px-8"
                  initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.998 }}
                  animate={
                    shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1, height: 'auto' }
                  }
                  exit={shouldReduceMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={
                    shouldReduceMotion
                      ? undefined
                      : { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: 0.02 }
                  }
                >
                  <p class="m-0 pt-3 pb-5 md:py-10 font-normal text-[#C7B287] text-base md:text-2xl leading-[1.45]">
                    Bonjour et bienvenue, je suis{' '}
                    <span class="font-['Satisfy'] font-normal text-[#C7B287] text-[24px] md:text-3xl mr-[1px]">
                      Cathia
                    </span>{' '}
                    votre agent intelligent traiteur. Que puis-je faire pour vous&nbsp;?
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
                    Object.keys(productsByStep).length > 0 ||
                    // A turn is in flight (composition included): the selection was
                    // already consumed when that message was sent (pendingStepSelectionRef
                    // is one-shot), so any further click silently defers to the NEXT
                    // message while looking like it steers the run in progress. The card's
                    // own `validated` flag only trips via "Valider la sélection", so
                    // answering by TEXT ("augmente mon budget à 200") used to leave the
                    // chips live — letting the user change steps and budget at once.
                    isLoading
                  }
                  onStepSelectionChange={steps => {
                    pendingStepSelectionRef.current = steps;
                  }}
                  onValidateSteps={() =>
                    send('Ces étapes me conviennent, vous pouvez composer le menu.')
                  }
                  choiceCardsDisabled={
                    // Same principle as stepSelectionDisabled above: only freeze once
                    // the flow has actually moved past THIS card (a newer store/mode
                    // card superseded it, or its own selection got resolved) — deliberately
                    // NOT based on the globally currently-selected store, since that stays
                    // true forever after the FIRST resolution and would freeze every later
                    // re-generated card (e.g. after "je veux en choisir un autre") too.
                    messages
                      .slice(i + 1)
                      .some(msg => msg.storeOptions || msg.modeOptions || msg.storeResolved)
                  }
                  onSelectStore={storeName => send(storeName)}
                  onSelectMode={modeLabel => send(modeLabel)}
                />
              ))}
              {isWaiting && (composePhase ? <ComposingIndicator /> : <TypingIndicator />)}
              {isStreaming && (
                <StreamingBubble text={streamingText.replace(/__NEWLINE__/g, '\n')} />
              )}
            </div>

          </div>

          <ChatInputBar
            input={input}
            isLoading={isLoading}
            onInputChange={setInput}
            onSend={() => send()}
            onKeyDown={handleKey}
            showConversationsButton={true}
            onOpenConversations={() => setConversationsOpen(true)}
            // Mobile: while typing, show only the chat (see chatFocused above)
            // instead of fighting the iOS keyboard + accessory bar for space.
            // Also drop any panel expansion so the layout returns to normal
            // collapsed proportions once focus/typing is done.
            onFocus={() => {
              // chatFocused now only hides the mobile expand trigger (see its
              // `!chatFocused` check below) — it no longer grows the chat pane
              // to 100% (flexBasis stays at its normal collapsed/expanded
              // values regardless of focus; see the flexBasis style below).
              setChatFocused(true);
              setMobilePanelExpanded(false);
              // The keyboard sliding in still takes a moment to settle, so
              // scrolling immediately would jump to a bottom that's about to
              // move. Wait a tick, then re-run on the visualViewport's own
              // resize (keyboard finishing its slide) as a second pass in
              // case the first ran before the keyboard's height change had landed.
              setTimeout(() => scrollChatToBottom(), 320);
              const vv = window.visualViewport;
              if (vv) {
                const onResize = () => {
                  scrollChatToBottom();
                  vv.removeEventListener('resize', onResize);
                };
                vv.addEventListener('resize', onResize);
              }
            }}
            onBlur={() => setChatFocused(false)}
          />

          <ConversationsDrawer
            open={conversationsOpen}
            conversations={conversations}
            activeConversationId={conversationId}
            onClose={() => setConversationsOpen(false)}
            onSelect={id => void openConversation(id)}
            onNewConversation={() => void startNewConversation()}
          />
        </div>

        <div
          class="order-1 md:order-none md:col-start-2 flex flex-col overflow-hidden"
          style={{
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 0,
            // The actual floor has to live HERE (the real flex item competing
            // for space in the mobile column layout) — a min-height set on
            // MenuBuilderPanel's own internal root doesn't help, since this
            // wrapper's overflow-hidden would just clip that descendant if
            // the wrapper itself got flexed smaller. Always enforced now —
            // focus no longer shrinks the panel away.
            minHeight: 300
          }}
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
              onSuggestMore={handleSuggestMore}
              suggestingStep={suggestingStep}
              onConfirmCart={handleConfirmCart}
              rebalancing={rebalancingStep !== null}
            />
          ) : (
            <EditorialPanel onSelect={q => send(q)} />
          )}
        </div>
      </div>


      {/* Product detail modal — rendered above everything else inside the widget.
          "Composer" plateaux (is_composable) open the dedicated composition
          flow instead of the plain description — see ComposeProductModal. */}
      <AnimatePresence>
        {selectedProduct && selectedProduct.is_composable && (
          <ComposeProductModal
            productId={selectedProduct.id}
            onClose={() => setSelectedProduct(null)}
            initialSelection={selectedProduct.plateau_selection}
            onValidate={(selection, targetQty) =>
              handleComposeValidate(
                selectedProduct.id,
                selectedProduct.menu_step ?? '',
                selection,
                targetQty
              )
            }
          />
        )}
        {selectedProduct && !selectedProduct.is_composable && (
          <ProductDetailModal
            productId={selectedProduct.id}
            onClose={() => setSelectedProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
