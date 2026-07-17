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

/** Pick the first MediaRecorder mime type the browser actually supports. */
function pickMimeType(): string | undefined {
  const prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  const MR = typeof MediaRecorder !== 'undefined' ? MediaRecorder : undefined;
  if (!MR?.isTypeSupported) return undefined;
  return prefs.find(t => MR.isTypeSupported(t));
}

export function ChatInputBar({ input, isLoading, onInputChange, onSend, onKeyDown, onFocus, onBlur }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Keep the latest input in a ref so the recorder's async stop handler appends
  // to the current value without stale-closure issues.
  const inputRef = useRef(input);
  inputRef.current = input;

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [input]);

  // Release the mic if the component unmounts mid-recording.
  useEffect(() => {
    return () => {
      recorderRef.current?.stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const text = await transcribeAudio(blob);
          if (text) {
            const current = inputRef.current;
            onInputChange(current ? `${current} ${text}` : text);
          }
        } catch (err) {
          console.error('[shoppergpt] transcription failed', err);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      console.error('[shoppergpt] microphone access denied', err);
    }
  }, [onInputChange]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

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
      <button
        class={`shrink-0 w-9 h-9 flex items-center justify-center bg-transparent border-0 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
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
  );
}
