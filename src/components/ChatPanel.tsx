import { h } from 'preact';
import logoSrc from '../../assets/logo.svg';
import { useRef, useEffect, useState } from 'preact/hooks';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useShopperStore } from '../store';
import { Message } from '../types';
import { useChatAnswer, MetaPayload } from '../hooks/useChatAnswer';
import { extractProductsFromMeta } from '../utils/productExtractor';

function CarrefourLogo({ size = 32 }: { size?: number }) {
  return <img src={logoSrc} width={size} height={size} alt="Carrefour" style={{ objectFit: 'contain' }} />;
}

function TypingIndicator() {
  return (
    <div class="flex items-center gap-1 px-4 py-3 bg-white rounded-2xl rounded-bl-sm w-fit shadow-sm">
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          class="w-2 h-2 bg-carrefour-blue rounded-full"
          animate={{ y: [0, -6, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

function StreamingBubble({ text }: { text: string }) {
  return (
    <div class="bg-white rounded-2xl rounded-bl-sm shadow-sm px-4 py-3 text-sm text-gray-800 max-w-[100%]">
      <div class="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
      <span
        class="inline-block w-0.5 h-3.5 bg-carrefour-blue rounded-sm ml-0.5 align-middle"
        style={{ animation: 'sgpt-blink .8s step-end infinite' }}
      />
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      class={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
    >
      {!isUser && (
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-1">
          <CarrefourLogo size={32} />
        </div>
      )}
      <div
        class={`max-w-[100%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
          isUser
            ? 'bg-carrefour-blue text-white rounded-br-sm'
            : 'bg-white text-gray-800 rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <div class="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
        <p class={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-400'}`}>
          {message.timestamp.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </motion.div>
  );
}

export function ChatPanel() {
  const { messages, isLoading, addMessage, setIsLoading, setProducts, setActiveTab, jwt, setJwt, store } =
    useShopperStore();
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, streamingText]);

  // ── SSE streaming ──────────────────────────────────────────────────────────
  useChatAnswer(
    question,
    jwt,
    (newJwt) => setJwt(newJwt),
    {
      onToken: (token) => {
        setStreamingText((prev) => prev + token);
      },
      onMeta: (meta: MetaPayload) => {
        const products = extractProductsFromMeta(meta);
        if (products.length > 0) {
          setProducts(products);
          setActiveTab('products');
        }
      },
      onComplete: (fullText) => {
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: fullText,
          timestamp: new Date(),
        });
        setStreamingText('');
        setIsLoading(false);
        setQuestion(null);
      },
      onError: (msg) => {
        addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `❌ Une erreur est survenue : ${msg}`,
          timestamp: new Date(),
        });
        setStreamingText('');
        setIsLoading(false);
        setQuestion(null);
      },
    }
  );

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    });
    setInput('');
    setStreamingText('');
    setIsLoading(true);
    setQuestion(text);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const isStreaming = isLoading && streamingText.length > 0;
  const isWaiting = isLoading && streamingText.length === 0;

  return (
    <div class="flex flex-col h-full">
      {/* Header */}
      <div class="bg-carrefour-blue text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
          <CarrefourLogo size={32} />
        </div>
        <div>
          <p class="font-semibold text-sm">Assistant Traiteur</p>
          <p class="text-xs text-blue-200">{store?.store_name ?? 'Carrefour'} · En ligne</p>
        </div>
        <div class="ml-auto w-2 h-2 bg-green-400 rounded-full" />
      </div>

      {/* Messages */}
      <div class="flex-1 overflow-y-auto p-4 bg-carrefour-bg">
        {messages.map(msg => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <AnimatePresence>
          {isWaiting && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              class="flex justify-start mb-3"
            >
              <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-1">
                <CarrefourLogo size={32} />
              </div>
              <TypingIndicator />
            </motion.div>
          )}
          {isStreaming && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              class="flex justify-start mb-3"
            >
              <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 mr-2 mt-1">
                <CarrefourLogo size={32} />
              </div>
              <StreamingBubble text={streamingText} />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div class="px-4 py-2 bg-white border-t border-gray-100 flex gap-2 overflow-x-auto flex-shrink-0">
        {['Pour 10 personnes', 'Moins de 80€', 'Sans allergènes', 'Voir les desserts'].map(
          suggestion => (
            <button
              key={suggestion}
              onClick={() => setInput(suggestion)}
              class="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-carrefour-blue text-carrefour-blue hover:bg-carrefour-blue hover:text-white transition-colors whitespace-nowrap"
            >
              {suggestion}
            </button>
          )
        )}
      </div>

      {/* Input */}
      <div class="px-4 py-3 bg-white border-t border-gray-100 flex items-end gap-2 flex-shrink-0">
        <textarea
          value={input}
          onInput={e => setInput((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="Posez votre question..."
          rows={1}
          class="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-carrefour-blue transition-colors max-h-24"
          style={{ minHeight: '42px' }}
        />
        <button
          onClick={() => setActiveTab('products')}
          title="Voir les produits"
          class="p-2.5 text-gray-400 hover:text-carrefour-blue transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            class="w-5 h-5"
          >
            <path d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        </button>
        <button
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
          class="p-2.5 bg-carrefour-blue text-white rounded-xl hover:bg-carrefour-lightBlue disabled:opacity-40 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
