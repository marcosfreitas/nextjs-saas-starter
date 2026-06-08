import { NextRequest, NextResponse } from 'next/server';
import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { assertEnv } from '@/shared/config/assert-env';

// Extend this handler as you add Polar webhook events.
// See: https://docs.polar.sh/webhooks

export async function POST(req: NextRequest) {
  const secret = assertEnv('POLAR_WEBHOOK_SECRET');

  // Verify over the raw body — validateEvent computes the Standard Webhooks
  // HMAC and throws on mismatch. Must read text() before any json() parse.
  const body = await req.text();
  const headers = Object.fromEntries(req.headers);

  let event;
  try {
    event = validateEvent(body, headers, secret);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 403 });
    }
    throw err;
  }

  switch (event.type) {
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
