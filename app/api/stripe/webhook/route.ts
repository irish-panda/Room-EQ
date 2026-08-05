import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getStripe,
  getStripeWebhookCryptoProvider,
} from "../../../../lib/stripe-server";
import { syncStripeSubscription } from "../../../../lib/sync-subscription";
import { isLiveBillingEnabled } from "../../../../lib/billing-plans";

export async function POST(request: Request) {
  if (!isLiveBillingEnabled()) {
    return NextResponse.json(
      { error: "Live billing is not enabled." },
      { status: 503 },
    );
  }
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      await request.text(),
      signature,
      webhookSecret,
      undefined,
      getStripeWebhookCryptoProvider(),
    );
  } catch (error) {
    console.error(
      "Stripe webhook signature verification failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Invalid Stripe signature." }, { status: 400 });
  }

  try {
    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncStripeSubscription(event.data.object);
    } else if (event.type === "checkout.session.completed") {
      const subscriptionId = event.data.object.subscription;
      if (typeof subscriptionId === "string") {
        await syncStripeSubscription(
          await getStripe().subscriptions.retrieve(subscriptionId),
        );
      }
    }
  } catch (error) {
    console.error(
      "Stripe webhook processing failed:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
