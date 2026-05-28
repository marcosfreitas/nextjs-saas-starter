import { NextRequest, NextResponse } from 'next/server';
import { assertEnv } from '@/shared/config/assert-env';

// Extend this handler as you add Polar webhook events.
// See: https://docs.polar.sh/webhooks

export async function POST(req: NextRequest) {
  const secret = assertEnv('POLAR_WEBHOOK_SECRET');
  const signature = req.headers.get('webhook-signature') ?? '';

  if (!signature || signature !== secret) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 });
  }

  const payload = await req.json();

  switch (payload.type) {
    case 'subscription.created':
    case 'subscription.updated':
    case 'subscription.canceled':
      // TODO: update subscription in DB
      break;

    case 'order.created':
      // TODO: fulfill one-time purchase
      break;
  }

  return NextResponse.json({ received: true });
}
