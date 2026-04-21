-- Migration 048 — increment_ai_usage atomique (fix P1)
--
-- Bug : l'implémentation de 036 utilisait un INSERT ... ON CONFLICT DO NOTHING
-- suivi d'un SELECT ... FOR UPDATE puis d'un UPDATE séparé. Sous charge concurrente
-- (deux Edge Functions appelées en parallèle pour le même user/fn/day), le pattern
-- peut perdre des incréments ou autoriser des appels au-delà de la limite selon
-- l'ordonnancement des transactions.
--
-- Fix : un seul statement atomique `INSERT ... ON CONFLICT DO UPDATE` avec une
-- clause WHERE qui bloque l'incrément dès que le compteur atteint la limite.
-- La ligne est verrouillée pour la durée de la transaction, aucune concurrente
-- ne peut la lire puis écrire par-dessus.
--
-- Signature conservée identique à 036 pour ne pas casser les callers existants.

create or replace function public.increment_ai_usage(
  p_user_id uuid,
  p_function_name text,
  p_limit int
) returns table (allowed boolean, remaining int, current_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_count int;
begin
  insert into ai_usage (user_id, day, function_name, count, updated_at)
  values (p_user_id, v_day, p_function_name, 1, now())
  on conflict (user_id, day, function_name) do update
    set count = ai_usage.count + 1,
        updated_at = now()
    where ai_usage.count < p_limit
  returning count into v_count;

  if v_count is null then
    -- L'UPDATE a été filtré par la clause WHERE : compteur déjà au plafond.
    select count into v_count
    from ai_usage
    where user_id = p_user_id
      and day = v_day
      and function_name = p_function_name;

    allowed := false;
    remaining := 0;
    current_count := coalesce(v_count, p_limit);
    return next;
    return;
  end if;

  allowed := true;
  remaining := greatest(p_limit - v_count, 0);
  current_count := v_count;
  return next;
end;
$$;

grant execute on function public.increment_ai_usage(uuid, text, int) to service_role;
