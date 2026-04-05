create extension if not exists pgcrypto;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  generations_used integer not null default 0,
  generations_limit integer not null default 3,
  plan text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clothing_images (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  file_name text not null,
  file_path text,
  file_url text not null,
  uploaded_at timestamptz not null default now(),
  processed boolean not null default false,
  processing_started_at timestamptz,
  status text not null default 'pending',
  error_message text,
  model_preset text,
  preset_image_url text,
  user_prompt text,
  selfie_face_url text,
  selfie_body_url text
);

create table if not exists public.clothing_presets (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_url text not null,
  title text,
  description text,
  category text,
  order_index integer not null default 0
);

create table if not exists public.generated_models (
  id uuid primary key default gen_random_uuid(),
  original_image_id uuid not null references public.clothing_images(id) on delete cascade,
  file_name text not null,
  file_path text,
  file_url text not null,
  is_angle boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists clothing_images_user_id_idx on public.clothing_images(user_id);
create index if not exists clothing_images_uploaded_at_idx on public.clothing_images(uploaded_at desc);
create index if not exists generated_models_original_image_id_idx on public.generated_models(original_image_id);

alter table public.user_profiles enable row level security;

drop policy if exists "Users can view own profile" on public.user_profiles;
create policy "Users can view own profile"
  on public.user_profiles
  for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.user_profiles;
create policy "Users can update own profile"
  on public.user_profiles
  for update
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.user_profiles;
create policy "Users can insert own profile"
  on public.user_profiles
  for insert
  with check (auth.uid() = id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('clothing-incoming', 'clothing-incoming', true, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/jpg']),
  ('clothing-presets', 'clothing-presets', true, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'image/jpg']),
  ('clothing-output', 'clothing-output', true, 52428800, array['image/png', 'image/jpeg', 'image/webp']),
  ('clothing-angles', 'clothing-angles', true, 52428800, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "Public read clothing-incoming" on storage.objects;
create policy "Public read clothing-incoming"
  on storage.objects
  for select
  using (bucket_id = 'clothing-incoming');

drop policy if exists "Public upload clothing-incoming" on storage.objects;
create policy "Public upload clothing-incoming"
  on storage.objects
  for insert
  with check (bucket_id = 'clothing-incoming');

drop policy if exists "Public read clothing-presets" on storage.objects;
create policy "Public read clothing-presets"
  on storage.objects
  for select
  using (bucket_id = 'clothing-presets');

drop policy if exists "Service upload clothing-presets" on storage.objects;
create policy "Service upload clothing-presets"
  on storage.objects
  for insert
  with check (bucket_id = 'clothing-presets');

drop policy if exists "Public read clothing-output" on storage.objects;
create policy "Public read clothing-output"
  on storage.objects
  for select
  using (bucket_id = 'clothing-output');

drop policy if exists "Service upload clothing-output" on storage.objects;
create policy "Service upload clothing-output"
  on storage.objects
  for insert
  with check (bucket_id = 'clothing-output');

drop policy if exists "Public read clothing-angles" on storage.objects;
create policy "Public read clothing-angles"
  on storage.objects
  for select
  using (bucket_id = 'clothing-angles');

drop policy if exists "Service upload clothing-angles" on storage.objects;
create policy "Service upload clothing-angles"
  on storage.objects
  for insert
  with check (bucket_id = 'clothing-angles');
