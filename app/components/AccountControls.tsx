"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "./AuthProvider";
import { useBilling } from "./BillingProvider";

type TeamMember = {
  id: number;
  userId: string;
  email: string;
  role: "admin" | "member";
  isOwner: boolean;
};

type TeamInvitation = {
  id: string;
  email: string;
  role: "admin" | "member";
  expiresAt: string;
};

function DialogPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function useDialog(onClose: () => void) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose]);
}

function ProfileDialog({ onClose }: { onClose: () => void }) {
  const { user, isPlatformOwner, updateProfile, signOut } = useAccount();
  const [name, setName] = useState(user?.name ?? "");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useDialog(onClose);

  useEffect(() => {
    void fetch("/api/account/warm", { method: "POST" }).catch(() => undefined);
  }, []);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setSaving(true);
    try {
      await updateProfile(name);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DialogPortal>
    <div className="account-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="account-dialog profile-dialog"
        onSubmit={(event) => void save(event)}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="account-dialog-heading">
          <div>
            <span className="eyebrow">Personal profile</span>
            <h2>Your account</h2>
          </div>
          <button type="button" className="account-dialog-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="profile-summary">
          <span className="profile-avatar" aria-hidden="true">
            {(user?.name || user?.email || "R").trim().charAt(0).toUpperCase()}
          </span>
          <div>
            <strong>{user?.name || "Room EQ user"}</strong>
            <span>
              {isPlatformOwner
                ? "Platform owner · Business · unlimited users"
                : "Individual account"}
            </span>
          </div>
        </div>

        <label>
          Full name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={100}
            autoComplete="name"
            required
          />
        </label>
        <label>
          Email
          <input value={user?.email ?? ""} readOnly aria-readonly="true" />
        </label>
        <p className="profile-note">Your profile belongs to you. Business access and billing are managed separately.</p>
        {message && <p className="team-message" role="status">{message}</p>}

        <div className="profile-actions">
          <button className="button primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          <button
            className="account-link profile-sign-out"
            type="button"
            onClick={() => {
              onClose();
              void signOut();
            }}
          >
            Log out
          </button>
        </div>
      </form>
    </div>
    </DialogPortal>
  );
}

