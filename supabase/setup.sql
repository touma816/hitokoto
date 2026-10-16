-- 投稿者判定にはDiscord OAuthでSupabaseが受け取るメールアドレスを使います。
-- このSQLは再実行できます。DiscordのClient Secretなどはここへ書かないでください。
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.site_config (
  id boolean primary key default true check (id),
  owner_email text not null
);
insert into private.site_config (id, owner_email)
values (true, 'kobatou0816@gmail.com')
on conflict (id) do update set owner_email = excluded.owner_email;

create or replace function public.is_site_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    lower(btrim(auth.jwt() ->> 'email')) = lower(btrim((select owner_email from private.site_config where id = true))),
    false
  )
$$;
revoke all on function public.is_site_owner() from public, anon;
grant execute on function public.is_site_owner() to authenticated;

create table if not exists public.site_profile (
  id boolean primary key default true check (id),
  name text not null check (char_length(name) between 1 and 30),
  handle text not null check (handle ~ '^[A-Za-z0-9_]{1,30}$'),
  avatar text not null default '/assets/avatar.webp',
  updated_at timestamptz not null default now()
);
insert into public.site_profile (id, name, handle)
values (true, '桐慎', 'touma816')
on conflict (id) do update
set name = excluded.name,
    updated_at = now();

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  text text not null default '' check (char_length(text) <= 500),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array' and jsonb_array_length(images) <= 4),
  created_at timestamptz not null default now(),
  check (char_length(btrim(text)) > 0 or jsonb_array_length(images) > 0)
);

create table if not exists public.reactions (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji = any (array['❤️','😂','👏','😭','😮','😄','👍','✨','💖','🎉','🤔','😌','👀','🔥','🥹','💜','☕','🍁','🌱'])),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id, emoji)
);

alter table public.site_profile enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;

drop policy if exists "authenticated can read profile" on public.site_profile;
create policy "authenticated can read profile" on public.site_profile for select to authenticated using (true);
drop policy if exists "owner can update profile" on public.site_profile;
create policy "owner can update profile" on public.site_profile for update to authenticated using (public.is_site_owner()) with check (public.is_site_owner());

drop policy if exists "authenticated can read posts" on public.posts;
create policy "authenticated can read posts" on public.posts for select to authenticated using (true);
drop policy if exists "owner can create posts" on public.posts;
create policy "owner can create posts" on public.posts for insert to authenticated with check (public.is_site_owner() and author_id = auth.uid());
drop policy if exists "owner can delete posts" on public.posts;
create policy "owner can delete posts" on public.posts for delete to authenticated using (public.is_site_owner());

drop policy if exists "authenticated can read reactions" on public.reactions;
create policy "authenticated can read reactions" on public.reactions for select to authenticated using (true);
drop policy if exists "users can create own reactions" on public.reactions;
create policy "users can create own reactions" on public.reactions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users can delete own reactions" on public.reactions;
create policy "users can delete own reactions" on public.reactions for delete to authenticated using (user_id = auth.uid());

grant select on public.site_profile, public.posts, public.reactions to authenticated;
grant update on public.site_profile to authenticated;
grant insert, delete on public.posts, public.reactions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('hitokoto-media', 'hitokoto-media', true, 2000000, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do update set public = true, file_size_limit = 2000000, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "owner can upload media" on storage.objects;
create policy "owner can upload media" on storage.objects for insert to authenticated with check (bucket_id = 'hitokoto-media' and public.is_site_owner());
drop policy if exists "owner can update media" on storage.objects;
create policy "owner can update media" on storage.objects for update to authenticated using (bucket_id = 'hitokoto-media' and public.is_site_owner()) with check (bucket_id = 'hitokoto-media' and public.is_site_owner());
drop policy if exists "owner can delete media" on storage.objects;
create policy "owner can delete media" on storage.objects for delete to authenticated using (bucket_id = 'hitokoto-media' and public.is_site_owner());

alter table public.site_profile replica identity full;
alter table public.posts replica identity full;
alter table public.reactions replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'site_profile') then alter publication supabase_realtime add table public.site_profile; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then alter publication supabase_realtime add table public.posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions') then alter publication supabase_realtime add table public.reactions; end if;
end $$;
