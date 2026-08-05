import Link from "next/link";
import { LegalPage } from "../components/LegalPage";

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Agreement"
      title="Terms of Use"
      intro="These terms apply when you access or use Room EQ Assistant."
    >
      <section>
        <h2>Operator and acceptance</h2>
        <p>
          Room EQ Assistant is operated by Irish Panda in Brisbane, Queensland.
          By creating an account, joining a business workspace, starting a trial or
          using the service, you agree to these terms and the <Link href="/privacy">Privacy Policy</Link>.
          If you use the service for a business, you confirm that you are authorised to
          act for that business.
        </p>
      </section>

      <section>
        <h2>What the service provides</h2>
        <p>
          Room EQ Assistant provides browser-based signal generation, spectrum display,
          room-response measurements and conservative guidance. Results depend on the
          room, microphone, browser, device, speaker system and measurement conditions.
          The service is guidance only, not a certified acoustic calibration, engineering
          service or guarantee of a particular result.
        </p>
      </section>

      <section>
        <h2>Safe use</h2>
        <p>
          Test tones and amplified signals can damage hearing, loudspeakers and other
          equipment. Start at a low level, keep control of the amplifier, stop if anything
          sounds distressed, and follow the equipment manufacturer&apos;s instructions. You
          are responsible for safe levels, suitable equipment and the decisions you make
          from the guidance.
        </p>
      </section>

      <section>
        <h2>Accounts and business access</h2>
        <ul>
          <li>Keep login details secure and provide accurate account information.</li>
          <li>Solo is for one named user and must not be shared between people.</li>
          <li>Team and Business members must use their own invited login.</li>
          <li>Workspace owners and administrators are responsible for invitations, roles and removing access when it is no longer needed.</li>
          <li>Tell us promptly if you suspect unauthorised access.</li>
        </ul>
        <p>
          We may restrict or suspend access that is shared, abusive, unlawful, harmful to
          the service, or materially breaches these terms. Where reasonable, we will give
          notice and an opportunity to correct the issue.
        </p>
      </section>

      <section>
        <h2>Plans, trials and payment</h2>
        <p>
          Prices are shown in Australian dollars and include GST unless clearly stated
          otherwise. Paid plans renew monthly or annually through Stripe until cancelled.
          A 14-day trial may be offered to eligible new subscriptions. Additional Team or
          Business seats are charged at the displayed rate and may be prorated when the
          seat count changes during a billing period.
        </p>
        <p>
          You authorise Stripe to charge the selected payment method for recurring fees,
          taxes and additional seats. Workspace owners or administrators must keep the
          billing method current. Plan access may be limited if payment remains overdue.
        </p>
      </section>

      <section>
        <h2>Cancellation and refunds</h2>
        <p>
          You can cancel through Manage current plan in Plans &amp; Pricing. Cancellation
          stops the next renewal and paid access normally continues until the end of the
          paid billing period. The detailed policy is available on the <Link href="/refunds">Cancellation &amp; Refunds</Link> page.
          Nothing in these terms excludes rights or remedies that cannot lawfully be
          excluded under the Australian Consumer Law.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <p>You must not:</p>
        <ul>
          <li>Use the service unlawfully or to infringe another person&apos;s rights.</li>
          <li>Attempt to bypass plan, seat, security or access controls.</li>
          <li>Interfere with the service, introduce malicious code or probe other users&apos; data.</li>
          <li>Resell, copy or reverse engineer the service except where the law permits it.</li>
        </ul>
      </section>

      <section>
        <h2>Availability and changes</h2>
        <p>
          We work to keep the service available, but maintenance, browsers, third-party
          providers and internet faults can cause interruptions. We may improve or change
          features and plans. If a change materially reduces a paid service, we will take
          reasonable steps to notify affected customers and provide any remedy required by law.
        </p>
      </section>

      <section>
        <h2>Intellectual property</h2>
        <p>
          Irish Panda and its licensors own the service, software, branding and supplied
          content. We grant you a limited, non-exclusive, non-transferable right to use
          the service for its intended purpose while you comply with these terms. You
          retain ownership of information you provide.
        </p>
      </section>

      <section>
        <h2>Liability and consumer rights</h2>
        <p>
          To the extent permitted by law, Irish Panda is not liable for indirect or
          consequential loss, lost profit, lost data, equipment damage or decisions made
          from measurement guidance. Any liability that cannot be excluded is limited only
          to the extent the law permits. These terms do not limit statutory consumer
          guarantees or other non-excludable rights.
        </p>
      </section>

      <section>
        <h2>Governing law and contact</h2>
        <p>
          These terms are governed by the laws of Queensland, Australia, and applicable
          Commonwealth laws. Contact <a href="mailto:m.gough@irishpanda.com">m.gough@irishpanda.com</a>
          for support or questions about these terms.
        </p>
      </section>
    </LegalPage>
  );
}
