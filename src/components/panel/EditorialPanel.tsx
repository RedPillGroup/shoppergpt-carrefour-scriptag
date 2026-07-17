import { h } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import EmblaCarousel, { EmblaCarouselType } from "embla-carousel";
import { EVENTS_TILES, HERO_SLIDES } from "./editorialData";
import leftSliderIcon from "../../assets/icons/left-slider.svg?raw";
import rightSliderIcon from "../../assets/icons/right-slider.svg?raw";

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

    const embla = EmblaCarousel(viewportRef.current, { loop: true });
    emblaApiRef.current = embla;

    const syncSelectedSlide = () => setIdx(embla.selectedScrollSnap());
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

  // Auto-advance every 4s — `loop: true` on the embla instance above means
  // scrollNext() just wraps back to the first slide, no bounds check needed.
  useEffect(() => {
    const id = setInterval(() => {
      emblaApiRef.current?.scrollNext();
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const prev = (e: MouseEvent) => { e.stopPropagation(); emblaApiRef.current?.scrollPrev(); };
  const next = (e: MouseEvent) => { e.stopPropagation(); emblaApiRef.current?.scrollNext(); };

  return (
    // Mobile: the slider fills the whole panel (event tiles hidden below, see
    // EditorialGrid) — title sits top-left directly on the photo, arrows sit low
    // and inset, no dark gradient/dots. Desktop keeps the original bottom-anchored
    // title + centered arrows + gradient + dots, unchanged.
    <div class="relative flex-1 md:basis-[30%] overflow-hidden">
      <div class="h-full overflow-hidden" ref={viewportRef}>
        <div class="flex h-full">
          {HERO_SLIDES.map((slide, i) => (
            <div
              key={i}
              // overflow-hidden: the mobile zoom (scale-[1.25] on the img below)
              // grows past this slide's own width, not just its height — without
              // clipping here that spills into the neighboring slide's space,
              // visible as a sliver of the next photo at the right edge.
              class="relative h-full min-w-0 flex-[0_0_100%] overflow-hidden cursor-pointer group"
              onClick={() => onSelect(slide.query)}
            >
              <img
                // origin-top: scale grows DOWN from the top edge instead of from
                // center — a center-origin scale pushes the top of the photo
                // upward past the container (cropping it away), which is exactly
                // what clipped the top here since object-top already anchors the
                // subject near the top.
                class="absolute inset-0 w-full h-full object-cover object-top origin-top scale-[1.45] md:scale-100 transition-transform duration-500 group-hover:scale-[1.5] md:group-hover:scale-[1.02]"
                src={slide.img}
                alt=""
              />
              {/* Desktop: shadow confined to the bottom third (fades to fully
                  transparent by mid-height), so the rest of the photo stays bright
                  instead of being washed out top-to-bottom. */}
              <div class="absolute inset-0 md:bg-[linear-gradient(to_top,rgba(0,0,0,.72)_0%,rgba(0,0,0,0)_70%)]" />
              {/* Mobile-only top shadow — keeps the title legible against the photo
                  right at the panel's top edge, without the full desktop gradient. */}
              <div class="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[rgba(0,0,0,.75)] to-transparent md:hidden" />
              <div class="absolute top-5 left-4 right-14 md:top-auto md:bottom-0 md:left-0 md:right-0 md:px-7 md:py-6">
                <p class="m-0 font-['Satisfy'] font-normal text-[32px] md:text-[clamp(32px,3.6vw,48px)] text-white leading-[1.2] md:leading-[1.25] whitespace-pre-line [text-shadow:0_2px_12px_rgba(0,0,0,.3)]">
                  {slide.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <button
        class="absolute top-[90%] md:top-1/2 -translate-y-1/2 left-5 md:left-5 w-9 h-9 md:w-11 md:h-11 border-0 bg-transparent p-0 flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,.2)] rounded-full z-[2] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,.28)] [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
        onClick={prev}
        aria-label="Précédent"
        dangerouslySetInnerHTML={{ __html: leftSliderIcon }}
      />
      <button
        class="absolute top-[90%] md:top-1/2 -translate-y-1/2 right-5 md:right-5 w-9 h-9 md:w-11 md:h-11 border-0 bg-transparent p-0 flex items-center justify-center shadow-[0_2px_10px_rgba(0,0,0,.2)] rounded-full z-[2] cursor-pointer hover:shadow-[0_4px_16px_rgba(0,0,0,.28)] [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
        onClick={next}
        aria-label="Suivant"
        dangerouslySetInnerHTML={{ __html: rightSliderIcon }}
      />
      <div class="hidden md:flex absolute bottom-3.5 left-1/2 -translate-x-1/2 gap-1.5 z-[2]">
        {HERO_SLIDES.map((_, i) => (
          <button
            key={i}
            class={`w-[7px] h-[7px] rounded-full border-0 p-0 cursor-pointer transition-all duration-200 ${i === idx ? "bg-white scale-[1.3]" : "bg-[rgba(255,255,255,.5)]"}`}
            onClick={(e) => { (e as MouseEvent).stopPropagation(); emblaApiRef.current?.scrollTo(i); }}
          />
        ))}
      </div>
    </div>
  );
}

function EditorialGrid({ onSelect }: Props) {
  // Hidden on mobile — the hero slider fills the whole panel there instead.
  return (
    <div class="hidden md:flex md:flex-1 flex-col overflow-hidden p-3 gap-2.5 min-h-0">
      <div class="flex-1 grid grid-cols-2 gap-2.5 min-h-0">
        {EVENTS_TILES.map((tile, i) => (
          <EventEditorialTile key={i} tile={tile} onSelect={onSelect} />
        ))}
      </div>
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
