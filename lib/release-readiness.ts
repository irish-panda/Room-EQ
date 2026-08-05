const requiredStripePriceVariables = [
  "STRIPE_SOLO_MONTHLY_PRICE_ID",
  "STRIPE_SOLO_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_MONTHLY_PRICE_ID",
  "STRIPE_TEAM_ANNUAL_PRICE_ID",
  "STRIPE_TEAM_SEAT_MONTHLY_PRICE_ID",
  "STRIPE_TEAM_SEAT_ANNUAL_PRICE_ID",
  "STRIPE_BUSINESS_MONTHLY_PRICE_ID",
  "STRIPE_BUSINESS_ANNUAL_PRICE_ID",
  "STRIPE_BUSINESS_SEAT_MONTHLY_PRICE_ID",
  "STRIPE_BUSINESS_SEAT_ANNUAL_PRICE_ID",
] as const;

export function getReleaseReadiness() {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const authentication = Boolean(
    process.env.BETTER_AUTH_URL?.startsWith("https://") &&
      process.env.BETTER_AUTH_SECRET &&
      process.env.ROOM_EQ_GATEWAY_URL?.startsWith("https://") &&
      process.env.ROOM_EQ_GATEWAY_SECRET,
  );
  const googleLogin = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const passwordRecovery = Boolean(
    process.env.RESEND_API_KEY &&
      process.env.ROOM_EQ_EMAIL_FROM &&
      process.env.ROOM_EQ_SUPPORT_EMAIL,
  );
  const liveBilling = Boolean(
    process.env.STRIPE_LIVE_BILLING_ENABLED === "true" &&
      (stripeSecretKey?.startsWith("sk_live_") ||
        stripeSecretKey?.startsWith("rk_live_")) &&
      process.env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") &&
      requiredStripePriceVariables.every((name) =>
        process.env[name]?.startsWith("price_"),
      ),
  );

  return {
    ready: authentication && googleLogin && passwordRecovery && liveBilling,
    services: {
      authentication,
      googleLogin,
      passwordRecovery,
      liveBilling,
    },
  };
}
