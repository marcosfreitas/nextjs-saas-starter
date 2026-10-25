import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/infrastructure/database/server';
import { isOnboarded } from '@/infrastructure/database/profile';
import { safeNext } from '@/shared/utils/safe-next';

/**
 * Non-login links: `token_hash` plus an explicit `type`, verified by GoTrue.
 *
 * GoTrue enforces the declared type when `verifyOtp` runs, so a token minted for
 * one flow is refused under another type. Only the types this template implements
 * are listed. `recovery` and `invite` are deliberately absent: a recovery link must
 * not end in a session that has not set a new password, so they come in with their
 * own flow, which sets the password before it signs anyone in.
 */
const TYPES: ReadonlySet<EmailOtpType> = new Set(['email', 'email_change']);

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = safeNext(searchParams.get('next'));

  if (!tokenHash || !type || !TYPES.has(type)) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(`${origin}/auth/sign-in?error=auth_failed`);

  const { data: { user } } = await supabase.auth.getUser();
  const onboarded = user ? await isOnboarded(supabase, user.id) : false;
  return NextResponse.redirect(`${origin}${onboarded ? next : '/onboarding'}`);
}
