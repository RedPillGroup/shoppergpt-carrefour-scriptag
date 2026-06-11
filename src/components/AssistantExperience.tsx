import { h } from 'preact';
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShopperStore } from '../store';
import { EventRequirements, Product } from '../types';
import { useChatAnswer } from '../hooks/useChatAnswer';
import { fetchServerMenu, menuResponseToPanelState } from '../api/menu';
import { EditorialPanel } from './panel/EditorialPanel';
import { MessageBubble } from './chat/MessageBubble';
import { TypingIndicator } from './chat/TypingIndicator';
import { StreamingBubble } from './chat/StreamingBubble';
import { ChatInputBar } from './chat/ChatInputBar';
import { MenuBuilderPanel } from './panel/MenuBuilderPanel';
import { ProductDetailModal } from './panel/ProductDetailModal';

export function AssistantExperience() {
  const { messages, addMessage, isLoading, setIsLoading, jwt, setJwt, selectedProduct, setSelectedProduct } = useShopperStore();
  const shouldReduceMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [eventRequirements, setEventRequirements] = useState<EventRequirements>({});
  const [eventScreenEnabled, setEventScreenEnabled] = useState(false);
  const [productsByStep, setProductsByStep] = useState<Record<string, Product[]>>({});
  const [menuQuantities, setMenuQuantities] = useState<Record<string, number>>({});
  const [panelSyncing, setPanelSyncing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const jwtRef = useRef(jwt);
  const menuRevisionRef = useRef(0);
  const menuEtagRef = useRef<string | null>(null);
  const productsByStepRef = useRef(productsByStep);
  const menuQuantitiesRef = useRef(menuQuantities);
  const panelSyncedThisTurnRef = useRef(false);
  jwtRef.current = jwt;
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
  }, []);

  /** Authoritative panel sync from MongoDB (GET /menu + ETag). */
  const syncPanelFromServer = useCallback(async (force = false) => {
    const token = jwtRef.current;
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
    if (jwt) void syncPanelFromServer();
  }, [jwt, syncPanelFromServer]);

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
    const base = { menu_revision: menuRevisionRef.current };
    return products.length > 0 ? { ...base, products } : base;
  };

  useChatAnswer(question, jwt, {
    onJwt: newJwt => {
      setJwt(newJwt);
      jwtRef.current = newJwt;
    },
    onToken: token => setStreamingText(prev => prev + token),
    onMeta: meta => {
      const needsSync =
        Boolean(meta.sync_conflict) ||
        meta.menu_changed === true ||
        (typeof meta.menu_revision === 'number' && meta.menu_revision > menuRevisionRef.current);
      if (needsSync) {
        panelSyncedThisTurnRef.current = true;
        void syncPanelFromServer(true);
      }
    },
    onComplete: fullText => {
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date()
      });
      setStreamingText('');
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
      setStreamingText('');
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
    setIsLoading(true);
    panelSyncedThisTurnRef.current = false;
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

  return (
    <div class="relative flex flex-col h-full min-h-0 text-[#1A1A2E] bg-[#FAF9F7]">
      <div class="grid flex-1 grid-rows-2 md:grid-rows-1 md:grid-cols-[38%_1fr] overflow-hidden min-h-0">
        <div class="row-start-1 md:row-start-auto md:col-start-1 flex flex-col bg-white border-b md:border-b-0 md:border-r border-[#E8ECF0] min-h-0">
          <div class="flex-1 overflow-y-auto min-h-0 flex flex-col [scroll-behavior:smooth] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]">
            <motion.div
              class="shrink-0 px-5 py-6 md:px-8 md:py-9"
              initial={shouldReduceMotion ? undefined : { opacity: 0, y: 8, scale: 0.998 }}
              animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              transition={
                shouldReduceMotion
                  ? undefined
                  : { duration: 0.42, ease: [0.16, 1, 0.3, 1], delay: 0.02 }
              }
            >
              <p class="m-0 font-normal text-[#C7B287] text-base md:text-lg leading-[1.45]">
                Bonjour et bienvenue, je suis{' '}
                <span class="font-['Satisfy'] font-normal text-[#C7B287] text-base md:text-xl">Cathia</span> votre agent
                intelligent traiteur. Que puis-je faire pour vous&nbsp;?
              </p>
            </motion.div>

            <div class="shrink-0 px-3.5 pb-3 md:px-5 md:pb-4 flex flex-col gap-0.5">
              {messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  showSender={
                    m.role === 'assistant' && (i === 0 || messages[i - 1].role !== 'assistant')
                  }
                  fadeInOnMount={i === 0 && m.role === 'assistant'}
                  fadeInDelay={i === 0 && m.role === 'assistant' ? 0.1 : 0}
                />
              ))}
              {isWaiting && <TypingIndicator />}
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
          />
        </div>

        <div class="row-start-2 md:row-start-auto md:col-start-2 flex flex-col overflow-hidden min-h-0">
          {eventScreenEnabled ? (
            <MenuBuilderPanel
              requirements={eventRequirements}
              productsByStep={productsByStep}
              quantities={menuQuantities}
              onQuantityChange={handleQuantityChange}
              syncing={panelSyncing}
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
