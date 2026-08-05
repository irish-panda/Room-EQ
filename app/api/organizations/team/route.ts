import { NextResponse } from "next/server";
import {
  countOrganizationAdmins,
  createOrganizationInvitation,
  getOrganizationSnapshot,
  getOrganizationMember,
  listOrganizationTeam,
  normalizeEmail,
  organizationHasEmail,
  readOrganizationId,
  removeOrganizationMember,
  requireMembership,
  revokeOrganizationInvitation,
  type OrganizationRole,
} from "../../../../lib/organizations-server";
import { isSubscriptionAccessActive } from "../../../../lib/billing-plans";
import { getAuthenticatedUser } from "../../../../lib/auth-server";
import { reconcileOrganizationSubscription } from "../../../../lib/sync-subscription";
import { isPlatformOwnerEmail } from "../../../../lib/platform-owner";

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function membershipError(error: unknown) {
  if (error instanceof Error && error.message === "ADMIN_REQUIRED") {
    return NextResponse.json(
      { error: "Only a business administrator can manage workers." },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to view workers." }, { status: 401 });
  }
  const organizationId = readOrganizationId(request);
  if (!organizationId) {
    return NextResponse.json({ error: "Choose a business first." }, { status: 400 });
  }

  try {
    await requireMembership(user.id, organizationId);
    return NextResponse.json(await listOrganizationTeam(organizationId));
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_REQUIRED") {
      return NextResponse.json({ error: "Business access is required." }, { status: 403 });
    }
    console.error(
      "Could not load Room EQ team:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Workers could not be loaded." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to invite a worker." }, { status: 401 });
  }
  const organizationId = readOrganizationId(request);
  if (!organizationId) {
    return NextResponse.json({ error: "Choose a business first." }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as
    | { email?: unknown; role?: unknown }
    | null;
  const email = typeof body?.email === "string" ? normalizeEmail(body.email) : "";
  const role: OrganizationRole = body?.role === "admin" ? "admin" : "member";
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Enter a valid worker email." }, { status: 400 });
  }

  try {
    await requireMembership(user.id, organizationId, "admin");
    const snapshot = await getOrganizationSnapshot(organizationId);
    const hasOwnerAccess =
      isPlatformOwnerEmail(user.email) || isPlatformOwnerEmail(snapshot.ownerEmail);
    if (
      !hasOwnerAccess &&
      (!snapshot.billing.plan ||
        !isSubscriptionAccessActive(snapshot.billing.status))
    ) {
      return NextResponse.json(
        { error: "Start a paid plan before inviting workers." },
        { status: 409 },
      );
    }
    if (!hasOwnerAccess && snapshot.billing.plan === "solo") {
      return NextResponse.json(
        { error: "Solo supports one person. Move to Team before inviting workers." },
        { status: 409 },
      );
    }
    if (!hasOwnerAccess && role === "admin" && snapshot.billing.plan !== "business") {
      return NextResponse.json(
        { error: "Administrator roles are available on Business. Invite this person as a worker or upgrade." },
        { status: 409 },
      );
    }

    if (await organizationHasEmail(organizationId, email)) {
      return NextResponse.json(
        { error: "That person already belongs to this business." },
        { status: 409 },
      );
    }

    const token = randomToken();
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    let invitation: { id: string };
    try {
      invitation = await createOrganizationInvitation({
        organizationId,
        email,
        role,
        tokenHash,
        invitedBy: user.id,
        expiresAt,
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return NextResponse.json(
          { error: "A current invitation already exists for that email." },
          { status: 409 },
        );
      }
      throw error;
    }

    const origin = new URL(request.url).origin;
    const inviteUrl = `${origin}/?invite=${token}`;

    return NextResponse.json({
      invitationId: invitation.id,
      inviteUrl,
      emailSent: false,
      emailNote: "Copy the secure invitation link and send it to the worker.",
    });
  } catch (error) {
    const response = membershipError(error);
    if (response) return response;
    console.error(
      "Could not create Room EQ invitation:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "The invitation could not be created." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to manage workers." }, { status: 401 });
  }
  const organizationId = readOrganizationId(request);
  if (!organizationId) {
    return NextResponse.json({ error: "Choose a business first." }, { status: 400 });
  }
  const body = (await request.json().catch(() => null)) as
    | { memberId?: unknown; invitationId?: unknown }
    | null;

  try {
    await requireMembership(user.id, organizationId, "admin");

    if (typeof body?.invitationId === "string") {
      await revokeOrganizationInvitation(organizationId, body.invitationId);
      return NextResponse.json({ removed: true });
    }

    if (typeof body?.memberId !== "number") {
      return NextResponse.json({ error: "Choose a worker to remove." }, { status: 400 });
    }
    const target = await getOrganizationMember(organizationId, body.memberId);
    if (!target) {
      return NextResponse.json({ error: "That worker was not found." }, { status: 404 });
    }
    if (target.user_id === user.id) {
      return NextResponse.json(
        { error: "You cannot remove your own administrator access." },
        { status: 409 },
      );
    }
    if (target.role === "admin") {
      if ((await countOrganizationAdmins(organizationId)) <= 1) {
        return NextResponse.json(
          { error: "Every business needs at least one administrator." },
          { status: 409 },
        );
      }
    }

    await removeOrganizationMember(organizationId, body.memberId);
    await reconcileOrganizationSubscription(organizationId).catch((error) => {
      console.error(
        "Could not reconcile seats after member removal:",
        error instanceof Error ? error.message : "Unknown error",
      );
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    const response = membershipError(error);
    if (response) return response;
    console.error(
      "Could not remove Room EQ team access:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json({ error: "Access could not be removed." }, { status: 500 });
  }
}
