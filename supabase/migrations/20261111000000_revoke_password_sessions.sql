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
--
-- This template has no users of its own, so a fresh clone deletes nothing. A project
-- built from it that already has users should count the sessions this will end first:
--   select count(*) from auth.sessions s
--    where exists (select 1 from auth.mfa_amr_claims a
--                   where a.session_id = s.id and a.authentication_method = 'password');
-- Sessions with no amr claim at all are not matched here. Count those too, and decide
-- on them before running, because this is irreversible.

delete from auth.sessions s
using auth.mfa_amr_claims a
where a.session_id = s.id
  and a.authentication_method = 'password';
