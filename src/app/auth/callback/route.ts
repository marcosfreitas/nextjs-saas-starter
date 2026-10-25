import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/infrastructure/database/server';
import { isOnboarded } from '@/infrastructure/database/profile';
import { safeNext } from '@/shared/utils/safe-next';

/**
 * Login links only.
 *
 * The PKCE `?code=` carries no type, so this route cannot tell a login from a
 * recovery or invite link, and exchanging the code turns either into a session.
 * The separation therefore lives in what is sent here: recovery, invite and
 * email-change links go to /auth/confirm, which verifies `token_hash` with an
 * explicit type. Never set this route as `redirectTo` for those flows, and never
 * set it as the project's `site_url`, which is where links land when their
 * `redirect_to` is not allowed.
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const onboarded = user ? await isOnboarded(supabase, user.id) : false;
      return NextResponse.redirect(`${origin}${onboarded ? next : '/onboarding'}`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_failed`);
}
