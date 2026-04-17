// Shared quota & rate limit helper for Edge Functions.
// Usage:
//   const guard = await enforceQuota(userId, "suggest-outfit");
//   if (!guard.ok) return guard.response(corsHeaders);

import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_JWT") ?? "";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (!_admin) _admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  return _admin;
}

// Daily per-user cap. Keys can be plain function name or `fn:action` for sub-actions.
export const DAILY_LIMITS: Record<string, number> = {
  "suggest-outfit": 8,
  "critique-outfit": 10,
  "embed-outfit": 50,
  "daily-taste-probe": 20,
  "wardrobe-ai:analyze_image": 30,
  "wardrobe-ai:analyze_image_multi": 30,
  "wardrobe-ai:analyze_text": 50,
  "wardrobe-ai:refine_image": 10,
  "wardrobe-ai:generate_combos": 10,
  "wardrobe-ai:generate_pieces": 10,
  "wardrobe-ai:generate_outfit_image": 5,
  "wardrobe-ai:describe_worn": 30,
};

// Short-term debounce (seconds between two calls).
export const RATE_LIMITS: Record<string, number> = {
  "suggest-outfit": 30,
  "critique-outfit": 15,
  "daily-taste-probe": 20,
  "wardrobe-ai:generate_outfit_image": 10,
  "wardrobe-ai:generate_combos": 10,
  "wardrobe-ai:generate_pieces": 10,
};

type GuardOk = { ok: true };
type GuardDenied = {
  ok: false;
  status: number;
  message: string;
  retryAfterSeconds: number;
  response: (cors: Record<string, string>) => Response;
};
export type QuotaGuard = GuardOk | GuardDenied;

function buildDenied(status: number, message: string, retryAfterSeconds: number): GuardDenied {
  return {
    ok: false,
    status,
    message,
    retryAfterSeconds,
    response: (cors) =>
      new Response(JSON.stringify({ error: message }), {
        status,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSeconds),
          ...cors,
        },
      }),
  };
}

function secondsUntilUtcMidnight(): number {
  const now = new Date();
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
  );
  return Math.max(60, Math.floor((next - now.getTime()) / 1000));
}

export async function enforceQuota(userId: string, fnKey: string): Promise<QuotaGuard> {
  const limit = DAILY_LIMITS[fnKey];
  if (limit == null) return { ok: true };
  const rate = RATE_LIMITS[fnKey];

  try {
    if (rate) {
      const { data: rateOk, error: rateErr } = await admin().rpc("check_rate_limit", {
        p_user_id: userId,
        p_function_name: fnKey,
        p_min_interval_seconds: rate,
      });
      if (!rateErr && rateOk === false) {
        return buildDenied(
          429,
          "Trop de requêtes. Réessaie dans quelques secondes.",
          rate,
        );
      }
    }

    const { data, error } = await admin().rpc("increment_ai_usage", {
      p_user_id: userId,
      p_function_name: fnKey,
      p_limit: limit,
    });
    if (error) {
      console.warn("[quota] increment_ai_usage failed, fail-open:", error.message);
      return { ok: true };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (row && row.allowed === false) {
      return buildDenied(
        429,
        `Quota quotidien atteint (${limit}/jour pour ${fnKey}).`,
        secondsUntilUtcMidnight(),
      );
    }
    return { ok: true };
  } catch (e) {
    console.warn("[quota] unexpected error, fail-open:", e instanceof Error ? e.message : e);
    return { ok: true };
  }
}

export async function recordTokens(
  userId: string,
  fnKey: string,
  tokensIn: number,
  tokensOut: number,
): Promise<void> {
  try {
    await admin().rpc("record_ai_tokens", {
      p_user_id: userId,
      p_function_name: fnKey,
      p_tokens_in: tokensIn,
      p_tokens_out: tokensOut,
    });
  } catch (e) {
    console.warn("[quota] record_ai_tokens failed:", e instanceof Error ? e.message : e);
  }
}
