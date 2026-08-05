import { NextResponse } from "next/server";
import {
  calculateAdditionalSeats,
  getPriceId,
  getSeatPriceId,
  isBillingCycle,
  isLiveBillingEnabled,
  isPaidPlanId,
} from "../../../../lib/billing-plans";
import {
  getOrganizationSnapshot,
  readOrganizationId,
  requireMembership,
  writeBillingMetadata,
} from "../../../../lib/organizations-server";
import { getStripe } from "../../../../lib/stripe-server";
import { getAuthenticatedUser } from "../../../../lib/auth-server";
import { syncStripeSubscription } from "../../../../lib/sync-subscription";
import { isPlatformOwnerEmail } from "../../../../lib/platform-owner";

export async function POST(request: Request) {
  if (!isLiveBillingEnabled()) {
    return NextResponse.json(
      { error: "Subscriptions are not open yet." },
      { status: 503 },
    );
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to start a trial." }, { status: 401 });
  }
  const organizationId = readOrganizationId(request);
  if (!organizationId) {
    return NextResponse.json(
      { error: "Choose or create a business before starting a trial." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | { plan?: unknown; cycle?: unknown }
    | null;
  if (!isPaidPlanId(body?.plan) || !isBillingCycle(body?.cycle)) {
    return NextResponse.json(
      { error: "Choose a valid plan and billing cycle." },
      { status: 400 },
    );
  }
  const priceId = getPriceId(body.plan, body.cycle);
  if (!priceId) {
    return NextResponse.json({ error: "That plan is not configured yet." }, { status: 503 });
  }

  try {
    await requireMembership(user.id, organizationId, "admin");
    const organization = await getOrganizationSnapshot(organizationId);
    if (
      isPlatformOwnerEmail(user.email) ||
      isPlatformOwnerEmail(organization.ownerEmail)
    ) {
      return NextResponse.json(
        { error: "Owner access already includes unrestricted Business features at no charge." },
        { status: 409 },
      );
    }
    const stripe = getStripe();
    let customerId = organization.billing.customerId;

    if (customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 20,
      });
      const existingSubscription = subscriptions.data.find((subscription) =>
        ["active", "trialing", "past_due", "unpaid"].includes(subscription.status),
      );
      if (existingSubscription) {
        await syncStripeSubscription(existingSubscription, organization);
        return NextResponse.json(
          { error: "This business already has a subscription. Manage the current plan instead." },
          { status: 409 },
        );
      }
    }

    const additionalSeats = calculateAdditionalSeats(
      body.plan,
      organization.memberCount,
    );
    if (body.plan === "solo" && additionalSeats > 0) {
      return NextResponse.json(
        { error: "Solo supports one member. Remove additional members or choose Team." },
        { status: 400 },
      );
    }
    const seatPriceId = getSeatPriceId(body.plan, body.cycle);
    if (additionalSeats > 0 && !seatPriceId) {
      return NextResponse.json(
        { error: "Additional-seat billing is not configured for that plan." },
        { status: 503 },
      );
    }

    if (!customerId) {
      const customer = await stripe.customers.create(
        {
          name: organization.name,
          email: user.email,
          metadata: { roomEqOrganizationId: organizationId },
        },
        { idempotencyKey: `room-eq-customer-${organizationId}` },
      );
      customerId = customer.id;
      await writeBillingMetadata(organizationId, {
        ...organization.billing,
        customerId,
      });
    }

    const lineItems = [
      { price: priceId, quantity: 1 },
      ...(additionalSeats > 0 && seatPriceId
        ? [{ price: seatPriceId, quantity: additionalSeats }]
        : []),
    ];
    const origin = new URL(request.url).origin;
    const checkout = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: lineItems,
      allow_promotion_codes: true,
      billing_address_collection: "required",
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      client_reference_id: organizationId,
      metadata: {
        roomEqOrganizationId: organizationId,
        plan: body.plan,
        cycle: body.cycle,
      },
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          roomEqOrganizationId: organizationId,
          plan: body.plan,
          cycle: body.cycle,
        },
      },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}#pricing`,
      cancel_url: `${origin}/?checkout=cancelled#pricing`,
    });

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Only a business administrator can manage the subscription." },
        { status: 403 },
      );
    }
    console.error(
      "Could not create Stripe Checkout session:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Checkout could not be opened. Please try again." },
      { status: 500 },
    );
  }
}
