import { getApiUrl, getClientId } from './config';

// This widget is Carrefour-specific, so it always requests the Chirp backend
// (Google Cloud Speech-to-Text v2 — a real ASR model, far better than an LLM at
// plain transcription). The route's `provider` param defaults to 'openai' for the
// other clients. Change here if Carrefour ever switches providers.
const TRANSCRIPTION_PROVIDER = 'chirp';

/**
 * Send a recorded audio blob to the backend and return the transcript text.
 * Returns '' when the backend produced no usable transcript (silence, etc.).
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const ext = blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('file', blob, `recording.${ext}`);
  form.append('language', 'fr');
  form.append('provider', TRANSCRIPTION_PROVIDER);

  const res = await fetch(`${getApiUrl()}/transcription`, {
    method: 'POST',
    headers: { 'x-client-id': getClientId() }, // no Content-Type — the browser sets the multipart boundary
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription HTTP ${res.status}`);
  const data = (await res.json()) as { text?: string };
  return (data.text ?? '').trim();
}
