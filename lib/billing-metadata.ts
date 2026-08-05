import type { BillingCycle, PaidPlanId } from "./billing-plans";

export type BillingMetadata = {
  customerId?: string;
  subscriptionId?: string;
  plan?: PaidPlanId;
  cycle?: BillingCycle;
  status?: string;
  currentPeriodEnd?: number | null;
  memberCount?: number;
  includedUsers?: number;
  additionalSeats?: number;
  seatLimitExceeded?: boolean;
};
