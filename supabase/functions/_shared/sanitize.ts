// Defenses against prompt injection via user-controlled input.
// All strings passed into Claude/Gemini prompts from client payloads should
// flow through sanitizeUserInput() or delimit().

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|above|prior|all)/i,
  /system\s*(prompt|message|instruction|role)/i,
  /\bapi[-_\s]*key\b/i,
  /\b(anthropic|openai|gemini|google)\s*(key|token|secret)/i,
  /<\s*\/?\s*(system|assistant|user|tool|human)\b/i,
  /\[\s*(system|assistant|user|tool)\s*\]/i,
  /disregard\s+(the\s+)?(above|previous|instructions)/i,
];

export function sanitizeUserInput(
  input: string | null | undefined,
  maxLen = 200,
): string {
  if (!input || typeof input !== "string") return "";
  let s = input.normalize("NFC");
  // strip control chars
  s = s.replace(/[\u0000-\u001f\u007f]/g, " ");
  // strip characters commonly used to break out of templates
  s = s.replace(/[<>`]/g, "");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  s = s.slice(0, maxLen);
  for (const re of INJECTION_PATTERNS) {
    if (re.test(s)) return "";
  }
  return s;
}

export function sanitizeList(
  items: unknown,
  maxItems = 10,
  maxLenPerItem = 120,
): string[] {
  if (!Array.isArray(items)) return [];
  const out: string[] = [];
  for (const raw of items) {
    if (out.length >= maxItems) break;
    const clean = sanitizeUserInput(typeof raw === "string" ? raw : "", maxLenPerItem);
    if (clean) out.push(clean);
  }
  return out;
}

export function delimit(tag: string, content: string, maxLen = 1000): string {
  const clean = sanitizeUserInput(content, maxLen);
  if (!clean) return "";
  const t = tag.replace(/[^a-z0-9_-]/gi, "");
  return `<${t}>\n${clean}\n</${t}>`;
}

// Output filter — call before returning AI text to the client.
// Returns null if suspicious content detected; caller should fall back.
export function scrubModelOutput(text: string): string | null {
  if (!text) return text;
  const suspicious = [
    /system\s*prompt/i,
    /\bapi[-_\s]*key\b/i,
    /\banthropic[_-]?api/i,
    /\bsk-[a-z0-9-]{20,}\b/i,
  ];
  for (const re of suspicious) {
    if (re.test(text)) return null;
  }
  return text;
}
