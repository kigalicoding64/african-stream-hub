// Server-only helper for calling the Lovable AI Gateway.
// Keep this file behind a server function boundary — never import from client code.

const GATEWAY = 'https://ai.gateway.lovable.dev/v1';

function getKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error('LOVABLE_API_KEY is not configured');
  return key;
}

/** Call /chat/completions with structured JSON output. */
export async function chatJSON<T = unknown>(opts: {
  model?: string;
  system?: string;
  prompt: string;
  schema?: Record<string, unknown>;
}): Promise<T> {
  const model = opts.model ?? 'google/gemini-3-flash-preview';
  const body: Record<string, unknown> = {
    model,
    messages: [
      ...(opts.system ? [{ role: 'system', content: opts.system }] : []),
      { role: 'user', content: opts.prompt },
    ],
    response_format: opts.schema
      ? { type: 'json_schema', json_schema: { name: 'response', strict: true, schema: opts.schema } }
      : { type: 'json_object' },
  };
  const res = await fetch(`${GATEWAY}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Lovable-API-Key': getKey(),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI Gateway chat failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '{}';
  return JSON.parse(content) as T;
}

/** Call /audio/transcriptions with a remote audio/video URL. Downloads the file server-side first. */
export async function transcribeAudio(opts: {
  fileUrl: string;
  filename?: string;
  model?: string;
}): Promise<{ text: string; language?: string }> {
  const model = opts.model ?? 'openai/gpt-4o-mini-transcribe';
  const fileRes = await fetch(opts.fileUrl);
  if (!fileRes.ok) throw new Error(`Failed to fetch media: ${fileRes.status}`);
  const blob = await fileRes.blob();
  // Cap at 25MB — gateway rejects larger. For MVP we skip transcription on oversize files.
  if (blob.size > 25 * 1024 * 1024) {
    throw new Error(`Media too large for transcription (${(blob.size / 1024 / 1024).toFixed(1)}MB). 25MB max.`);
  }
  const fd = new FormData();
  const inferredName = opts.filename ?? (opts.fileUrl.split('/').pop() ?? 'media');
  fd.append('file', blob, inferredName);
  fd.append('model', model);
  const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
    method: 'POST',
    headers: { 'Lovable-API-Key': getKey() },
    body: fd,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Transcription failed: ${res.status} ${text.slice(0, 300)}`);
  }
  const json = await res.json() as { text?: string; language?: string };
  return { text: json.text ?? '', language: json.language };
}
