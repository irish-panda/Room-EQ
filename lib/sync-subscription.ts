import type Stripe from "stripe";
import type { BillingMetadata } from "./billing-metadata";
import {
  calculateAdditionalSeats,
  getSeatPriceId,
  isBillingCycle,
  isPaidPlanId,
  paidPlans,
} from "./billing-plans";
import {
  getOrganizationSnapshot,
  writeBillingMetadata,
} from "./organizations-server";
import { getStripe } from "./stripe-server";

type OrganizationSnapshot = Awaited<ReturnType<typeof getOrganizationSnapshot>>;

const seatReconciliationStatuses = new Set([
  "active",
  "trialing",
  "past_due",
]);

function getSubscriptionCycle(subscription: Stripe.Subscription) {
  if (isBillingCycle(subscription.metadata.cycle)) {
    return subscription.metadata.cycle;
  }

  const recurringInterval = subscription.items.data.find(
    (item) => item.price.metadata.kind === "base",
  )?.price.recurring?.interval;
  return recurringInterval === "year" ? "annual" : "monthly";
}

async function reconcileSeatItem(
  subscription: Stripe.Subscription,
  seatPriceId: string | undefined,
  additionalSeats: number,
) {
  const stripe = getStripe();
  const subscriptionItems = await stripe.subscriptionItems.list({
    subscription: subscription.id,
    limit: 20,
  });
  const seatItem = subscriptionItems.data.find(
    (item) =>
      item.price.metadata.kind === "seat" ||
      (seatPriceId ? item.price.id === seatPriceId : false),
  );

  if (additionalSeats === 0) {
    if (seatItem) {
      await stripe.subscriptionItems.del(seatItem.id, {
        proration_behavior: "create_prorations",
      });
    }
    return;
  }

  if (!seatPriceId) {
    throw new Error("The additional-seat price is not configured.");
  }

  if (!seatItem) {
    await stripe.subscriptionItems.create({
      subscription: subscription.id,
      price: seatPriceId,
      quantity: additionalSeats,
      proration_behavior: "create_prorations",
      metadata: { app: "room_eq_assistant", kind: "seat" },
    });
    return;
  }

  if (
    (seatItem.quantity ?? 1) !== additionalSeats ||
    seatItem.price.id !== seatPriceId
  ) {
    await stripe.subscriptionItems.update(seatItem.id, {
      price: seatPriceId,
      quantity: additionalSeats,
      proration_behavior: "create_prorations",
    });
  }
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  suppliedOrganization?: OrganizationSnapshot,
): Promise<BillingMetadata | undefined> {
  const organizationId = subscription.metadata.roomEqOrganizationId;
  if (!organizationId) return;

  const itemPeriodEnds = subscription.items.data.map(
    (item) => item.current_period_end,
  );
  const currentPeriodEnd = itemPeriodEnds.length
    ? Math.max(...itemPeriodEnds)
    : subscription.trial_end;
  const plan = isPaidPlanId(subscription.metadata.plan)
    ? subscription.metadata.plan
    : undefined;
  const organization =
    suppliedOrganization ?? (await getOrganizationSnapshot(organizationId));
  const cycle = getSubscriptionCycle(subscription);
  const additionalSeats = plan
    ? calculateAdditionalSeats(plan, organization.memberCount)
    : 0;
  const seatLimitExceeded = plan === "solo" && additionalSeats > 0;

  if (
    plan &&
    !seatLimitExceeded &&
    seatReconciliationStatuses.has(subscription.status)
  ) {
    await reconcileSeatItem(
      subscription,
      getSeatPriceId(plan, cycle),
      additionalSeats,
    );
  }

  const billing: BillingMetadata = {
    ...organization.billing,
    customerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id,
    subscriptionId: subscription.id,
    plan,
    cycle,
    status: subscription.status,
    currentPeriodEnd,
    memberCount: organization.memberCount,
    includedUsers: plan ? paidPlans[plan].includedUsers : undefined,
    additionalSeats,
    seatLimitExceeded,
  };

  await writeBillingMetadata(organizationId, billing);
  return billing;
}

export async function reconcileOrganizationSubscription(organizationId: string) {
  const organization = await getOrganizationSnapshot(organizationId);
  if (!organization.billing.subscriptionId) return organization.billing;

  const subscription = await getStripe().subscriptions.retrieve(
    organization.billing.subscriptionId,
  );
  return syncStripeSubscription(subscription, organization);
}
