import type { RoomEqUser } from "./auth";
import type { BillingMetadata } from "./billing-metadata";
import { roomEqBusiness } from "./room-eq-gateway";

export type OrganizationRole = "admin" | "member";

export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  memberCount: number;
  isOwner: boolean;
};

export type OrganizationMember = {
  id: number;
  userId: string;
  email: string;
  role: OrganizationRole;
  isOwner: boolean;
  createdAt: string;
};

export type OrganizationInvitation = {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  createdAt: string;
};

type MembershipRow = {
  id: string;
  organization_id: string;
  user_id: string;
  email: string;
  role: OrganizationRole;
  is_owner?: boolean;
  created_at: Date | string;
};

type OrganizationRow = {
  id: string;
  name: string;
  created_by?: string;
  owner_email?: string | null;
};

type SubscriptionRow = {
  organization_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  cycle: string | null;
  status: string | null;
  current_period_end: Date | string | null;
  included_users: number | null;
  additional_seats: number;
  seat_limit_exceeded: boolean;
};

type OrganizationSnapshotPayload = {
  organization: OrganizationRow | null;
  member_count: number;
  subscription: SubscriptionRow | null;
};

export type InvitationRow = {
  id: string;
  organization_id: string;
  email: string;
  role: OrganizationRole;
  expires_at: Date | string;
  accepted_at: Date | string | null;
  revoked_at: Date | string | null;
};

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function iso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function readOrganizationId(request: Request) {
  const value = request.headers.get("x-room-eq-organization-id")?.trim();
  return value && /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(value) ? value : null;
}

export async function getMembership(userId: string, organizationId: string) {
  return roomEqBusiness<MembershipRow | null>("getMembership", {
    organizationId,
    userId,
  });
}

export async function requireMembership(
  userId: string,
  organizationId: string,
  requiredRole?: OrganizationRole,
) {
  const membership = await getMembership(userId, organizationId);
  if (!membership || (requiredRole && membership.role !== requiredRole)) {
    throw new Error(requiredRole === "admin" ? "ADMIN_REQUIRED" : "MEMBERSHIP_REQUIRED");
  }
  return membership;
}

export async function listOrganizations(userId: string) {
  const rows = await roomEqBusiness<Array<{
    id: string;
    name: string;
    role: OrganizationRole;
    member_count: number;
    is_owner: boolean;
  }>>("listOrganizations", { userId });
  return rows.map<OrganizationSummary>((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    memberCount: row.member_count,
    isOwner: row.is_owner,
  }));
}

export async function createOrganization(user: RoomEqUser, name: string) {
  const normalizedName = name.trim();
  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw new Error("INVALID_ORGANIZATION_NAME");
  }
  const email = normalizeEmail(user.email);
  if (!email) throw new Error("EMAIL_REQUIRED");

  return roomEqBusiness<OrganizationRow>("createOrganization", {
    name: normalizedName,
    userId: user.id,
    email,
  });
}

export async function getOrganizationSnapshot(organizationId: string) {
  const snapshot = await roomEqBusiness<OrganizationSnapshotPayload>(
    "getSnapshot",
    { organizationId },
  );
  return organizationSnapshot(snapshot);
}

export async function getAuthorizedOrganizationSnapshot(
  userId: string,
  organizationId: string,
) {
  const snapshot = await roomEqBusiness<OrganizationSnapshotPayload | null>(
    "getAuthorizedSnapshot",
    { userId, organizationId },
  );
  return snapshot ? organizationSnapshot(snapshot) : null;
}

function organizationSnapshot(snapshot: OrganizationSnapshotPayload) {
  if (!snapshot.organization) throw new Error("ORGANIZATION_NOT_FOUND");
  return {
    id: snapshot.organization.id,
    name: snapshot.organization.name,
    ownerUserId: snapshot.organization.created_by ?? null,
    ownerEmail: snapshot.organization.owner_email ?? null,
    memberCount: snapshot.member_count ?? 0,
    billing: subscriptionRowToBilling(snapshot.subscription),
  };
}

