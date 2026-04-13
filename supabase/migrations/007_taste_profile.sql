-- ============================================
-- Frileux — Taste Profile + Brands seed
-- ============================================

-- Extend profiles with style/taste fields
alter table public.profiles
  add column if not exists gender_presentation text
    check (gender_presentation in ('menswear', 'womenswear', 'both')),
  add column if not exists style_universes text[] not null default '{}',
  add column if not exists favorite_brands text[] not null default '{}',
  add column if not exists avoid_tags text[] not null default '{}',
  add column if not exists fit_preference text
    check (fit_preference in ('relaxed', 'regular', 'slim'));

-- ============================================
-- BRANDS (seed catalog for autocomplete)
-- ============================================
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  universe text[] not null default '{}',
  tier text check (tier in ('luxury', 'designer', 'contemporary', 'street', 'technical', 'heritage')),
  created_at timestamptz not null default now()
);

create index if not exists idx_brands_name on public.brands using gin (to_tsvector('simple', name));

alter table public.brands enable row level security;

create policy "Anyone can read brands"
  on public.brands for select
  using (true);

-- Seed: curated Ssense / Hypebeast / editorial reference list
insert into public.brands (name, slug, universe, tier) values
  -- Luxury / archive
  ('Maison Margiela',       'maison-margiela',       array['archive','tailoring','quiet luxury'], 'luxury'),
  ('Lemaire',               'lemaire',               array['minimal','quiet luxury','tailoring'], 'luxury'),
  ('The Row',               'the-row',               array['minimal','quiet luxury'],             'luxury'),
  ('Bottega Veneta',        'bottega-veneta',        array['quiet luxury','minimal'],             'luxury'),
  ('Loewe',                 'loewe',                 array['archive','quiet luxury'],             'luxury'),
  ('Prada',                 'prada',                 array['archive','tailoring'],                'luxury'),
  ('Miu Miu',               'miu-miu',               array['archive','y2k'],                      'luxury'),
  ('Jil Sander',            'jil-sander',            array['minimal','tailoring'],                'luxury'),
  ('Rick Owens',            'rick-owens',            array['archive'],                            'luxury'),
  ('Comme des Garçons',     'comme-des-garcons',     array['archive'],                            'luxury'),
  ('Yohji Yamamoto',        'yohji-yamamoto',        array['archive','tailoring'],                'luxury'),
  ('Issey Miyake',          'issey-miyake',          array['archive','minimal'],                  'luxury'),
  ('Dries Van Noten',       'dries-van-noten',       array['archive','tailoring'],                'luxury'),
  ('Acne Studios',          'acne-studios',          array['minimal','contemporary'],             'designer'),
  ('Khaite',                'khaite',                array['quiet luxury','minimal'],             'luxury'),
  ('Toteme',                'toteme',                array['minimal','quiet luxury'],             'luxury'),
  ('Saint Laurent',         'saint-laurent',         array['tailoring','archive'],                'luxury'),
  ('Balenciaga',            'balenciaga',            array['archive','streetwear'],               'luxury'),

  -- Designer / contemporary
  ('Our Legacy',            'our-legacy',            array['workwear','minimal','tailoring'],     'designer'),
  ('Auralee',               'auralee',               array['minimal','quiet luxury'],             'designer'),
  ('A.P.C.',                'apc',                   array['minimal','workwear'],                 'contemporary'),
  ('Margaret Howell',       'margaret-howell',       array['workwear','tailoring','heritage'],    'designer'),
  ('Studio Nicholson',      'studio-nicholson',      array['minimal','workwear'],                 'designer'),
  ('Sunflower',             'sunflower',             array['minimal'],                            'designer'),
  ('Norse Projects',        'norse-projects',        array['minimal','workwear'],                 'contemporary'),
  ('Drakes',                'drakes',                array['tailoring','heritage','preppy'],      'designer'),
  ('Aimé Leon Dore',        'aime-leon-dore',        array['preppy','streetwear'],                'contemporary'),
  ('Kapital',               'kapital',               array['workwear','archive'],                 'designer'),
  ('Engineered Garments',   'engineered-garments',   array['workwear','heritage'],                'designer'),
  ('Visvim',                'visvim',                array['workwear','heritage','archive'],      'designer'),
  ('Needles',               'needles',               array['archive','streetwear'],               'designer'),

  -- Avant-garde / archive
  ('Kiko Kostadinov',       'kiko-kostadinov',       array['archive','techwear'],                 'designer'),
  ('Martine Rose',          'martine-rose',          array['archive','streetwear'],               'designer'),
  ('Jacquemus',             'jacquemus',             array['contemporary'],                       'designer'),
  ('Wales Bonner',          'wales-bonner',          array['tailoring','archive'],                'designer'),

  -- Streetwear
  ('Stüssy',                'stussy',                array['streetwear'],                         'street'),
  ('Carhartt WIP',          'carhartt-wip',          array['workwear','streetwear'],              'street'),
  ('Patta',                 'patta',                 array['streetwear'],                         'street'),
  ('Awake NY',              'awake-ny',              array['streetwear'],                         'street'),
  ('Supreme',               'supreme',               array['streetwear'],                         'street'),
  ('Palace',                'palace',                array['streetwear'],                         'street'),

  -- Technical / gorpcore
  ('Arc''teryx',            'arcteryx',              array['techwear','gorpcore'],                'technical'),
  ('Veilance',              'veilance',              array['techwear','minimal'],                 'technical'),
  ('Salomon',               'salomon',               array['gorpcore','techwear'],                'technical'),
  ('And Wander',            'and-wander',            array['gorpcore','techwear'],                'technical'),
  ('Snow Peak',             'snow-peak',             array['gorpcore','heritage'],                'technical'),
  ('Goldwin',               'goldwin',               array['techwear','gorpcore'],                'technical'),
  ('ROA',                   'roa',                   array['techwear','gorpcore'],                'technical'),

  -- Heritage / workwear
  ('Levi''s Vintage',       'levis-vintage',         array['heritage','workwear'],                'heritage'),
  ('Orslow',                'orslow',                array['heritage','workwear'],                'heritage'),
  ('Sacai',                 'sacai',                 array['archive','techwear'],                 'designer'),
  ('Maison Kitsuné',        'maison-kitsune',        array['preppy','contemporary'],              'contemporary')
on conflict (slug) do nothing;
