import Link from "next/link";
import { LegalPage } from "../components/LegalPage";

export default function SupportPage() {
  return (
    <LegalPage
      eyebrow="Help"
      title="Support"
      intro="Account, billing and product help from Irish Panda."
    >
      <section>
        <h2>Contact</h2>
        <p>
          Email <a href="mailto:m.gough@irishpanda.com">m.gough@irishpanda.com</a>.
          Include the account email, business name, device and browser, what you expected,
          and what happened. Do not send your password, full card number or private keys.
        </p>
      </section>

      <section>
        <h2>Account recovery</h2>
        <p>
          Email/password users can request a secure link from <Link href="/forgot-password">Reset your password</Link>.
          Google users should continue with the same Google account used at sign-up.
        </p>
      </section>

      <section>
        <h2>Billing help</h2>
        <p>
          Workspace owners and administrators can manage an active subscription from
          Plans &amp; Pricing. See <Link href="/refunds">Cancellation &amp; Refunds</Link> for
          renewal, cancellation and refund information.
        </p>
      </section>

      <section>
        <h2>Measurement troubleshooting</h2>
        <ul>
          <li>Allow microphone access and close other apps using the microphone.</li>
          <li>Start with a low speaker level and keep the room quiet.</li>
          <li>Repeat measurements from the same microphone position.</li>
          <li>Use a supported current browser on a phone, tablet or computer.</li>
          <li>Remember that local room records do not automatically move between devices.</li>
        </ul>
      </section>
    </LegalPage>
  );
}
