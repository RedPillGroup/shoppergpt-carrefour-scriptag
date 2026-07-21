import { h } from 'preact';
import { useRef, useEffect, useState, useCallback } from 'preact/hooks';
import submitIcon from '../../assets/icons/submit.svg?raw';
import micIcon from '../../assets/icons/mic.svg?raw';
import { transcribeAudio } from '../../api/transcription';

interface Props {
  input: string;
  isLoading: boolean;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  /** Fired when the textarea gains/loses focus — mobile-only use is to show
   * just the chat (hide the product/menu panel entirely) while typing, since
   * fighting the iOS keyboard + its accessory bar for space isn't worth it —
   * simpler to just not compete for space at all (see AssistantExperience). */
  onFocus?: () => void;
  onBlur?: () => void;
}

/** Every MediaRecorder mime type worth trying, most-preferred first. Safari/iOS
 * never supports the webm ones at all (no codec for it), and — a known WebKit
 * quirk — `isTypeSupported('audio/mp4')` can report true while the MediaRecorder
 * constructor still throws for that exact (codec-less) string, only accepting
 * the fully codec-qualified form. So the codec-qualified mp4 variant is tried
 * BEFORE the bare one, and startRecording (below) still retries with no
 * mimeType at all if every candidate throws at construction time. */
function candidateMimeTypes(): string[] {
  const prefs = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4;codecs=mp4a.40.2',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined;
  if (!MR?.isTypeSupported) return [];
  return prefs.filter(t => MR.isTypeSupported(t));
}

/** Construct a MediaRecorder, trying each supported mimeType in turn and
 * finally no mimeType at all (browser default) — isTypeSupported() saying yes
 * doesn't guarantee the constructor will actually accept that exact string
 * (see candidateMimeTypes' comment), so this is the real safety net. */
function createRecorder(stream: MediaStream): MediaRecorder {
  const candidates = [...candidateMimeTypes(), undefined];
  let lastErr: unknown;
  for (const mimeType of candidates) {
    try {
      return new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error('MediaRecorder unavailable');
}

// Silence auto-stop tuning. SILENCE_MS of continuous quiet ends the recording
// automatically; MIN_RECORDING_MS guards against a stray sub-second clip if the
// user pauses right after tapping the mic (before they've said anything yet).
const SILENCE_THRESHOLD = 0.02; // RMS amplitude (0-1) below this counts as "quiet"
const SILENCE_MS = 3000;
const MIN_RECORDING_MS = 700;
// Chirp/Speech-to-Text rejects anything over 60s with a 400 ("Audio can be of
// a maximum of 60 seconds") — auto-stop a couple seconds early so the clip we
// actually send is always under that ceiling, rather than surfacing that as a
// transcription error after the fact.
const MAX_RECORDING_MS = 58_000;

// Bar pitch (visual style ported from an existing RecordingDots component
// elsewhere in this codebase — vertical bars with a bouncing scaleY feel —
// but each bar's height here is driven by real frequency-domain mic data
// instead of a canned CSS keyframe loop shared by every bar). The COUNT is
// proportional to the container's actual measured width (see the
// ResizeObserver effect below) — one bar+gap every WAVE_BAR_PITCH px — so
// bar density stays visually consistent across screen sizes instead of a
// fixed count that would look sparse on a wide screen or crowded on a
// narrow one.
const WAVE_BAR_PITCH = 6.5; // px per bar, including its gap
const WAVE_BAR_COUNT_FALLBACK = 40; // used only before the first real measurement
const WAVE_BAR_COUNT_MIN = 10;
const WAVE_BAR_COUNT_MAX = 80;
const WAVE_BAR_MIN_HEIGHT = 3; // px, floor so a bar is never invisible at rest
const WAVE_BAR_MAX_HEIGHT = 22; // px, matches this pill's ~28-32px inner height

/** Two-note synthesized chime (Web Audio oscillator, no audio asset needed) —
 * an ascending blip on start, descending on stop, so recording state is audible
 * as well as visible. Lazily creates/reuses one AudioContext across taps. */
function useChime() {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return null;
      ctxRef.current = new Ctor();
    }
    // iOS suspends new contexts until resumed from a user gesture — the mic
    // button tap that triggers this IS that gesture, so resume is safe here.
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback((freqFrom: number, freqTo: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(freqTo, ctx.currentTime + 0.11);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.13);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  }, [getCtx]);

  return {
    playStart: useCallback(() => play(600, 900), [play]),
    playStop: useCallback(() => play(700, 450), [play]),
  };
}

