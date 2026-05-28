import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleError } from '@/shared/utils/api-handler';
import { getCurrentUser } from '@/infrastructure/database/auth-session';
import { PolarProvider } from '@/infrastructure/billing/polar.provider';
import { assertEnv } from '@/shared/config/assert-env';

const Schema = z.object({ customerId: z.string() });

export async function POST(req: NextRequest) {
  try {
    await getCurrentUser();
    const { customerId } = Schema.parse(await req.json());
    const billing = new PolarProvider();
    const appUrl = assertEnv('NEXT_PUBLIC_APP_URL');
    const session = await billing.createPortalSession({
      customerId,
      returnUrl: `${appUrl}/dashboard`,
    });
    return ok(session);
  } catch (err) {
    return handleError(err);
  }
}
