import { Polar } from '@polar-sh/sdk';
import { assertEnv } from '@/shared/config/assert-env';
import { ExternalApiError } from '@/shared/errors';

export interface CheckoutSession {
  url: string;
}

export interface IBillingProvider {
  createCheckout(params: {
    userId: string;
    email: string;
    productId: string;
    successUrl: string;
  }): Promise<CheckoutSession>;

  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
}

export class PolarProvider implements IBillingProvider {
  private client: Polar;

  constructor() {
    this.client = new Polar({ accessToken: assertEnv('POLAR_ACCESS_TOKEN') });
  }

  async createCheckout({ userId, email, productId, successUrl }: {
    userId: string;
    email: string;
    productId: string;
    successUrl: string;
  }): Promise<CheckoutSession> {
    try {
      const checkout = await this.client.checkouts.create({
        productId,
        successUrl,
        customerEmail: email,
        metadata: { userId },
      });

      if (!checkout.url) throw new ExternalApiError('Polar', 'Checkout URL missing from response.');
      return { url: checkout.url };
    } catch (err) {
      if (err instanceof ExternalApiError) throw err;
      throw new ExternalApiError('Polar', (err as Error).message);
    }
  }

  async createPortalSession({ customerId, returnUrl }: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    try {
      const session = await this.client.customerSessions.create({
        customerId,
      });

      const url = `${session.customerPortalUrl}?return_to=${encodeURIComponent(returnUrl)}`;
      return { url };
    } catch (err) {
      throw new ExternalApiError('Polar', (err as Error).message);
    }
  }
}
