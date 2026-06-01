import { h } from 'preact';
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShopperStore } from '../store';
import { EventRequirements, Product } from '../types';
import { useChatAnswer, MetaPayload } from '../hooks/useChatAnswer';
import { extractProducts } from '../utils/productExtractor';
import { EditorialPanel } from './panel/EditorialPanel';
import { MessageBubble } from './chat/MessageBubble';
import { TypingIndicator } from './chat/TypingIndicator';
import { StreamingBubble } from './chat/StreamingBubble';
import { ProductSuggestionCard } from './panel/ProductSuggestionCard';
import { ChatInputBar } from './chat/ChatInputBar';
import { MenuBuilderPanel } from './panel/MenuBuilderPanel';
import { ProductDetailModal } from './panel/ProductDetailModal';

function parseString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`;
  }
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    if (!normalized) return undefined;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function extractEventRequirements(meta: MetaPayload): Partial<EventRequirements> {
  const raw = meta.tool_metadata?.event_requirements;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }

  const source = raw as Record<string, unknown>;
  const next: Partial<EventRequirements> = {};

  if ('event_type' in source) {
    const eventType = parseString(source.event_type);
    if (eventType !== undefined) next.event_type = eventType;
  }
  if ('event_date' in source) {
    const eventDate = parseString(source.event_date);
    if (eventDate !== undefined) next.event_date = eventDate;
  }
  if ('guests_adults' in source) {
    const adults = parseNumber(source.guests_adults);
    if (adults !== undefined) next.guests_adults = adults;
  }
  if ('guests_kids' in source) {
    const kids = parseNumber(source.guests_kids);
    if (kids !== undefined) next.guests_kids = kids;
  }
  if ('budget' in source) {
    const budget = parseNumber(source.budget);
    if (budget !== undefined) next.budget = budget;
  }
  if ('menu_steps' in source) {
    const steps = source.menu_steps;
    if (Array.isArray(steps) && steps.length > 0 && steps.every(s => typeof s === 'string')) {
      next.menu_steps = steps as string[];
    }
  }

  return next;
}

export function AssistantExperience() {
  const { messages, addMessage, isLoading, setIsLoading, jwt, setJwt, selectedProduct, setSelectedProduct } = useShopperStore();
  const shouldReduceMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const [productsTitle, setProductsTitle] = useState('Nos suggestions');
  const [productsSubtitle, setProductsSubtitle] = useState('');
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelKey, setPanelKey] = useState(0);
  const [eventRequirements, setEventRequirements] = useState<EventRequirements>({});
  const [eventScreenEnabled, setEventScreenEnabled] = useState(false);
  const [productsByStep, setProductsByStep] = useState<Record<string, Product[]>>({});
  const [menuQuantities, setMenuQuantities] = useState<Record<string, number>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  const updatePanel = useCallback((title: string, subtitle: string, products: Product[]) => {
    setPanelVisible(false);
    setTimeout(() => {
      setProductsTitle(title);
      setProductsSubtitle(subtitle);
      setDisplayedProducts(products);
      setPanelKey(k => k + 1);
      setPanelVisible(true);
    }, 280);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  useChatAnswer(question, jwt, {
    onJwt: newJwt => setJwt(newJwt),
    onToken: token => setStreamingText(prev => prev + token),
    onMeta: (meta: MetaPayload) => {
      const incomingRequirements = extractEventRequirements(meta);
      if (Object.keys(incomingRequirements).length > 0) {
        setEventRequirements(prev => ({ ...prev, ...incomingRequirements }));
        setEventScreenEnabled(true);
      }

      const products = extractProducts(meta.tool_results ?? []);

      // Backend tells us, via tool_metadata.menu_update, whether this is:
      //   • { type: 'full',    active_steps:  [...] } → recommend_menu_products
      //   • { type: 'partial', steps_updated: [...] } → update_menu_step
      // We pick the right merge strategy from that — the tool_results array
      // itself only carries flattened products, so we can't infer the tool
      // from there.
      const menuUpdate = meta.tool_metadata?.menu_update;

      if (products.length > 0) {
        const withStep = products.filter(p => p.menu_step);
        const withoutStep = products.filter(p => !p.menu_step);

        if (withStep.length > 0) {
          // Group incoming products by step
          const incomingByStep: Record<string, typeof withStep> = {};
          for (const p of withStep) {
            const step = p.menu_step!;
            (incomingByStep[step] ??= []).push(p);
          }

          // Pre-seed quantities from the backend's recommended_quantity field.
          const suggestions: Record<string, number> = {};
          for (const p of withStep) {
            if (p.recommended_quantity != null && p.recommended_quantity > 0) {
              suggestions[p.id] = p.recommended_quantity;
            }
          }

          if (menuUpdate?.type === 'full') {
            // FULL MENU REGENERATION (recommend_menu_products).
            // Wipe the panel clean — any step the backend didn't return
            // (e.g. Fromages dropped by the budget guard) should disappear,
            // not linger from a previous iteration.
            setProductsByStep(incomingByStep);
            setMenuQuantities(suggestions);
          } else if (menuUpdate?.type === 'partial') {
            // PARTIAL UPDATE (update_menu_step).
            // Replace only the listed steps; keep untouched courses intact.
            // Preserve any quantity the user manually adjusted on unchanged
            // products.
            const updatedSteps = new Set(menuUpdate.steps_updated ?? Object.keys(incomingByStep));
            setProductsByStep(prev => {
              const next = { ...prev };
              for (const step of updatedSteps) {
                // Replace each updated step with whatever the backend returned
                // (empty array if the new selection has 0 products).
                next[step] = incomingByStep[step] ?? [];
              }
              return next;
            });
            if (Object.keys(suggestions).length > 0) {
              setMenuQuantities(prev => ({
                ...suggestions,   // new recommendations as the base
                ...prev,          // user's manual changes always win
              }));
            }
          } else {
            // No menu_update metadata → likely search_traiteur_products or
            // an unknown tool.  Conservative merge that just adds products
            // to their steps without wiping anything.
            setProductsByStep(prev => ({ ...prev, ...incomingByStep }));
            if (Object.keys(suggestions).length > 0) {
              setMenuQuantities(prev => ({
                ...suggestions,
                ...prev,
              }));
            }
          }
        }

        // Fallback: products without menu_step go to the legacy panel
        if (withoutStep.length > 0) {
          updatePanel(
            'Suggestions personnalisées',
            `${withoutStep.length} produit${withoutStep.length > 1 ? 's' : ''} recommandé${withoutStep.length > 1 ? 's' : ''}`,
            withoutStep
          );
        }
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
  });

  const send = useCallback((text?: string) => {
    const t = (text ?? input).trim();
    if (!t || isLoading) return;
    addMessage({ id: Date.now().toString(), role: 'user', content: t, timestamp: new Date() });
    setInput('');
    setStreamingText('');
    setIsLoading(true);
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
            />
          ) : displayedProducts.length > 0 ? (
            <>
              <div class="py-3 px-4 md:py-3.5 md:px-6 bg-white border-b border-[#E8ECF0] flex items-center justify-between shrink-0 gap-3">
                <div>
                  <div class="text-sm md:text-[15px] font-bold">{productsTitle}</div>
                  {productsSubtitle && (
                    <div class="text-[11px] md:text-xs text-[#6B7280] mt-0.5">
                      {productsSubtitle}
                    </div>
                  )}
                </div>
                <div class="bg-[#C7B287] text-white text-[11px] md:text-xs font-semibold px-2.5 py-1 md:px-3 rounded-[20px] shrink-0">
                  {displayedProducts.length} produit{displayedProducts.length > 1 ? 's' : ''}
                </div>
              </div>
              <div class="flex-1 overflow-y-auto py-4 px-4 md:py-5 md:px-6 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded [&::-webkit-scrollbar-thumb]:bg-[#d1d5db]">
                <div
                  key={panelKey}
                  class={`transition-all duration-300 ${panelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                >
                  <div class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3 md:gap-4">
                    {displayedProducts.map(p => (
                      <ProductSuggestionCard key={p.id} product={p} />
                    ))}
                  </div>
                </div>
              </div>
            </>
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
