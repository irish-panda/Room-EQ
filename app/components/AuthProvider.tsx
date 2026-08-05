"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authClient } from "../../lib/auth-client";
import { isDefaultPlatformOwnerEmail } from "../../lib/platform-owner-shared";

export type AccountUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
};

export type AccountOrganization = {
  id: string;
  name: string;
  role: "admin" | "member";
  memberCount: number;
  isOwner: boolean;
};

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  user: AccountUser | null;
  organizations: AccountOrganization[];
  organizationsLoaded: boolean;
  activeOrganization: AccountOrganization | null;
  activeOrganizationId: string | null;
  isAdmin: boolean;
  isOrganizationOwner: boolean;
  isPlatformOwner: boolean;
  notice: string;
  selectOrganization: (organizationId: string) => void;
  createOrganization: (name: string) => Promise<void>;
  updateProfile: (name: string) => Promise<void>;
  refreshOrganizations: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const storageKey = "room-eq-active-organization";

function savedOrganizationId() {
  return typeof window === "undefined"
    ? null
    : window.localStorage.getItem(storageKey);
}

async function requestOrganizations() {
  const response = await fetch("/api/organizations", { cache: "no-store" });
  const data = (await response.json()) as {
    organizations?: AccountOrganization[];
    isPlatformOwner?: boolean;
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Businesses could not be loaded.");
  return {
    organizations: data.organizations ?? [],
    isPlatformOwner: Boolean(data.isPlatformOwner),
  };
}

export function AuthProvider({
  children,
  initialUser,
  initialOrganizations,
  initialIsPlatformOwner = false,
}: {
  children: ReactNode;
  initialUser?: AccountUser | null;
  initialOrganizations?: AccountOrganization[];
  initialIsPlatformOwner?: boolean;
}) {
  const session = authClient.useSession();
  const refetchSession = session.refetch;
  const sessionUser = (session.data?.user as AccountUser | undefined) ?? null;
  const [optimisticSignedOut, setOptimisticSignedOut] = useState(false);
  const user = optimisticSignedOut
    ? null
    : session.isPending
      ? (initialUser ?? null)
      : sessionUser;
  const signedInUserId = user?.id ?? null;
  const [organizations, setOrganizations] = useState<AccountOrganization[]>(
    initialOrganizations ?? [],
  );
  const [activeOrganizationId, setActiveOrganizationId] =
    useState<string | null>(() =>
      savedOrganizationId() ?? initialOrganizations?.[0]?.id ?? null,
    );
  const [organizationsLoaded, setOrganizationsLoaded] = useState(
    initialOrganizations !== undefined,
  );
  const [isPlatformOwner, setIsPlatformOwner] = useState(initialIsPlatformOwner);
  const [notice, setNotice] = useState("");

  const applyOrganizations = useCallback((next: AccountOrganization[]) => {
    setOrganizations(next);
    setActiveOrganizationId((current) => {
      const saved = current ?? window.localStorage.getItem(storageKey);
      const chosen = next.some((organization) => organization.id === saved)
        ? saved
        : (next[0]?.id ?? null);
      if (chosen) window.localStorage.setItem(storageKey, chosen);
      else window.localStorage.removeItem(storageKey);
      return chosen;
    });
  }, []);

  const refreshOrganizations = useCallback(async () => {
    const next = await requestOrganizations();
    applyOrganizations(next.organizations);
    setIsPlatformOwner(next.isPlatformOwner);
    setOrganizationsLoaded(true);
  }, [applyOrganizations]);

  const acceptInvitation = useCallback(async () => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("invite");
    if (!token) return;

    const response = await fetch("/api/organizations/invitations/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await response.json()) as {
      organizationId?: string;
      error?: string;
    };
    url.searchParams.delete("invite");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    if (!response.ok) {
      setNotice(data.error ?? "The invitation could not be accepted.");
      return;
    }
    if (data.organizationId) {
      window.localStorage.setItem(storageKey, data.organizationId);
      setActiveOrganizationId(data.organizationId);
    }
    setNotice("Business invitation accepted.");
  }, []);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      if (session.isPending) return;
      if (signedInUserId) {
        try {
          await acceptInvitation();
          if (!ignore) {
            const next = await requestOrganizations();
            applyOrganizations(next.organizations);
            setIsPlatformOwner(next.isPlatformOwner);
          }
        } catch (error) {
          if (!ignore) {
            setNotice(
              error instanceof Error ? error.message : "Businesses could not be loaded.",
            );
          }
        } finally {
          if (!ignore) {
            setOrganizationsLoaded(true);
          }
        }
      } else {
        setOrganizations([]);
        setActiveOrganizationId(null);
        setIsPlatformOwner(false);
        setOrganizationsLoaded(true);
      }
    };

    void load();

    return () => {
      ignore = true;
    };
  }, [acceptInvitation, applyOrganizations, session.isPending, signedInUserId]);

  useEffect(() => {
    if (!signedInUserId) return;
    const timer = window.setInterval(() => {
      void refetchSession();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [refetchSession, signedInUserId]);

  const selectOrganization = useCallback((organizationId: string) => {
    window.localStorage.setItem(storageKey, organizationId);
    setActiveOrganizationId(organizationId);
  }, []);

  const createOrganization = useCallback(
    async (name: string) => {
      const response = await fetch("/api/organizations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as {
        organization?: { id: string };
        error?: string;
      };
      if (!response.ok || !data.organization) {
        throw new Error(data.error ?? "The business could not be created.");
      }
      window.localStorage.setItem(storageKey, data.organization.id);
      setActiveOrganizationId(data.organization.id);
      await refreshOrganizations();
      setNotice("Business workspace created.");
    },
    [refreshOrganizations],
  );

  const updateProfile = useCallback(
    async (name: string) => {
      const normalizedName = name.trim();
      if (normalizedName.length < 2 || normalizedName.length > 100) {
        throw new Error("Enter a name between 2 and 100 characters.");
      }
      const { error } = await authClient.updateUser({ name: normalizedName });
      if (error) throw new Error(error.message ?? "Your profile could not be updated.");
      await session.refetch();
      setNotice("Profile updated.");
    },
    [session],
  );

  const signOut = useCallback(() => {
    setOptimisticSignedOut(true);
    window.localStorage.removeItem(storageKey);
    setOrganizations([]);
    setActiveOrganizationId(null);
    setIsPlatformOwner(false);
    void authClient.signOut().then(({ error }) => {
      if (error) {
        setNotice(error.message ?? "Log out could not be completed.");
        setOptimisticSignedOut(false);
      }
    });
    return Promise.resolve();
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const activeOrganization =
      organizations.find((organization) => organization.id === activeOrganizationId) ??
      null;
    return {
      isLoaded: initialUser !== undefined || !session.isPending,
      isSignedIn: Boolean(user),
      user,
      organizations,
      organizationsLoaded,
      activeOrganization,
      activeOrganizationId:
        activeOrganization?.id ??
        (organizationsLoaded ? null : activeOrganizationId),
      isAdmin: activeOrganization?.role === "admin",
      isOrganizationOwner: Boolean(activeOrganization?.isOwner),
      isPlatformOwner:
        isPlatformOwner || isDefaultPlatformOwnerEmail(user?.email),
      notice,
      selectOrganization,
      createOrganization,
      updateProfile,
      refreshOrganizations,
      signOut,
    };
  }, [
    activeOrganizationId,
    createOrganization,
    notice,
    organizations,
    organizationsLoaded,
    isPlatformOwner,
    refreshOrganizations,
    selectOrganization,
    session.isPending,
    signOut,
    updateProfile,
    user,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAccount() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAccount must be used within AuthProvider.");
  return context;
}
