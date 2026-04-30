import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";

export type CoachCommand = "feedback" | "coach" | "tenue" | "effacer";

export interface CoachMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  body: string;
  command: CoachCommand | null;
  command_arg: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface InvokeCoachInput {
  message: string;
  command?: CoachCommand | null;
  command_arg?: string | null;
  history?: { role: "user" | "assistant"; body: string }[];
}

export interface InvokeCoachResult {
  reply: string;
  metadata?: Record<string, unknown>;
  cleared?: boolean;
}

export async function invokeCoach(input: InvokeCoachInput): Promise<InvokeCoachResult> {
  const { data, error } = await supabase.functions.invoke("coach-chat", { body: input });
  if (error) throw error;
  if (data?.error) throw new Error(typeof data.error === "string" ? data.error : "coach error");
  return data as InvokeCoachResult;
}

const KNOWN_COMMANDS: ReadonlySet<CoachCommand> = new Set([
  "feedback",
  "coach",
  "tenue",
  "effacer",
]);

export interface ParsedSlash {
  command: CoachCommand | null;
  arg: string | null;
  body: string;
}

// Permissif : si la commande n'est pas reconnue, on retourne null et on laisse
// le LLM gérer le texte tel quel — pas d'erreur, pas de blocage.
export function parseSlashCommand(input: string): ParsedSlash {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) {
    return { command: null, arg: null, body: trimmed };
  }
  const firstSpace = trimmed.indexOf(" ");
  const head = (firstSpace === -1 ? trimmed.slice(1) : trimmed.slice(1, firstSpace)).toLowerCase();
  const rest = firstSpace === -1 ? "" : trimmed.slice(firstSpace + 1).trim();
  if (!KNOWN_COMMANDS.has(head as CoachCommand)) {
    return { command: null, arg: null, body: trimmed };
  }
  const command = head as CoachCommand;
  if (command === "coach") {
    // /coach <prénom> [reste du message]
    const restFirstSpace = rest.indexOf(" ");
    const arg = (restFirstSpace === -1 ? rest : rest.slice(0, restFirstSpace)) || null;
    const remaining = restFirstSpace === -1 ? "" : rest.slice(restFirstSpace + 1).trim();
    return { command, arg, body: remaining || `/coach${arg ? ` ${arg}` : ""}` };
  }
  return { command, arg: null, body: rest || `/${command}` };
}

const FEEDBACK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface FeedbackCache {
  reply: string;
  metadata?: Record<string, unknown>;
  ts: number;
  wardrobeCount: number;
}

function feedbackCacheKey(userId: string): string {
  return `coach:feedback:${userId}`;
}

export async function readCachedFeedback(
  userId: string,
  wardrobeCount: number,
): Promise<FeedbackCache | null> {
  try {
    const raw = await AsyncStorage.getItem(feedbackCacheKey(userId));
    if (!raw) return null;
    const value = JSON.parse(raw) as FeedbackCache;
    if (Date.now() - value.ts > FEEDBACK_TTL_MS) return null;
    if (value.wardrobeCount !== wardrobeCount) return null;
    return value;
  } catch {
    return null;
  }
}

export async function writeCachedFeedback(
  userId: string,
  wardrobeCount: number,
  payload: { reply: string; metadata?: Record<string, unknown> },
): Promise<void> {
  try {
    const value: FeedbackCache = {
      ...payload,
      ts: Date.now(),
      wardrobeCount,
    };
    await AsyncStorage.setItem(feedbackCacheKey(userId), JSON.stringify(value));
  } catch {
    // ignore cache write failures
  }
}

export async function clearCachedFeedback(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(feedbackCacheKey(userId));
  } catch {
    // ignore
  }
}

export async function loadCoachMessages(userId: string, limit = 200): Promise<CoachMessage[]> {
  const { data, error } = await supabase
    .from("coach_messages")
    .select("id, user_id, role, body, command, command_arg, metadata, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CoachMessage[]) ?? [];
}

export async function countCoachMessages(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) return 0;
  return count ?? 0;
}