function TeamDialog({ onClose }: { onClose: () => void }) {
  const {
    activeOrganization,
    isOrganizationOwner,
    isPlatformOwner,
    user,
    refreshOrganizations,
  } = useAccount();
  const { billing } = useBilling();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  useDialog(onClose);
  const canAssignAdministrators =
    billing?.plan === "business" || isPlatformOwner;

  const request = async (init?: RequestInit) => {
    if (!activeOrganization) throw new Error("Choose a business first.");
    const response = await fetch("/api/organizations/team", {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-room-eq-organization-id": activeOrganization.id,
        ...(init?.headers ?? {}),
      },
    });
    const data = (await response.json()) as {
      members?: TeamMember[];
      invitations?: TeamInvitation[];
      inviteUrl?: string;
      emailNote?: string;
      error?: string;
    };
    if (!response.ok) throw new Error(data.error ?? "Team access could not be updated.");
    return data;
  };

  const loadTeam = async () => {
    const data = await request();
    setMembers(data.members ?? []);
    setInvitations(data.invitations ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void request()
      .then((data) => {
        setMembers(data.members ?? []);
        setInvitations(data.invitations ?? []);
        setLoading(false);
      })
      .catch((error) => {
        setMessage(
          error instanceof Error ? error.message : "Workers could not be loaded.",
        );
        setLoading(false);
      });
    // The dialog is recreated when the active organization changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrganization?.id]);

  const invite = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setInviteUrl("");
    try {
      const data = await request({
        method: "POST",
        body: JSON.stringify({ email, role }),
      });
      setMessage(data.emailNote ?? "Invitation created.");
      setInviteUrl(data.inviteUrl ?? "");
      setEmail("");
      await loadTeam();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Invitation failed.");
    }
  };

  const remove = async (body: { memberId?: number; invitationId?: string }) => {
    if (!window.confirm("Remove this access?")) return;
    setMessage("");
    try {
      await request({ method: "DELETE", body: JSON.stringify(body) });
      await Promise.all([loadTeam(), refreshOrganizations()]);
      setMessage("Access removed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access could not be removed.");
    }
  };

  return (
    <DialogPortal>
    <div className="account-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="account-dialog team-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="account-dialog-heading">
          <div>
            <span className="eyebrow">Business access</span>
            <h2 id="team-dialog-title">{activeOrganization?.name} team</h2>
          </div>
          <button className="account-dialog-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {activeOrganization?.role === "admin" && (
          <form className="team-invite-form" onSubmit={(event) => void invite(event)}>
            <label>
              Worker email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="worker@business.com"
                required
              />
            </label>
            <label>
              Access
              {canAssignAdministrators ? (
                <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
                  <option value="member">Worker</option>
                  <option value="admin">Administrator</option>
                </select>
              ) : (
                <input value="Worker" readOnly aria-readonly="true" />
              )}
            </label>
            <button className="button primary" type="submit">
              Send invitation
            </button>
          </form>
        )}

        {message && <p className="team-message" role="status">{message}</p>}
        {inviteUrl && (
          <div className="invite-link-row">
            <input value={inviteUrl} readOnly aria-label="Invitation link" />
            <button
              className="button secondary"
              onClick={() => void navigator.clipboard.writeText(inviteUrl)}
            >
              Copy link
            </button>
          </div>
        )}

        <div className="team-list" aria-busy={loading}>
          {loading ? (
            <p>Loading workers…</p>
          ) : (
            members.map((member) => (
              <div className="team-row" key={member.id}>
                <div>
                  <strong>{member.email}</strong>
                  <span>
                    {member.isOwner
                      ? "Owner"
                      : member.role === "admin"
                        ? "Administrator"
                        : "Worker"}
                  </span>
                </div>
                {activeOrganization?.role === "admin" && member.userId !== user?.id && (
                  <button
                    className="account-link"
                    onClick={() => void remove({ memberId: member.id })}
                  >
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
          {invitations.map((invitation) => (
            <div className="team-row pending" key={invitation.id}>
              <div>
                <strong>{invitation.email}</strong>
                <span>Invitation pending · {invitation.role}</span>
              </div>
              {activeOrganization?.role === "admin" && (
                <button
                  className="account-link"
                  onClick={() => void remove({ invitationId: invitation.id })}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
        {isOrganizationOwner && (
          <p className="profile-note">
            Owners manage invitations. Business plans can also assign administrators.
          </p>
        )}
      </section>
    </div>
    </DialogPortal>
  );
}

export function AccountControls() {
  const {
    isLoaded,
    isSignedIn,
    user,
    organizations,
    organizationsLoaded,
    activeOrganization,
    selectOrganization,
    createOrganization,
  } = useAccount();
  const [creating, setCreating] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [message, setMessage] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  useEffect(() => {
    if (!creating) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreating(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [creating]);

  if (!isLoaded) {
    return <div className="account-controls account-loading" aria-label="Loading account"><span /></div>;
  }

  if (!isSignedIn) {
    return (
      <div className="account-controls" aria-label="Account controls">
        <a className="account-link" href="/sign-in">Log in</a>
        <a className="account-link account-link-primary" href="/sign-up">Create account</a>
      </div>
    );
  }

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      await createOrganization(businessName);
      setCreating(false);
      setBusinessName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The business could not be created.");
    }
  };

  return (
    <>
      <div className="account-controls" aria-label="Account controls">
        {!organizationsLoaded ? (
          <span className="account-business-loading" aria-label="Loading businesses" />
        ) : organizations.length > 0 ? (
          <select
            className="workspace-select"
            aria-label="Active business"
            value={activeOrganization?.id ?? ""}
            onChange={(event) => selectOrganization(event.target.value)}
          >
            {organizations.map((organization) => (
              <option value={organization.id} key={organization.id}>{organization.name}</option>
            ))}
          </select>
        ) : (
          <button className="account-link" onClick={() => setCreating(true)}>Create business</button>
        )}
        {activeOrganization && (
          <button className="account-link" onClick={() => setShowTeam(true)}>Team</button>
        )}
        <button
          className="account-profile-button"
          title="Open your account"
          aria-label="Open your account"
          onClick={() => setShowProfile(true)}
        >
          <span aria-hidden="true">{(user?.name || user?.email || "R").trim().charAt(0).toUpperCase()}</span>
          <strong>{user?.name || user?.email}</strong>
        </button>
      </div>

      {creating && (
        <DialogPortal>
        <div className="account-dialog-backdrop" role="presentation" onMouseDown={() => setCreating(false)}>
          <form className="account-dialog" onSubmit={(event) => void create(event)} onMouseDown={(event) => event.stopPropagation()}>
            <div className="account-dialog-heading">
              <div>
                <span className="eyebrow">Company workspace</span>
                <h2>Create your business</h2>
              </div>
              <button type="button" className="account-dialog-close" onClick={() => setCreating(false)} aria-label="Close">×</button>
            </div>
            <label>
              Business name
              <input value={businessName} onChange={(event) => setBusinessName(event.target.value)} minLength={2} maxLength={100} required autoFocus />
            </label>
            {message && <p className="team-message" role="alert">{message}</p>}
            <button className="button primary" type="submit">Create business</button>
          </form>
        </div>
        </DialogPortal>
      )}
      {showTeam && activeOrganization && <TeamDialog onClose={() => setShowTeam(false)} />}
      {showProfile && <ProfileDialog onClose={() => setShowProfile(false)} />}
    </>
  );
}