export async function listOrganizationTeam(organizationId: string) {
  const team = await roomEqBusiness<{
    members: MembershipRow[];
    invitations: Array<{
      id: string;
      email: string;
      role: OrganizationRole;
      expires_at: Date | string;
      created_at: Date | string;
    }>;
  }>("listTeam", { organizationId });

  return {
    members: team.members.map<OrganizationMember>((member) => ({
      id: Number(member.id),
      userId: member.user_id,
      email: member.email,
      role: member.role,
      isOwner: Boolean(member.is_owner),
      createdAt: iso(member.created_at),
    })),
    invitations: team.invitations.map<OrganizationInvitation>((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: iso(invitation.expires_at),
      createdAt: iso(invitation.created_at),
    })),
  };
}

export async function organizationHasEmail(organizationId: string, email: string) {
  return roomEqBusiness<boolean>("organizationHasEmail", { organizationId, email });
}

export async function createOrganizationInvitation(input: {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}) {
  return roomEqBusiness<{ id: string }>("createInvitation", {
    organizationId: input.organizationId,
    email: input.email,
    role: input.role,
    tokenHash: input.tokenHash,
    userId: input.invitedBy,
    expiresAt: input.expiresAt.toISOString(),
  });
}

export async function revokeOrganizationInvitation(
  organizationId: string,
  invitationId: string,
) {
  await roomEqBusiness("revokeInvitation", { organizationId, invitationId });
}

export async function getOrganizationMember(
  organizationId: string,
  memberId: number,
) {
  return roomEqBusiness<{
    id: string;
    user_id: string;
    role: OrganizationRole;
  } | null>("getMember", { memberId, organizationId });
}

export async function countOrganizationAdmins(organizationId: string) {
  return roomEqBusiness<number>("countAdmins", { organizationId });
}

export async function removeOrganizationMember(
  organizationId: string,
  memberId: number,
) {
  await roomEqBusiness("removeMember", { organizationId, memberId });
}

export async function getInvitationByTokenHash(tokenHash: string) {
  return roomEqBusiness<InvitationRow | null>("getInvitation", { tokenHash });
}

export async function acceptOrganizationInvitation(
  invitation: InvitationRow,
  user: RoomEqUser,
) {
  await roomEqBusiness("acceptInvitation", {
    organizationId: invitation.organization_id,
    invitationId: invitation.id,
    userId: user.id,
    email: normalizeEmail(user.email),
    role: invitation.role,
  });
}

export function subscriptionRowToBilling(row: SubscriptionRow | null): BillingMetadata {
  if (!row) return {};
  return {
    customerId: row.stripe_customer_id ?? undefined,
    subscriptionId: row.stripe_subscription_id ?? undefined,
    plan:
      row.plan === "solo" || row.plan === "team" || row.plan === "business"
        ? row.plan
        : undefined,
    cycle: row.cycle === "monthly" || row.cycle === "annual" ? row.cycle : undefined,
    status: row.status ?? undefined,
    currentPeriodEnd: row.current_period_end
      ? Math.floor(new Date(row.current_period_end).getTime() / 1000)
      : null,
    includedUsers: row.included_users ?? undefined,
    additionalSeats: row.additional_seats,
    seatLimitExceeded: row.seat_limit_exceeded,
  };
}

export async function writeBillingMetadata(
  organizationId: string,
  billing: BillingMetadata,
) {
  await roomEqBusiness("writeBilling", {
    organizationId,
    customerId: billing.customerId ?? null,
    subscriptionId: billing.subscriptionId ?? null,
    plan: billing.plan ?? null,
    cycle: billing.cycle ?? null,
    status: billing.status ?? null,
    currentPeriodEnd: billing.currentPeriodEnd
      ? new Date(billing.currentPeriodEnd * 1000).toISOString()
      : null,
    includedUsers: billing.includedUsers ?? null,
    additionalSeats: billing.additionalSeats ?? 0,
    seatLimitExceeded: billing.seatLimitExceeded ?? false,
  });
}
