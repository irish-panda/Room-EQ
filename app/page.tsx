import { RoomEqAssistant } from "./RoomEqAssistant";
import { AuthProvider } from "./components/AuthProvider";
import { BillingProvider } from "./components/BillingProvider";
import { getAuthenticatedUser } from "../lib/auth-server";
import { listOrganizations } from "../lib/organizations-server";
import { isPlatformOwnerEmail } from "../lib/platform-owner";

export default async function Home() {
  const liveBillingEnabled = process.env.STRIPE_LIVE_BILLING_ENABLED === "true";
  const googleAuthEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
  const initialUser = await getAuthenticatedUser({ useCookieCache: true }).catch(
    () => null,
  );
  const initialOrganizations = initialUser
    ? await listOrganizations(initialUser.id).catch(() => [])
    : [];
  return (
    <AuthProvider
      initialUser={initialUser}
      initialOrganizations={initialOrganizations}
      initialIsPlatformOwner={isPlatformOwnerEmail(initialUser?.email)}
    >
      <BillingProvider>
        <RoomEqAssistant
          googleAuthEnabled={googleAuthEnabled}
          liveBillingEnabled={liveBillingEnabled}
        />
      </BillingProvider>
    </AuthProvider>
  );
}
