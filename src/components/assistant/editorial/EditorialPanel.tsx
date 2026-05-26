import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import EmblaCarousel, { EmblaCarouselType } from "embla-carousel";
import { PRODUCT_TILES, EVENTS_TILES, HERO_SLIDES } from "./data";

interface Props {
  onSelect: (query: string) => void;
}

const EVENT_TILE_OVERLAY_CLASS =
  "absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,.18)] via-[rgba(0,0,0,.35)] to-[rgba(0,0,0,.72)]";
const EVENT_TILE_TEXT_WRAP_CLASS =
  "absolute bottom-0 left-0 right-0 px-2.5 py-2 md:px-3.5 md:py-3 flex flex-col gap-0.5";
const EVENT_TILE_BADGE_CLASS =
  "text-[10px] md:text-[12px] font-semibold tracking-[0.08em] uppercase text-[rgba(255,255,255,.85)]";
const EVENT_TILE_TITLE_CLASS =
  "m-0 text-[16px] md:text-[22px] font-['Satisfy'] font-normal text-white ";

function EventEditorialTile({
  tile,
  onSelect,
}: {
  tile: { img: string; badge: string; title: string; query: string };
  onSelect: (query: string) => void;
}) {
  return (
    <div
      class="relative overflow-hidden cursor-pointer border border-[rgba(255,255,255,.15)] group min-h-0"
      onClick={() => onSelect(tile.query)}
    >
      <img
        class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        src={tile.img}
        alt=""
        loading="lazy"
      />
      <div class={EVENT_TILE_OVERLAY_CLASS} />
      <div class={EVENT_TILE_TEXT_WRAP_CLASS}>
        <span class={EVENT_TILE_BADGE_CLASS}>{tile.badge}</span>
        <p class={EVENT_TILE_TITLE_CLASS}>{tile.title}</p>
      </div>
    </div>
  );
}

function HeroCarousel({ onSelect }: Props) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const emblaApiRef = useRef<EmblaCarouselType | null>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!viewportRef.current) return;

    const embla = EmblaCarousel(viewportRef.current, {
      loop: true,
    });
    emblaApiRef.current = embla;

    const syncSelectedSlide = () => {
      setIdx(embla.selectedScrollSnap());
    };

    syncSelectedSlide();
    embla.on("select", syncSelectedSlide);
    embla.on("reInit", syncSelectedSlide);

    return () => {
      embla.off("select", syncSelectedSlide);
      embla.off("reInit", syncSelectedSlide);
      embla.destroy();
      emblaApiRef.current = null;
    };
  }, []);

  const prev = (e: MouseEvent) => {
    e.stopPropagation();
    emblaApiRef.current?.scrollPrev();
  };

  const next = (e: MouseEvent) => {
    e.stopPropagation();
    emblaApiRef.current?.scrollNext();
  };

  return (
    <div class="relative basis-1/2 md:basis-[55%] overflow-hidden">
      <div class="h-full overflow-hidden" ref={viewportRef}>
        <div class="flex h-full">
          {HERO_SLIDES.map((slide, i) => (
            <div
              key={i}
              class="relative h-full min-w-0 flex-[0_0_100%] cursor-pointer group"
              onClick={() => onSelect(slide.query)}
            >
              <img
                class="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.02]"
                src={slide.img}
                alt=""
              />
              <div class="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,.22)] via-[rgba(0,0,0,.38)] to-[rgba(0,0,0,.72)]" />
              <div class="absolute bottom-0 left-0 right-0 px-4 py-4 md:px-7 md:py-6">
                <p class="m-0 font-['Satisfy'] font-normal text-[24px] md:text-[clamp(26px,3vw,40px)] text-white leading-[1.2] md:leading-[1.25] whitespace-pre-line [text-shadow:0_2px_12px_rgba(0,0,0,.3)]">
                  {slide.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button class="absolute top-1/2 -translate-y-1/2 left-2.5 md:left-3.5 w-8 h-8 md:w-9 md:h-9 rounded-full border-0 bg-white text-[#333] text-[18px] md:text-[20px] leading-none flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,.2)] z-[2] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,.28)]" onClick={prev}>‹</button>
      <button class="absolute top-1/2 -translate-y-1/2 right-2.5 md:right-3.5 w-8 h-8 md:w-9 md:h-9 rounded-full border-0 bg-white text-[#333] text-[18px] md:text-[20px] leading-none flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,.2)] z-[2] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,.28)]" onClick={next}>›</button>
      <div class="absolute bottom-2.5 md:bottom-3.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-[2]">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            class={`w-[7px] h-[7px] rounded-full border-0 p-0 cursor-pointer transition-all duration-200 ${i === idx ? "bg-white scale-[1.3]" : "bg-[rgba(255,255,255,.5)]"}`}
            onClick={(e) => {
              (e as MouseEvent).stopPropagation();
              emblaApiRef.current?.scrollTo(i);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function EditorialGrid({ onSelect }: Props) {
  const leftEvent = EVENTS_TILES[0];
  const rightEvent = EVENTS_TILES[1];

  return (
    <div class="flex-1 grid grid-cols-2 gap-3 overflow-hidden p-3">
      <div class="grid grid-rows-2 gap-2.5 min-h-0">
        {leftEvent && (
          <EventEditorialTile tile={leftEvent} onSelect={onSelect} />
        )}

        <div class="grid grid-cols-2 gap-2.5 min-h-0">
          {PRODUCT_TILES.slice(0, 2).map((product, i) => (
            <div
              key={i}
              class="relative overflow-hidden cursor-pointer border border-[rgba(255,255,255,.15)] group min-h-0"
              onClick={() => onSelect(product.query)}
            >
              <img
                class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                src={product.img}
                alt=""
                loading="lazy"
              /> 
              <div class="absolute inset-0 bg-gradient-to-b from-[rgba(0,0,0,.14)] via-[rgba(0,0,0,.3)] to-[rgba(0,0,0,.7)]" />
              <div class="absolute bottom-0 left-0 right-0 px-2 py-1.5 md:px-2.5 md:py-2 flex flex-col">
                <span class="text-[11px] md:text-[15px] font-400 text-white leading-none [text-shadow:0_2px_8px_rgba(0,0,0,.35)]">
                  {product.price}
                </span>
                <p class="m-0 mt-0.5 text-[8px] md:text-[11px] text-white leading-[1.2] whitespace-pre-line [text-shadow:0_2px_8px_rgba(0,0,0,.35)]">
                  {product.name}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {rightEvent && (
        <EventEditorialTile tile={rightEvent} onSelect={onSelect} />
      )}
    </div>
  );
}

export function EditorialPanel({ onSelect }: Props) {
  return (
    <div class="flex-1 flex flex-col overflow-hidden min-h-0">
      <HeroCarousel onSelect={onSelect} />
      <EditorialGrid onSelect={onSelect} />
    </div>
  );
}