export function ChatInputBar({ input, isLoading, onInputChange, onSend, onKeyDown, onFocus, onBlur }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Surfaces mic/recording failures that used to be console-only (silent from
  // the user's POV — tapping the mic just appeared to do nothing). Clears
  // itself a few seconds later or as soon as the user taps the mic again.
  const [micError, setMicError] = useState<string | null>(null);
  const micErrorTimeoutRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Keep the latest input in a ref so the recorder's async stop handler appends
  // to the current value without stale-closure issues.
  const inputRef = useRef(input);
  inputRef.current = input;
  const { playStart, playStop } = useChime();

  // Silence-detection plumbing — an AudioContext/Analyser graph tapped off the
  // same mic stream, polled on a rAF loop while recording. The same analyser
  // also drives the waveform amplitude below (see startSilenceWatch) — one
  // audio graph feeding both, rather than standing up a second one.
  const silenceAudioCtxRef = useRef<AudioContext | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
  // Bar-based live waveform (visual style ported from RecordingDots, driven
  // by real frequency data instead of a canned CSS loop — see WAVE_BAR_PITCH
  // above). Each bar's HEIGHT is written directly to its own div's
  // style.height on every animation frame (see tick()/idleLoop below)
  // instead of Preact state, so animating never re-renders the component —
  // only the bar COUNT is Preact state (barCount), since changing how many
  // <div>s exist genuinely needs a render; barCountRef mirrors it for tick()
  // (a stable closure — see startSilenceWatch) to read the live value
  // without needing to be recreated whenever the count changes.
  const waveBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const waveContainerRef = useRef<HTMLDivElement | null>(null);
  const [barCount, setBarCount] = useState(WAVE_BAR_COUNT_FALLBACK);
  const barCountRef = useRef(barCount);
  barCountRef.current = barCount;
  const smoothedRmsRef = useRef(0);
  // stopRecording is defined below but the silence loop (started inside
  // startRecording) needs to call the LATEST version without re-running the
  // effect chain — a ref sidesteps the ordering/circular-dependency issue.
  const stopRecordingRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  const stopSilenceWatch = useCallback(() => {
    if (silenceRafRef.current != null) cancelAnimationFrame(silenceRafRef.current);
    silenceRafRef.current = null;
    silenceStartedAtRef.current = null;
    void silenceAudioCtxRef.current?.close();
    silenceAudioCtxRef.current = null;
  }, []);

  // Release the mic if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach(t => t.stop());
      stopSilenceWatch();
      if (micErrorTimeoutRef.current != null) window.clearTimeout(micErrorTimeoutRef.current);
    };
  }, [stopSilenceWatch]);

  // Keeps the bar COUNT proportional to the container's real rendered width
  // (one bar+gap per WAVE_BAR_PITCH px) — live, via ResizeObserver, so it
  // adapts on window resize/orientation change too, not just once at mount.
  // Depends on `recording` since the container only exists in the DOM while
  // actively recording (see JSX) — this re-runs (and finds a real target)
  // each time a recording starts.
  useEffect(() => {
    if (!recording) return;
    const container = waveContainerRef.current;
    if (!container) return;
    const resize = () => {
      const width = container.getBoundingClientRect().width;
      const next = Math.round(width / WAVE_BAR_PITCH);
      setBarCount(Math.min(WAVE_BAR_COUNT_MAX, Math.max(WAVE_BAR_COUNT_MIN, next)));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [recording]);

  const startSilenceWatch = useCallback((stream: MediaStream) => {
    smoothedRmsRef.current = 0;
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return; // no Web Audio support — silence auto-stop just won't trigger, recording still works
    const ctx = new Ctor();
    silenceAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    // Separate buffer for the bars — frequency-domain data reads as a much
    // more natural "equalizer" bar animation for actual speech than the
    // time-domain waveform above (which is what RMS/silence-detection uses).
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      // Read live each frame (not captured once above) since barCount can
      // change mid-recording if the window resizes.
      const barCountNow = barCountRef.current;
      const binsPerBar = Math.max(1, Math.floor(freqData.length / barCountNow));
      analyser.getByteTimeDomainData(data);
      // RMS of the (centered) waveform — 0 when perfectly silent, ~1 when clipping.
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);

      // EMA-smoothed RMS — still used for the silence-detection threshold
      // below (raw per-frame RMS jitters too much for a clean threshold check).
      smoothedRmsRef.current += (rms - smoothedRmsRef.current) * 0.3;

      // Bars — genuinely derived from the mic's current frequency spectrum
      // (not a canned/looping animation), averaged into barCountNow buckets
      // and written straight to each bar's height. Real per-bucket variation
      // across the spectrum already gives a natural equalizer look without
      // needing extra per-bar smoothing.
      analyser.getByteFrequencyData(freqData);
      for (let bar = 0; bar < barCountNow; bar++) {
        const el = waveBarRefs.current[bar];
        if (!el) continue;
        const start = bar * binsPerBar;
        let sum = 0;
        for (let i = start; i < start + binsPerBar; i++) sum += freqData[i] ?? 0;
        const avg = sum / binsPerBar / 255; // 0-1
        el.style.height = `${WAVE_BAR_MIN_HEIGHT + avg * (WAVE_BAR_MAX_HEIGHT - WAVE_BAR_MIN_HEIGHT)}px`;
      }

      const now = performance.now();
      const recordedFor = now - recordingStartedAtRef.current;
      // Hard ceiling regardless of silence state — even continuous speech
      // has to stop before the backend's 60s limit, or the whole clip gets
      // rejected outright (see MAX_RECORDING_MS above) instead of just
      // transcribing what was said so far.
      if (recordedFor >= MAX_RECORDING_MS) {
        stopRecordingRef.current();
        return;
      }
      if (rms < SILENCE_THRESHOLD) {
        if (silenceStartedAtRef.current == null) silenceStartedAtRef.current = now;
        const silentFor = now - silenceStartedAtRef.current;
        if (silentFor >= SILENCE_MS && recordedFor >= MIN_RECORDING_MS) {
          stopRecordingRef.current();
          return; // stopSilenceWatch (called from stop) tears this loop down
        }
      } else {
        silenceStartedAtRef.current = null;
      }
      silenceRafRef.current = requestAnimationFrame(tick);
    };
    silenceRafRef.current = requestAnimationFrame(tick);
  }, []);

  const showMicError = useCallback((message: string) => {
    setMicError(message);
    if (micErrorTimeoutRef.current != null) window.clearTimeout(micErrorTimeoutRef.current);
    micErrorTimeoutRef.current = window.setTimeout(() => setMicError(null), 4000);
  }, []);

  const startRecording = useCallback(async () => {
    setMicError(null);
    let stream: MediaStream;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        // Most common cause on iOS: no secure context (plain HTTP) or an
        // in-app webview (Instagram/TikTok/etc.) that blocks getUserMedia
        // outright — neither is fixable from in-page code, so say so plainly
        // instead of just doing nothing.
        showMicError('Micro indisponible sur ce navigateur');
        return;
      }
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('[shoppergpt] microphone access denied', err);
      showMicError('Accès au micro refusé');
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = createRecorder(stream);
    } catch (err) {
      // Constructing the recorder failed for every candidate mimeType (see
      // createRecorder) — release the mic we just acquired instead of leaving
      // it open with nothing using it.
      console.error('[shoppergpt] MediaRecorder unavailable', err);
      stream.getTracks().forEach(t => t.stop());
      showMicError('Enregistrement audio indisponible');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      stopSilenceWatch();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size === 0) return;
      setTranscribing(true);
      try {
        const text = await transcribeAudio(blob);
        if (text) {
          const current = inputRef.current;
          onInputChange(current ? `${current} ${text}` : text);
        } else {
          // Empty transcript for a clip that clearly wasn't instant/silent —
          // surface it instead of leaving the user wondering why nothing typed.
          showMicError('Rien entendu, réessayez');
        }
      } catch (err) {
        console.error('[shoppergpt] transcription failed', err);
        // Temporarily surfacing the raw error (status code / "Failed to
        // fetch" / etc.) instead of a generic message — needed to tell apart
        // a backend HTTP error from a network/CORS failure on mobile, which
        // otherwise both just read as "doesn't work" with no way to diagnose
        // remotely. Revert to a plain message once the mobile cause is confirmed.
        const detail = err instanceof Error ? err.message : String(err);
        showMicError(`Transcription indisponible: ${detail}`);
      } finally {
        setTranscribing(false);
      }
    };

    recorder.start();
    recorderRef.current = recorder;
    recordingStartedAtRef.current = performance.now();
    setRecording(true);
    playStart();
    startSilenceWatch(stream);
  }, [onInputChange, playStart, showMicError, startSilenceWatch, stopSilenceWatch]);

  const stopRecording = useCallback(() => {
    if (!recorderRef.current) return;
    recorderRef.current.stop();
    recorderRef.current = null;
    setRecording(false);
    playStop();
  }, [playStop]);
  stopRecordingRef.current = stopRecording;

  const toggleRecording = useCallback(() => {
    if (recording) stopRecording();
    else startRecording();
  }, [recording, startRecording, stopRecording]);

  return (
    <div class="py-2.5 px-3.5 md:py-3.5 md:px-[18px] border-t border-[#E8ECF0] flex items-center gap-1.5 md:gap-2 shrink-0 bg-white">
      <div class="relative flex-1 rounded-3xl min-h-9 md:min-h-10 px-1.5 py-1 flex items-center gap-1 border border-black/50">
        {/* Live waveform — visual style ported from an existing RecordingDots
            component (vertical bars, bouncing feel), but each bar's height
            is driven by the mic's real frequency-domain data every
            animation frame (see tick() in startSilenceWatch) — not every bar
            sharing one canned CSS keyframe loop. The COUNT (barCount) is
            proportional to this container's actual measured width (see the
            ResizeObserver effect above), so density stays consistent across
            screen sizes. Only rendered while actively recording;
            pointer-events-none so it never blocks typing/clicks. */}
        {recording && (
          <div
            ref={waveContainerRef}
            class="absolute inset-y-0 left-5 right-14 bg-white pointer-events-none overflow-hidden flex items-center gap-[1.5px] opacity-60"
          >
            {Array.from({ length: barCount }).map((_, i) => (
              <div
                key={i}
                ref={el => { waveBarRefs.current[i] = el; }}
                class="flex-1 min-w-[1px] bg-[#E2422B]"
                style={{ height: `${WAVE_BAR_MIN_HEIGHT}px` }}
              />
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          // text-[16px]: iOS Safari auto-zooms the whole page on focus for any
          // input/textarea with a computed font-size under 16px — this is the
          // minimum that avoids it, not a design choice. md: reverts to the
          // smaller size since that zoom-on-focus behavior is mobile-only.
          // While recording, the text/placeholder/caret are all made
          // transparent — the bars overlay above already has its own opaque
          // bg-white, but the textarea itself would otherwise still show
          // through around/under it. Fully hides it, not just visually
          // covers it, so nothing peeks out.
          class={`flex-1 bg-transparent border-0 py-1.5 px-2.5 md:px-3 text-[16px] md:text-[13.5px] resize-none outline-none leading-[1.4] max-h-[90px] min-h-0 overflow-y-auto ${
            recording
              ? 'text-transparent placeholder:text-transparent caret-transparent'
              : 'text-[#1A1A2E] placeholder:text-[#B0A898]'
          }`}
          rows={1}
          placeholder={transcribing ? 'Transcription en cours…' : 'Je voudrais...'}
          value={input}
          onInput={e => onInputChange((e.target as HTMLTextAreaElement).value)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          // This is a chat prompt, not a form field — discourages iOS's
          // AutoFill suggestion icons (passwords/payment/addresses) from
          // showing over the keyboard. Doesn't remove Safari's "Done"/arrows
          // accessory bar itself (that's OS chrome, not addressable from a
          // web page at all), but it's the one part we can influence.
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellcheck={false}
        />

        <button
          class="w-[32px] h-[32px] md:w-[36px] md:h-[36px] bg-[#E2422B] border-0 rounded-full flex items-center justify-center cursor-pointer shrink-0 transition-all hover:bg-[#C73A25] active:scale-[.93] disabled:bg-[#E8A99E] disabled:cursor-not-allowed"
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          title="Envoyer"
        >
          <span
            class="inline-flex w-[16px] h-[16px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
            dangerouslySetInnerHTML={{ __html: submitIcon }}
          />
        </button>
      </div>

      {/* Voice input — toggle record; on stop the clip is transcribed and appended
          to the input. Red pulse while recording, dimmed while transcribing. */}
      <div class="relative shrink-0">
        {/* Mic/recording failures used to be console-only — a silent no-op from
            the user's POV. This surfaces them as a small bubble above the
            button instead, auto-clearing after 4s (see showMicError). */}
        {micError && (
          <div class="absolute bottom-full right-0 mb-2 w-max max-w-[240px] bg-[#1A1A2E] text-white text-[11px] leading-snug rounded-lg px-2.5 py-1.5 shadow-lg pointer-events-none">
            {micError}
          </div>
        )}
        <button
          class={`w-9 h-9 flex items-center justify-center bg-transparent border-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            recording ? 'text-[#E2422B] animate-pulse' : 'text-[#878787] hover:opacity-70'
          }`}
          onClick={toggleRecording}
          disabled={transcribing || isLoading}
          aria-label={recording ? 'Arrêter la dictée' : 'Dictée vocale'}
          aria-pressed={recording}
          title={recording ? 'Arrêter la dictée' : 'Dictée vocale'}
        >
          <span
            class="inline-flex w-[16px] h-[22px] items-center justify-center [&_svg]:block [&_svg]:w-full [&_svg]:h-full"
            dangerouslySetInnerHTML={{ __html: micIcon }}
          />
        </button>
      </div>
    </div>
  );
}
