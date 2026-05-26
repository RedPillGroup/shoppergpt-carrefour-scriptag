import { h } from "preact";
import { useRef, useEffect, useState, useCallback } from "preact/hooks";
import ReactMarkdown from "react-markdown";
import { useShopperStore } from "../store";
import { Message, Product } from "../types";
import { dispatchCartUpdated } from "../events";
import { useChatAnswer, MetaPayload } from "../hooks/useChatAnswer";
import { extractProducts } from "../utils/productExtractor";
import logoSrc from "../../assets/logo.svg";

function CarrefourLogo({ size = 32 }: { size?: number }) {
  return <img src={logoSrc} width={size} height={size} alt="Carrefour" style={{ objectFit: "contain" }} />;
}

function CarrefourAvatar() {
  return (
    <div class="msg-avatar">
      <CarrefourLogo size={30} />
    </div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div class="typing-row">
      <CarrefourAvatar />
      <div class="typing-bubble">
        <div class="typing-dot" />
        <div class="typing-dot" />
        <div class="typing-dot" />
      </div>
    </div>
  );
}

// ── Streaming bubble (live token-by-token display) ────────────────────────────
function StreamingBubble({ text }: { text: string }) {
  return (
    <div class="typing-row">
      <CarrefourAvatar />
      <div class="msg-bubble streaming-bubble">
        <ReactMarkdown>{text}</ReactMarkdown>
        <span class="streaming-cursor" />
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div class={`msg-row ${message.role}`}>
      {!isUser && <CarrefourAvatar />}
      <div>
        <div class="msg-bubble">
          {isUser ? (
            <span>{message.content}</span>
          ) : (
            <ReactMarkdown>{message.content}</ReactMarkdown>
          )}
        </div>
        <div class="msg-time">
          {message.timestamp.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

// ── Product card ──────────────────────────────────────────────────────────────
function ProductCard({ product }: { product: Product }) {
  const { cartItems, addToCart, removeFromCart, sessionId, store } = useShopperStore();
  const inCart = cartItems.includes(product.id);

  const toggle = (e: MouseEvent) => {
    e.stopPropagation();
    if (inCart) {
      removeFromCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: "remove" });
    } else {
      addToCart(product.id);
      dispatchCartUpdated({ success: true, product_id: product.id, action: "add" });
    }
    console.log("[ShopperGPT] cart:", { product_id: product.id, store_id: store?.store_id, session_id: sessionId });
  };

  return (
    <div class={`pcard${inCart ? " in-cart" : ""}`}>
      <div class="pcard-img-wrap">
        <img class="pcard-img" src={product.image} alt={product.name} loading="lazy" />
        <div class="pcard-badge">{product.category}</div>
        <div class="pcard-added-badge">✓ Ajouté</div>
      </div>
      <div class="pcard-body">
        <div class="pcard-name">{product.name}</div>
        <div class="pcard-persons">
          Pour {product.persons} personnes · {(product.price / product.persons).toFixed(2).replace(".", ",")} €/pers.
        </div>
        {product.allergens.length > 0 && (
          <div class="pcard-allergens">
            {product.allergens.map((a) => (
              <span key={a} class="pcard-allergen">⚠ {a}</span>
            ))}
          </div>
        )}
        <div class="pcard-footer">
          <div>
            <div class="pcard-price">{product.price.toFixed(2).replace(".", ",")} €</div>
            <div class="pcard-price-sub">Prix TTC</div>
          </div>
          <button onClick={toggle} class={`pcard-add ${inCart ? "added" : "default"}`}>
            {inCart ? "✓ Ajouté" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main full-page app ────────────────────────────────────────────────────────
export function FullPageApp() {
  const { messages, addMessage, isLoading, setIsLoading, jwt, setJwt, store } = useShopperStore();
  const [input, setInput] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [productsTitle, setProductsTitle] = useState("Nos suggestions");
  const [productsSubtitle, setProductsSubtitle] = useState("Démarrez la conversation pour des recommandations personnalisées");
  const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
  const [panelVisible, setPanelVisible] = useState(true);
  const [panelKey, setPanelKey] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  const updatePanel = useCallback((title: string, subtitle: string, products: Product[]) => {
    setPanelVisible(false);
    setTimeout(() => {
      setProductsTitle(title);
      setProductsSubtitle(subtitle);
      setDisplayedProducts(products);
      setPanelKey((k) => k + 1);
      setPanelVisible(true);
    }, 280);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
        const results = meta.tool_results ?? [];
        if (results.length > 0) {
          const products = extractProducts(results);
          if (products.length > 0) {
            updatePanel(
              "Suggestions personnalisées",
              `${products.length} produit${products.length > 1 ? "s" : ""} recommandé${products.length > 1 ? "s" : ""}`,
              products
            );
          }
        }
      },
      onComplete: (fullText) => {
        addMessage({
          id: Date.now().toString(),
          role: "assistant",
          content: fullText,
          timestamp: new Date(),
        });
        setStreamingText("");
        setIsLoading(false);
        setQuestion(null);
      },
      onError: (msg) => {
        addMessage({
          id: Date.now().toString(),
          role: "assistant",
          content: `❌ Une erreur est survenue : ${msg}`,
          timestamp: new Date(),
        });
        setStreamingText("");
        setIsLoading(false);
        setQuestion(null);
      },
    }
  );

  const send = () => {
    const text = input.trim();
    if (!text || isLoading) return;

    addMessage({ id: Date.now().toString(), role: "user", content: text, timestamp: new Date() });
    setInput("");
    setStreamingText("");
    setIsLoading(true);
    setQuestion(text);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Whether we're actively streaming tokens
  const isStreaming = isLoading && streamingText.length > 0;
  const isWaiting = isLoading && streamingText.length === 0;

  return (
    <div class="sgpt-fullpage">
      {/* BODY */}
      <div class="sgpt-body">

        {/* LEFT — CHAT */}
        <div class="sgpt-chat">
          <div class="chat-header">
            <div class="chat-avatar">
              <CarrefourLogo size={40} />
            </div>
            <div class="chat-header-info">
              <div class="chat-header-name">Assistant Traiteur</div>
              <div class="chat-header-status">
                <div class="status-dot" />
                En ligne · {store?.store_name ?? "Carrefour"}
              </div>
            </div>
          </div>

          <div class="messages-area">
            {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
            {isWaiting && <TypingIndicator />}
            {isStreaming && <StreamingBubble text={streamingText} />}
            <div ref={bottomRef} />
          </div>

          <div class="quick-replies">
            {["🎂 Anniversaire", "💼 Événement pro", "🥗 Sans allergènes", "💰 Moins de 80 €", "👥 Pour 10 personnes"].map((s) => (
              <button key={s} class="quick-btn" onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>

          <div class="input-bar">
            <button class="input-btn btn-mic" title="Microphone">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
              </svg>
            </button>
            <textarea
              class="chat-input"
              rows={1}
              placeholder="Posez votre question..."
              value={input}
              onInput={(e) => setInput((e.target as HTMLTextAreaElement).value)}
              onKeyDown={handleKey}
            />
            <button
              class="input-btn btn-send"
              onClick={send}
              disabled={!input.trim() || isLoading}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        {/* RIGHT — PRODUCTS */}
        <div class="sgpt-products">
          {displayedProducts.length > 0 && (
            <div class="products-header">
              <div>
                <div class="products-title">{productsTitle}</div>
                <div class="products-subtitle">{productsSubtitle}</div>
              </div>
              <div class="products-count">
                {displayedProducts.length} produit{displayedProducts.length > 1 ? "s" : ""}
              </div>
            </div>
          )}
          <div class="products-scroll">
            <div key={panelKey} class={`panel-transition ${panelVisible ? "panel-visible" : "panel-hidden"}`}>
              {displayedProducts.length === 0 ? (
                <div class="empty-state">
                  <img
                    src="https://images.unsplash.com/photo-1555244162-803834f70033?w=1600&q=90&fit=crop"
                    alt="Buffet traiteur Carrefour"
                    class="empty-hero-img"
                  />
                  <div class="empty-hero-overlay" />
                  <div class="empty-hero-content">
                    <p class="empty-hero-title">Votre traiteur,<br />sur mesure.</p>
                    <p class="empty-hero-text">Dites-moi quel événement vous préparez et je vous proposerai les plateaux parfaits.</p>
                  </div>
                </div>
              ) : (
                <div class="products-grid">
                  {displayedProducts.map((p) => <ProductCard key={p.id} product={p} />)}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
