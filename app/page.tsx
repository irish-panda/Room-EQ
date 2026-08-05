import { RoomEqAssistant } from "./RoomEqAssistant";
import { AuthProvider } from "./components/AuthProvider";
import { BillingProvider } from "./components/BillingProvider";

export default function Home() {
  const liveBillingEnabled = process.env.STRIPE_LIVE_BILLING_ENABLED === "true";
  return (
    <AuthProvider>
      <BillingProvider>
        <RoomEqAssistant liveBillingEnabled={liveBillingEnabled} />
      </BillingProvider>
    </AuthProvider>
  );
}
