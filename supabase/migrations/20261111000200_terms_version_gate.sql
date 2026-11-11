-- Onboarding is complete for a terms version, not for all time.
--
-- A profile marked onboarded still needs an acceptance for the terms version in force
-- (src/config/legal.ts). A new text bumps the version, so every account goes back
-- through the acceptance step. complete_onboarding() takes that version and is
-- idempotent per version: a stale tab or a double submit records nothing twice.

create or replace function public.complete_onboarding(p_terms_version text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_terms_version is null or p_terms_version = '' then
    raise exception 'terms version required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.consents
     where user_id = v_user and document = 'terms' and version = p_terms_version
  ) then
    -- Consent first, append-only: one row per acceptance of a version.
    insert into public.consents (user_id, document, version)
    values (v_user, 'terms', p_terms_version);
  end if;

  update public.profiles
     set onboarded_at = coalesce(onboarded_at, now())
   where id = v_user;
end;
$$;

revoke all on function public.complete_onboarding(text) from public, anon;
grant execute on function public.complete_onboarding(text) to authenticated;
