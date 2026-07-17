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
const SILENCE_MS = 1800;
const MIN_RECORDING_MS = 700;

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

  // Silence-detection plumbing — a separate (silence-only) AudioContext/Analyser
  // graph tapped off the same mic stream, polled on a rAF loop while recording.
  const silenceAudioCtxRef = useRef<AudioContext | null>(null);
  const silenceRafRef = useRef<number | null>(null);
  const recordingStartedAtRef = useRef(0);
  const silenceStartedAtRef = useRef<number | null>(null);
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

  const startSilenceWatch = useCallback((stream: MediaStream) => {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctor) return; // no Web Audio support — silence auto-stop just won't trigger, recording still works
    const ctx = new Ctor();
    silenceAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      // RMS of the (centered) waveform — 0 when perfectly silent, ~1 when clipping.
      let sumSquares = 0;
      for (let i = 0; i < data.length; i++) {
        const centered = (data[i] - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / data.length);

      const now = performance.now();
      if (rms < SILENCE_THRESHOLD) {
        if (silenceStartedAtRef.current == null) silenceStartedAtRef.current = now;
        const silentFor = now - silenceStartedAtRef.current;
        const recordedFor = now - recordingStartedAtRef.current;
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
      <div class="flex-1 rounded-3xl min-h-9 md:min-h-10 px-1.5 py-1 flex items-center gap-1 border border-black/50">
        <textarea
          ref={textareaRef}
          // text-[16px]: iOS Safari auto-zooms the whole page on focus for any
          // input/textarea with a computed font-size under 16px — this is the
          // minimum that avoids it, not a design choice. md: reverts to the
          // smaller size since that zoom-on-focus behavior is mobile-only.
          class="flex-1 bg-transparent border-0 py-1.5 px-2.5 md:px-3 text-[16px] md:text-[13.5px] text-[#1A1A2E] resize-none outline-none leading-[1.4] max-h-[90px] min-h-0 overflow-y-auto placeholder:text-[#B0A898]"
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
