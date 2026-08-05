import { LegalPage } from "../components/LegalPage";

export default function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacy"
      title="Privacy Policy"
      intro="This policy explains how Irish Panda handles personal information when you use Room EQ Assistant."
    >
      <section>
        <h2>Who operates Room EQ Assistant</h2>
        <p>
          Room EQ Assistant is operated by Irish Panda in Brisbane, Queensland,
          Australia. Privacy questions, access requests and complaints can be sent to
          <a href="mailto:m.gough@irishpanda.com"> m.gough@irishpanda.com</a>.
        </p>
      </section>

      <section>
        <h2>Information we collect</h2>
        <p>Depending on how you use the service, we may collect:</p>
        <ul>
          <li>Your name, email address, login method and account identifiers.</li>
          <li>Business workspace names, membership, roles and invitation details.</li>
          <li>Your plan, seat count, subscription status and Stripe customer or subscription identifiers.</li>
          <li>Security and technical information needed to operate the service, including session cookies, request times, IP address and error logs.</li>
          <li>Messages you send when requesting support.</li>
        </ul>
        <p>
          Stripe handles payment-card details. Room EQ Assistant does not receive or
          store complete card numbers.
        </p>
      </section>

      <section>
        <h2>Audio and room measurements stay on your device</h2>
        <p>
          The analyser uses your browser&apos;s microphone permission to process audio in
          the browser. Raw microphone audio is not uploaded to Irish Panda. Room
          profiles, measurements, settings and analysis results are stored in that
          browser&apos;s local storage and IndexedDB unless the product clearly tells you
          otherwise. Clearing browser data or using a different device can remove or
          separate those local records.
        </p>
      </section>

      <section>
        <h2>How we use information</h2>
        <ul>
          <li>Provide and secure accounts, business access and subscriptions.</li>
          <li>Authenticate users through email/password or Google sign-in.</li>
          <li>Respond to support, privacy and billing requests.</li>
          <li>Prevent abuse, investigate faults and maintain the service.</li>
          <li>Meet legal, accounting and consumer-protection obligations.</li>
        </ul>
        <p>We do not sell personal information or use microphone audio for advertising.</p>
      </section>

      <section>
        <h2>Service providers and overseas processing</h2>
        <p>
          We use service providers to run the product, including Supabase for isolated
          Room EQ account data and server functions, Google for optional sign-in,
          Stripe for billing, Resend for account-recovery email, and Vercel for
          hosting and delivery. These providers may
          process information outside Australia, including in the United States and
          other regions where they or their subprocessors operate. We disclose only
          the information needed for them to provide their services.
        </p>
      </section>

      <section>
        <h2>Storage, security and retention</h2>
        <p>
          We use access controls, isolated Room EQ database objects, encrypted network
          connections and restricted server credentials. No online system is
          completely risk-free. We keep account and workspace information while it is
          needed to provide the service, then delete or de-identify it when reasonably
          possible. Some billing, security and dispute records may be retained for
          longer where required by law or legitimate business needs.
        </p>
      </section>

      <section>
        <h2>Your choices and rights</h2>
        <p>
          You can update your display name in your profile, clear locally stored room
          data in Settings, and cancel a paid subscription through Stripe&apos;s billing
          portal. Contact us to request access to, correction of or deletion of personal
          information held by Irish Panda. We may need to verify your identity and may
          retain information where the law requires it.
        </p>
      </section>

      <section>
        <h2>Questions and complaints</h2>
        <p>
          Email <a href="mailto:m.gough@irishpanda.com">m.gough@irishpanda.com</a>
          with enough detail for us to investigate. We will respond within a reasonable
          time. If a privacy concern remains unresolved, you may be entitled to contact
          the Office of the Australian Information Commissioner.
        </p>
      </section>

      <section>
        <h2>Changes to this policy</h2>
        <p>
          We may update this policy when the product, providers or legal requirements
          change. The current version and update date will remain available on this page.
        </p>
      </section>
    </LegalPage>
  );
}
