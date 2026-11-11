import { redirect } from 'next/navigation';
import { createClient } from './server';
import { isOnboarded } from './profile';
import { OnboardingRequiredError, UnauthorizedError } from '@/shared/errors';

/**
 * The signed-in user, with no onboarding check.
 *
 * Only for the two places the standard exempts: reading one's own profile, and
 * the onboarding flow itself. Every other door to product data uses
 * `getCurrentUser()`.
 */
export async function getSessionUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) throw new UnauthorizedError();
  return user;
}

/**
 * The signed-in user, and only if onboarding is finished.
 *
 * This is the one base check every API route and server action calls. It reads
 * `onboarded_at` in the same session, so a bearer or cookie path cannot skip it
 * by calling the database directly. Throws UnauthorizedError with no session and
 * OnboardingRequiredError before the terms are accepted.
 */
export async function getCurrentUser() {
  const user = await getSessionUser();
  const supabase = await createClient();
  if (!(await isOnboarded(supabase, user.id))) throw new OnboardingRequiredError();
  return user;
}

/**
 * For server-rendered pages, not API routes.
 *
 * The same check as `getCurrentUser()`, but a refusal becomes a redirect instead
 * of a thrown error: no session goes to sign-in, not onboarded goes to /onboarding.
 * A thrown OnboardingRequiredError on every first login would log a stack trace
 * on the server each time. The check still runs on every page; only the way it
 * refuses changes. Other errors still propagate.
 */
export async function getCurrentUserForPage() {
  try {
    return await getCurrentUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) redirect('/auth/sign-in');
    if (err instanceof OnboardingRequiredError) redirect('/onboarding');
    throw err;
  }
}

export async function getCurrentUserOrNull() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
