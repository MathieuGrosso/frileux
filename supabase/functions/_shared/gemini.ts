// Wrapper minimal Gemini structured output.
// Le SDK Gemini n'a pas de retry natif — on en fait 3 avec backoff exponentiel
// sur erreurs 429 / 5xx. Response schema imposé → JSON garanti, parsing local.

const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

export interface CallStructuredArgs {
  apiKey: string;
  model: string;
  prompt: string;
  responseSchema: Record<string, unknown>;
  temperature?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

export interface CallStructuredResult<T> {
  data: T;
  tokensIn: number;
  tokensOut: number;
}

export class GeminiStructuredError extends Error {
  constructor(
    public code: "http" | "empty" | "parse" | "network",
    public detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = "GeminiStructuredError";
  }
}

function redact(s: string): string {
  return s.length > 200 ? s.slice(0, 200) + "…" : s;
}

export async function callStructured<T>(
  args: CallStructuredArgs,
): Promise<CallStructuredResult<T>> {
  const retries = args.maxRetries ?? 3;
  const delays = [0, 400, 1200];
  let lastErr: GeminiStructuredError | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const d = delays[Math.min(attempt - 1, delays.length - 1)];
      if (d > 0) await new Promise((r) => setTimeout(r, d));
    }
    try {
      const res = await fetch(GEMINI_ENDPOINT(args.model), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": args.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: args.prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: args.responseSchema,
            temperature: args.temperature ?? 0.8,
          },
        }),
        signal: args.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn(`[gemini] attempt ${attempt + 1} http ${res.status}: ${redact(body)}`);
        const retryable = res.status === 429 || res.status === 503 || res.status >= 500;
        lastErr = new GeminiStructuredError("http", `${res.status}:${redact(body)}`);
        if (!retryable) break;
        continue;
      }

      const data = await res.json();
      const text: string | undefined = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastErr = new GeminiStructuredError("empty", "no text part in response");
        continue;
      }
      let parsed: T;
      try {
        parsed = JSON.parse(text) as T;
      } catch (e) {
        lastErr = new GeminiStructuredError(
          "parse",
          e instanceof Error ? e.message : "invalid JSON",
        );
        continue;
      }

      return {
        data: parsed,
        tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
        tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`[gemini] attempt ${attempt + 1} network: ${msg}`);
      lastErr = new GeminiStructuredError("network", msg.slice(0, 200));
    }
  }

  throw lastErr ?? new GeminiStructuredError("network", "unknown");
}
