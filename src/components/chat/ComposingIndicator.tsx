import { h } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * "Cathia is composing" status line — Claude/OpenAI style.
 *
 * Mounted ONLY after the backend's early `event: phase` confirms a long, blocking
 * tool (compose_menu) has started — so it never shows on quick/normal turns (those
 * keep the plain TypingIndicator). Because the gate is a real backend signal, the
 * stages start immediately at t=0.
 *
 * No bubble, no bouncing dots: a single greyed line whose text shimmers (a light
 * band sweeps across) with a static "…" — alive without motion-y dots. The backend
 * can't stream the compose SUB-steps in real time (one blocking call), so the labels
 * advance on a timer CALIBRATED to the observed pipeline from t=0 (= compose start):
 *   search (~0-3s) → compose (~3-11s) → coherence refine (~11-20s) → budget (~20s+).
 */

interface Stage {
  /** ms after mount (= compose start) at which this stage's label kicks in. */
  at: number;
  label: string;
}

const STAGES: Stage[] = [
  { at: 0, label: 'Je recherche les meilleurs produits' },
  { at: 3000, label: 'Je compose votre menu' },
  { at: 11000, label: 'J’affine les accords et la cohérence' },
  { at: 20000, label: 'Je vérifie le budget' },
];

export function ComposingIndicator() {
  // Starts at stage 0 immediately — we only mount on a real compose signal.
  const [stage, setStage] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const timers = STAGES.map((s, i) =>
      s.at === 0 ? -1 : window.setTimeout(() => setStage(i), s.at)
    );
    return () => timers.forEach(t => t !== -1 && window.clearTimeout(t));
  }, []);

  const label = STAGES[stage].label;

  // Reduced motion: plain muted text, no shimmer sweep.
  const shimmerStyle = shouldReduceMotion
    ? { color: '#9a9082' }
    : {
        backgroundImage:
          'linear-gradient(90deg, #b3a994 0%, #b3a994 35%, #6b6256 50%, #b3a994 65%, #b3a994 100%)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        color: 'transparent',
      };

  return (
    <div class="flex mb-2 md:mb-2.5 pl-0.5">
      <AnimatePresence mode="wait">
        <motion.span
          key={stage}
          class={`text-[10px] md:text-[12px] leading-relaxed tracking-[0.01em] select-none ${
            shouldReduceMotion ? '' : 'animate-shimmer'
          }`}
          style={shimmerStyle}
          initial={shouldReduceMotion ? undefined : { opacity: 0, y: 3 }}
          animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? undefined : { opacity: 0, y: -3 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          {label}...
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
