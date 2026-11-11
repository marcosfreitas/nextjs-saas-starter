-- Onboarding is completed only through complete_onboarding(), never by a direct update.
--
-- The grant in 20261025180000_profiles_and_consents let the signed-in user write
-- profiles.onboarded_at through the REST API. That skipped the consent row, so the
-- gate could be passed without accepting the terms. Here the column grant and its
-- policy go, and one function writes the consent and the timestamp together.

revoke update on public.profiles from authenticated;
drop policy if exists "profiles: mark own row onboarded" on public.profiles;

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

  -- Already onboarded (a stale tab, a double submit): nothing to record again.
  if exists (select 1 from public.profiles where id = v_user and onboarded_at is not null) then
    return;
  end if;

  -- Consent first, append-only: one row per acceptance.
  insert into public.consents (user_id, document, version)
  values (v_user, 'terms', p_terms_version);

  update public.profiles
     set onboarded_at = now()
   where id = v_user and onboarded_at is null;
end;
$$;

revoke all on function public.complete_onboarding(text) from public, anon;
grant execute on function public.complete_onboarding(text) to authenticated;
