/**
 * Billing port.
 *
 * Declared here because the domain decides what a payment unlocks; the gateway
 * only moves money. `infrastructure/billing/` implements this.
 *
 * Neither method grants anything. Entitlements are granted only by the verified
 * payment webhook, because a returned checkout URL is not proof of payment.
 */

export interface CheckoutSession {
  url: string;
}

export interface CreateCheckoutParams {
  userId: string;
  email: string;
  productId: string;
  successUrl: string;
}

export interface CreatePortalSessionParams {
  /** Our own user id, bound at checkout. Never a client-supplied customer id. */
  externalCustomerId: string;
  returnUrl: string;
}

export interface IBillingProvider {
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession>;
  createPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }>;
}
