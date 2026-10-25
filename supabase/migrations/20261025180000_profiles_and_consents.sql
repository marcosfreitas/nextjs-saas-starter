-- Profiles and consents for the link-only signup.
--
-- Nothing is stored about a person before the email is proven: the profile row is
-- created by a trigger on auth.users, and it starts with onboarded_at null. The
-- app sends any session whose profile is not onboarded to /onboarding, and the
-- onboarding step writes the consent row and sets onboarded_at.
--
-- Consents are one row per acceptance (document, version, time), append-only from
-- the client, so who accepted what and when can be shown later.

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- RLS without a GRANT is dead code: the policies never run for the role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (onboarded_at) on public.profiles to authenticated;

create policy "profiles: read own row"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "profiles: mark own row onboarded"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_auth_user();

-- Accounts that exist before this migration get a row too. onboarded_at stays null,
-- so each of them goes through onboarding once.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- consents ------------------------------------------------------------------

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document text not null,
  version text not null,
  accepted_at timestamptz not null default now()
);

create index consents_user_id_idx on public.consents (user_id);

alter table public.consents enable row level security;

revoke all on public.consents from anon, authenticated;
grant select, insert on public.consents to authenticated;

create policy "consents: read own rows"
  on public.consents for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "consents: insert own rows"
  on public.consents for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- No update or delete policy and no grant: a recorded acceptance is never edited.
