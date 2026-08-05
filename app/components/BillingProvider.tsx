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
import { useAccount } from "./AuthProvider";

export type BillingSummary = {
  plan: string | null;
  status: string;
  cycle: string | null;
  currentPeriodEnd: number | null;
  memberCount: number;
  includedUsers: number | null;
  additionalSeats: number;
  seatLimitExceeded: boolean;
  hasAccess: boolean;
  isPlatformOwner: boolean;
};

type BillingContextValue = {
  billing: BillingSummary | null;
  organizationMemberCount: number;
  isLoading: boolean;
  error: string;
  refresh: () => Promise<void>;
};

type BillingState = {
  organizationId: string;
  billing: BillingSummary | null;
  organizationMemberCount: number;
  error: string;
};

const BillingContext = createContext<BillingContextValue | null>(null);

async function requestBillingStatus(organizationId: string) {
  const response = await fetch("/api/billing/status", {
    cache: "no-store",
    headers: { "x-room-eq-organization-id": organizationId },
  });
  const data = (await response.json()) as {
    billing?: BillingSummary | null;
    organization?: { memberCount?: number };
    error?: string;
  };
  if (!response.ok) throw new Error(data.error ?? "Billing could not be loaded.");
  return {
    billing: data.billing ?? null,
    organizationMemberCount: data.organization?.memberCount ?? 1,
  };
}

export function BillingProvider({ children }: { children: ReactNode }) {
  const {
    isLoaded,
    isSignedIn,
    activeOrganization,
    activeOrganizationId,
    isPlatformOwner,
  } = useAccount();
  const [state, setState] = useState<BillingState | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !activeOrganizationId || isPlatformOwner) return;
    let ignore = false;
    void requestBillingStatus(activeOrganizationId)
      .then((result) => {
        if (!ignore) {
          setState({ organizationId: activeOrganizationId, ...result, error: "" });
        }
      })
      .catch((error) => {
        if (ignore) return;
        const message =
          error instanceof Error ? error.message : "Billing could not be loaded.";
        setState((current) =>
          current?.organizationId === activeOrganizationId
            ? { ...current, error: message }
            : {
                organizationId: activeOrganizationId,
                billing: null,
                organizationMemberCount: 1,
                error: message,
              },
        );
      });
    return () => {
      ignore = true;
    };
  }, [activeOrganizationId, isLoaded, isPlatformOwner, isSignedIn]);

  useEffect(() => {
    if (
      !activeOrganizationId ||
      state?.organizationId !== activeOrganizationId ||
      state.billing?.plan !== "solo" ||
      !["active", "trialing", "past_due"].includes(state.billing.status)
    ) {
      return;
    }

    const key = `room-eq-solo-session-enforced:${activeOrganizationId}`;
    if (window.sessionStorage.getItem(key)) return;
    void authClient.revokeOtherSessions().then(({ error }) => {
      if (!error) window.sessionStorage.setItem(key, "true");
    });
  }, [activeOrganizationId, state]);

  const refresh = useCallback(async () => {
    if (!activeOrganizationId) return;
    try {
      const result = await requestBillingStatus(activeOrganizationId);
      setState({ organizationId: activeOrganizationId, ...result, error: "" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Billing could not be loaded.";
      setState((current) =>
        current?.organizationId === activeOrganizationId
          ? { ...current, error: message }
          : {
              organizationId: activeOrganizationId,
              billing: null,
              organizationMemberCount: 1,
              error: message,
            },
      );
    }
  }, [activeOrganizationId]);

  const value = useMemo<BillingContextValue>(() => {
    if (isPlatformOwner) {
      const memberCount = activeOrganization?.memberCount ?? 1;
      return {
        billing: {
          plan: "business",
          status: "active",
          cycle: null,
          currentPeriodEnd: null,
          memberCount,
          includedUsers: null,
          additionalSeats: 0,
          seatLimitExceeded: false,
          hasAccess: true,
          isPlatformOwner: true,
        },
        organizationMemberCount: memberCount,
        isLoading: false,
        error: "",
        refresh,
      };
    }
    const currentState =
      state?.organizationId === activeOrganizationId ? state : null;
    return {
      billing: currentState?.billing ?? null,
      organizationMemberCount: currentState?.organizationMemberCount ?? 1,
      isLoading:
        !isLoaded || Boolean(isSignedIn && activeOrganizationId && !currentState),
      error: currentState?.error ?? "",
      refresh,
    };
  }, [
    activeOrganization?.memberCount,
    activeOrganizationId,
    isLoaded,
    isPlatformOwner,
    isSignedIn,
    refresh,
    state,
  ]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const context = useContext(BillingContext);
  if (!context) throw new Error("useBilling must be used within BillingProvider.");
  return context;
}
