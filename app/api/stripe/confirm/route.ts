import { NextResponse } from "next/server";
import {
  readOrganizationId,
  requireMembership,
} from "../../../../lib/organizations-server";
import { getStripe } from "../../../../lib/stripe-server";
import { getAuthenticatedUser } from "../../../../lib/auth-server";
import { syncStripeSubscription } from "../../../../lib/sync-subscription";
import { isLiveBillingEnabled } from "../../../../lib/billing-plans";

export async function GET(request: Request) {
  if (!isLiveBillingEnabled()) {
    return NextResponse.json(
      { error: "Subscriptions are not open yet." },
      { status: 503 },
    );
  }
  const user = await getAuthenticatedUser();
  const organizationId = readOrganizationId(request);
  if (!user || !organizationId) {
    return NextResponse.json({ error: "Sign in to confirm checkout." }, { status: 401 });
  }

  const checkoutSessionId = new URL(request.url).searchParams.get("session_id");
  if (!checkoutSessionId?.startsWith("cs_")) {
    return NextResponse.json({ error: "Checkout session is missing." }, { status: 400 });
  }

  try {
    await requireMembership(user.id, organizationId);
    const stripe = getStripe();
    const checkout = await stripe.checkout.sessions.retrieve(checkoutSessionId);
    if (checkout.client_reference_id !== organizationId) {
      return NextResponse.json(
        { error: "Checkout does not belong to this business." },
        { status: 403 },
      );
    }
    if (typeof checkout.subscription !== "string") {
      return NextResponse.json(
        { error: "Subscription is not ready yet." },
        { status: 409 },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(checkout.subscription);
    await syncStripeSubscription(subscription);
    return NextResponse.json({
      billing: { plan: subscription.metadata.plan, status: subscription.status },
    });
  } catch (error) {
    console.error(
      "Could not confirm Stripe Checkout session:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Checkout confirmation is still processing. Refresh shortly." },
      { status: 500 },
    );
  }
}
