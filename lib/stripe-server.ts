import Stripe from "stripe";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");

  stripeClient ??= new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  return stripeClient;
}

export function getStripeWebhookCryptoProvider() {
  return Stripe.createSubtleCryptoProvider();
}
