import { h } from 'preact';
import pictoApero from '../../assets/icons/PictoApero.svg?raw';
import pictoBoissons from '../../assets/icons/PictoBoissons.svg?raw';
import pictoDeco from '../../assets/icons/PictoDeco.svg?raw';
import pictoDessert from '../../assets/icons/PictoDessert.svg?raw';
import pictoEntrees from '../../assets/icons/PictoEntrees.svg?raw';
import pictoFromages from '../../assets/icons/PictoFromages.svg?raw';
import pictoPlats from '../../assets/icons/PictoPlats.svg?raw';
import pictoBread from '../../assets/icons/picto-bread.svg?raw';
import pictoSauces from '../../assets/icons/picto-sauces.svg?raw';
import pictoPetitDej from '../../assets/icons/petit dej.svg?raw';

/** Normalise a step name so accent/case variants still match. */
function normalizeKey(step: string): string {
  return step.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Renders a raw SVG icon file as-is, just forcing its color to the current text
 * color so it tints along with the tab bar's active/inactive state — the source
 * files ship with a fixed gray color baked in. Most icons are solid fills;
 * `petit dej.svg` is a stroke-only line icon (fill="none" at the root), so it
 * needs `stroke-current` instead — forcing fill-current on it would override
 * the inherited fill="none" and turn the outline into a solid blob. */
function RawIcon({ svg, size, mode = 'fill' }: { svg: string; size: number; mode?: 'fill' | 'stroke' }) {
  return (
    <span
      class={`inline-flex [&_svg]:block [&_svg]:w-full [&_svg]:h-full ${
        mode === 'fill' ? '[&_path]:fill-current' : '[&_path]:stroke-current'
      }`}
      style={{ width: `${size}px`, height: `${size}px` }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

/** Return the matching icon JSX for a menu step, or null if unrecognised. */
export function getStepIcon(step: string, size = 22): h.JSX.Element | null {
  const key = normalizeKey(step);
  const map: Record<string, h.JSX.Element> = {
    aperitifs:      <RawIcon svg={pictoApero} size={size} />,
    entrees:        <RawIcon svg={pictoEntrees} size={size} />,
    plats:          <RawIcon svg={pictoPlats} size={size} />,
    sauces:         <RawIcon svg={pictoSauces} size={size} />,
    fromages:       <RawIcon svg={pictoFromages} size={size} />,
    desserts:       <RawIcon svg={pictoDessert} size={size} />,
    boissons:       <RawIcon svg={pictoBoissons} size={size} />,
    pains:          <RawIcon svg={pictoBread} size={size} />,
    'petit dej':    <RawIcon svg={pictoPetitDej} size={size} mode="stroke" />,
    'table & deco': <RawIcon svg={pictoDeco} size={size} />,
  };
  return map[key] ?? null;
}
