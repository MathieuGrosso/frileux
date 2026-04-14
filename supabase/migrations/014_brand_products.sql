-- Brand products (scraped or manual) + user custom brands
create table if not exists brand_products (
  id uuid primary key default gen_random_uuid(),
  brand_slug text not null,
  name text not null,
  image_url text,
  product_url text,
  tags text[] default '{}',
  source text not null default 'scrape' check (source in ('scrape','manual')),
  added_by uuid references auth.users(id) on delete set null,
  scraped_at timestamptz not null default now()
);
create index if not exists brand_products_slug_idx on brand_products(brand_slug, scraped_at desc);

alter table brand_products enable row level security;

drop policy if exists "read brand_products" on brand_products;
create policy "read brand_products" on brand_products
  for select using (true);

drop policy if exists "insert brand_products own" on brand_products;
create policy "insert brand_products own" on brand_products
  for insert with check (added_by = auth.uid() or added_by is null);

drop policy if exists "delete brand_products own" on brand_products;
create policy "delete brand_products own" on brand_products
  for delete using (added_by = auth.uid());

create table if not exists user_custom_brands (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  aesthetic_line text,
  logo_url text,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

alter table user_custom_brands enable row level security;

drop policy if exists "own custom brands all" on user_custom_brands;
create policy "own custom brands all" on user_custom_brands
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
