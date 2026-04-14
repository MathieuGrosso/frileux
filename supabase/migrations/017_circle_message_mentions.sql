-- Mentions: user_ids tagged in a circle message.

alter table public.circle_messages
  add column if not exists mentions uuid[] not null default '{}';

create index if not exists circle_messages_mentions_idx
  on public.circle_messages using gin (mentions);
