-- Auth: no account carries a usable password.
--
-- The product signs in only through an email link (signInWithOtp). The Supabase
-- email provider, though, also accepts POST /auth/v1/signup with a password,
-- straight from the public anon key, and there is no switch that turns password
-- off and keeps the link on.
--
-- Attack, measured in production on another project: an attacker signs up the
-- victim's address with a password (unconfirmed, no session); the victim later
-- signs in through the email link, which confirms that same row; the attacker's
-- password then logs in. Pre-account takeover: both people share the account.
-- Turning confirmation on does not close it, it only removes the immediate session.
--
-- The fix blanks the hash on every insert and update, so the password grant can
-- never match. GoTrue reads an empty hash as "no password" and refuses the grant;
-- the link and OTP paths never read the column (GoTrue even writes a random hash
-- for link signups, which this also blanks). A hook on password verification
-- would do the same, but it depends on the plan; a trigger does not.
--
-- Side effect: any password feature added later (updateUser({ password }), a
-- recovery flow, admin createUser with a password) answers 200 and the password
-- never works, because this trigger blanks it. Drop the trigger before building one.

create or replace function public.auth_strip_password()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.encrypted_password := '';
  return new;
end;
$$;

revoke all on function public.auth_strip_password() from public, anon, authenticated;

drop trigger if exists auth_strip_password on auth.users;
create trigger auth_strip_password
  before insert or update of encrypted_password on auth.users
  for each row
  execute function public.auth_strip_password();

-- Existing rows. Clearing them logs nobody out: sessions do not depend on the hash.
update auth.users set encrypted_password = '' where coalesce(encrypted_password, '') <> '';
