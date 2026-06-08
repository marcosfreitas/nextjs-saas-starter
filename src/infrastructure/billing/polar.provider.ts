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
    externalCustomerId: string;
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
        products: [productId],
        successUrl,
        customerEmail: email,
        // Bind the Polar customer to our user so the portal can be resolved
        // server-side by external ID — never trust a client-supplied customer id.
        externalCustomerId: userId,
        metadata: { userId },
      });

      if (!checkout.url) throw new ExternalApiError('Polar', 'Checkout URL missing from response.');
      return { url: checkout.url };
    } catch (err) {
      if (err instanceof ExternalApiError) throw err;
      throw new ExternalApiError('Polar', (err as Error).message);
    }
  }

  async createPortalSession({ externalCustomerId, returnUrl }: {
    externalCustomerId: string;
    returnUrl: string;
  }): Promise<{ url: string }> {
    try {
      const session = await this.client.customerSessions.create({
        externalCustomerId,
      });

      const portalUrl = new URL(session.customerPortalUrl);
      portalUrl.searchParams.set('return_to', returnUrl);
      return { url: portalUrl.toString() };
    } catch (err) {
      throw new ExternalApiError('Polar', (err as Error).message);
    }
  }
}
