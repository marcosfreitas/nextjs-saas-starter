/**
 * Paths a signed-in user without a finished onboarding may still reach.
 *
 * Everything else is sent to /onboarding. The auth routes must stay open or the
 * callback could not finish the sign-in, and /api is left to its own handlers,
 * which answer JSON and should not get an HTML redirect.
 */
const EXEMPT = /^\/(onboarding|auth|api)(\/|$)/;

export function isOnboardingExempt(pathname: string): boolean {
  return EXEMPT.test(pathname);
}
