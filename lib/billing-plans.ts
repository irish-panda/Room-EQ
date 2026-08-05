export type PaidPlanId = "solo" | "team" | "business";
export type BillingCycle = "monthly" | "annual";

export const paidPlans: Record<
  PaidPlanId,
  {
    name: string;
    includedUsers: number;
    priceEnv: Record<BillingCycle, string>;
    seatPriceEnv?: Record<BillingCycle, string>;
  }
> = {
  solo: {
    name: "Solo",
    includedUsers: 1,
    priceEnv: {
      monthly: "STRIPE_SOLO_MONTHLY_PRICE_ID",
      annual: "STRIPE_SOLO_ANNUAL_PRICE_ID",
    },
  },
  team: {
    name: "Team",
    includedUsers: 5,
    priceEnv: {
      monthly: "STRIPE_TEAM_MONTHLY_PRICE_ID",
      annual: "STRIPE_TEAM_ANNUAL_PRICE_ID",
    },
    seatPriceEnv: {
      monthly: "STRIPE_TEAM_SEAT_MONTHLY_PRICE_ID",
      annual: "STRIPE_TEAM_SEAT_ANNUAL_PRICE_ID",
    },
  },
  business: {
    name: "Business",
    includedUsers: 20,
    priceEnv: {
      monthly: "STRIPE_BUSINESS_MONTHLY_PRICE_ID",
      annual: "STRIPE_BUSINESS_ANNUAL_PRICE_ID",
    },
    seatPriceEnv: {
      monthly: "STRIPE_BUSINESS_SEAT_MONTHLY_PRICE_ID",
      annual: "STRIPE_BUSINESS_SEAT_ANNUAL_PRICE_ID",
    },
  },
};

export function isPaidPlanId(value: unknown): value is PaidPlanId {
  return typeof value === "string" && value in paidPlans;
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return value === "monthly" || value === "annual";
}

export function getPriceId(plan: PaidPlanId, cycle: BillingCycle) {
  return process.env[paidPlans[plan].priceEnv[cycle]];
}

export function getSeatPriceId(plan: PaidPlanId, cycle: BillingCycle) {
  const configuration = paidPlans[plan];
  if (!configuration.seatPriceEnv) {
    return undefined;
  }
  return process.env[configuration.seatPriceEnv[cycle]];
}

export function isLiveBillingEnabled() {
  return (
    process.env.STRIPE_LIVE_BILLING_ENABLED === "true" &&
    process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_") === true
  );
}

export function calculateAdditionalSeats(plan: PaidPlanId, memberCount: number) {
  return Math.max(0, Math.floor(memberCount) - paidPlans[plan].includedUsers);
}

export function isSubscriptionAccessActive(status: string | undefined) {
  return status === "active" || status === "trialing" || status === "past_due";
}
