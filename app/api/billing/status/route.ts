import { NextResponse } from "next/server";
import { isSubscriptionAccessActive } from "../../../../lib/billing-plans";
import {
  getAuthorizedOrganizationSnapshot,
  readOrganizationId,
} from "../../../../lib/organizations-server";
import { getAuthenticatedUser } from "../../../../lib/auth-server";
import { isPlatformOwnerEmail } from "../../../../lib/platform-owner";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser({ useCookieCache: true });
  if (!user) {
    return NextResponse.json({ error: "Sign in to view billing." }, { status: 401 });
  }
  const organizationId = readOrganizationId(request);
  if (!organizationId) return NextResponse.json({ billing: null });

  try {
    const organization = await getAuthorizedOrganizationSnapshot(
      user.id,
      organizationId,
    );
    if (!organization) {
      return NextResponse.json(
        { error: "Business access is required." },
        { status: 403 },
      );
    }
    const hasOwnerAccess =
      isPlatformOwnerEmail(user.email) || isPlatformOwnerEmail(organization.ownerEmail);
    if (hasOwnerAccess) {
      return NextResponse.json({
        billing: {
          plan: "business",
          status: "active",
          currentPeriodEnd: null,
          cycle: null,
          memberCount: organization.memberCount,
          includedUsers: null,
          additionalSeats: 0,
          seatLimitExceeded: false,
          hasAccess: true,
          isPlatformOwner: true,
        },
        organization: { memberCount: organization.memberCount },
      });
    }
    const billing = organization.billing;

    return NextResponse.json({
      billing: billing.status
        ? {
            plan: billing.plan ?? null,
            status: billing.status,
            currentPeriodEnd: billing.currentPeriodEnd ?? null,
            cycle: billing.cycle ?? null,
            memberCount: organization.memberCount,
            includedUsers: billing.includedUsers ?? null,
            additionalSeats: billing.additionalSeats ?? 0,
            seatLimitExceeded: billing.seatLimitExceeded ?? false,
            hasAccess:
              isSubscriptionAccessActive(billing.status) &&
              !billing.seatLimitExceeded,
            isPlatformOwner: false,
          }
        : null,
      organization: { memberCount: organization.memberCount },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_REQUIRED") {
      return NextResponse.json({ error: "Business access is required." }, { status: 403 });
    }
    console.error(
      "Could not load billing status:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Billing could not be loaded." }, { status: 500 });
  }
}
