-- End every session that was opened with a password.
--
-- The password door is closed by 20261025170000_auth_no_passwords (the hash is
-- blanked), but that does not touch sessions already issued: a planted password
-- could have signed someone in before the door closed, and that session keeps
-- working until its refresh token is spent. Ending them forces a fresh sign-in,
-- which now means an email code.
--
-- Legitimate users sign in once more. Sessions opened with a code, a link or
-- OAuth carry a different authentication method and are not touched.
--
-- Data only, no schema change. Safe to run twice (the second run deletes nothing).

delete from auth.sessions s
using auth.mfa_amr_claims a
where a.session_id = s.id
  and a.authentication_method = 'password';
