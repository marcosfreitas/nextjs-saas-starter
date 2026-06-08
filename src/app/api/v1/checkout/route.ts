import { NextRequest } from 'next/server';
import { z } from 'zod';
import { ok, handleError } from '@/shared/utils/api-handler';
import { getCurrentUser } from '@/infrastructure/database/auth-session';
import { PolarProvider } from '@/infrastructure/billing/polar.provider';
import { assertEnv } from '@/shared/config/assert-env';
import { checkRateLimit } from '@/shared/utils/rate-limit';

const Schema = z.object({
  productId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    await checkRateLimit(`checkout:${user.id}`);
    const { productId } = Schema.parse(await req.json());
    const billing = new PolarProvider();
    const appUrl = assertEnv('NEXT_PUBLIC_APP_URL');
    const checkout = await billing.createCheckout({
      userId: user.id,
      email: user.email!,
      productId: productId ?? assertEnv('NEXT_PUBLIC_POLAR_PRODUCT_ID'),
      successUrl: `${appUrl}/dashboard?checkout=success`,
    });
    return ok(checkout);
  } catch (err) {
    return handleError(err);
  }
}
