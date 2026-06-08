import { ok, handleError } from '@/shared/utils/api-handler';
import { getCurrentUser } from '@/infrastructure/database/auth-session';
import { PolarProvider } from '@/infrastructure/billing/polar.provider';
import { assertEnv } from '@/shared/config/assert-env';
import { checkRateLimit } from '@/shared/utils/rate-limit';

export async function POST() {
  try {
    const user = await getCurrentUser();
    await checkRateLimit(`customer-portal:${user.id}`);
    const billing = new PolarProvider();
    const appUrl = assertEnv('NEXT_PUBLIC_APP_URL');
    // Resolve the Polar customer from the authenticated user — never from the
    // request body, which would let any logged-in user open another's portal.
    const session = await billing.createPortalSession({
      externalCustomerId: user.id,
      returnUrl: `${appUrl}/dashboard`,
    });
    return ok(session);
  } catch (err) {
    return handleError(err);
  }
}
