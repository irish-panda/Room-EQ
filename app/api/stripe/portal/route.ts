import { NextResponse } from "next/server";
import {
  getOrganizationSnapshot,
  readOrganizationId,
  requireMembership,
} from "../../../../lib/organizations-server";
import { getStripe } from "../../../../lib/stripe-server";
import { getAuthenticatedUser } from "../../../../lib/auth-server";
import { isPlatformOwnerEmail } from "../../../../lib/platform-owner";
import { isLiveBillingEnabled } from "../../../../lib/billing-plans";

export async function POST(request: Request) {
  if (!isLiveBillingEnabled()) {
    return NextResponse.json(
      { error: "Subscriptions are not open yet." },
      { status: 503 },
    );
  }
  const user = await getAuthenticatedUser();
  const organizationId = readOrganizationId(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to manage billing." }, { status: 401 });
  }
  if (!organizationId) {
    return NextResponse.json({ error: "Choose a business first." }, { status: 400 });
  }

  try {
    await requireMembership(user.id, organizationId, "admin");
    const organization = await getOrganizationSnapshot(organizationId);
    if (
      isPlatformOwnerEmail(user.email) ||
      isPlatformOwnerEmail(organization.ownerEmail)
    ) {
      return NextResponse.json(
        { error: "Owner access is unrestricted and does not require a billing account." },
        { status: 409 },
      );
    }
    if (!organization.billing.customerId) {
      return NextResponse.json(
        { error: "This business does not have a billing account yet." },
        { status: 404 },
      );
    }

    const portalConfiguration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
    const portal = await getStripe().billingPortal.sessions.create({
      customer: organization.billing.customerId,
      ...(portalConfiguration ? { configuration: portalConfiguration } : {}),
      return_url: `${new URL(request.url).origin}/#pricing`,
    });
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
      return NextResponse.json(
        { error: "Only a business administrator can manage billing." },
        { status: 403 },
      );
    }
    console.error(
      "Could not create Stripe customer portal session:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Billing management could not be opened. Please try again." },
      { status: 500 },
    );
  }
}
