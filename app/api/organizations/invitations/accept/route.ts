import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "../../../../../lib/auth-server";
import {
  acceptOrganizationInvitation,
  getInvitationByTokenHash,
  normalizeEmail,
} from "../../../../../lib/organizations-server";
import { reconcileOrganizationSubscription } from "../../../../../lib/sync-subscription";

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user?.email) {
    return NextResponse.json(
      { error: "Log in with the invited email before accepting." },
      { status: 401 },
    );
  }
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || !/^[0-9a-f]{64}$/i.test(body.token)) {
    return NextResponse.json({ error: "That invitation link is invalid." }, { status: 400 });
  }

  try {
    const tokenHash = await hashToken(body.token.toLowerCase());
    const invitation = await getInvitationByTokenHash(tokenHash);
    if (!invitation) {
      return NextResponse.json({ error: "That invitation was not found." }, { status: 404 });
    }
    if (invitation.accepted_at || invitation.revoked_at) {
      return NextResponse.json(
        { error: "That invitation is no longer active." },
        { status: 409 },
      );
    }
    if (new Date(invitation.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "That invitation has expired." }, { status: 410 });
    }
    if (normalizeEmail(user.email) !== invitation.email) {
      return NextResponse.json(
        { error: `Log in as ${invitation.email} to accept this invitation.` },
        { status: 403 },
      );
    }

    await acceptOrganizationInvitation(invitation, user);

    await reconcileOrganizationSubscription(invitation.organization_id).catch(
      (error) => {
        console.error(
          "Could not reconcile seats after invitation acceptance:",
          error instanceof Error ? error.message : "Unknown error",
        );
      },
    );
    return NextResponse.json({
      accepted: true,
      organizationId: invitation.organization_id,
    });
  } catch (error) {
    console.error(
      "Could not accept Room EQ invitation:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "The invitation could not be accepted." },
      { status: 500 },
    );
  }
}
