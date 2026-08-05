import { LegalPage } from "../components/LegalPage";

export default function RefundsPage() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Cancellation & Refunds"
      intro="How trials, renewals, cancellations, seat changes and refund requests work."
    >
      <section>
        <h2>Trials</h2>
        <p>
          Eligible paid subscriptions may start with a 14-day trial. Stripe shows the
          trial and first billing date before checkout is completed. Cancel before the
          trial ends to prevent the first recurring charge.
        </p>
      </section>

      <section>
        <h2>Recurring subscriptions</h2>
        <p>
          Solo, Team and Business plans renew automatically each month or year until
          cancelled. Prices are in Australian dollars and include GST. Added Team and
          Business seats may be charged on a prorated basis for the remaining billing period.
        </p>
      </section>

      <section>
        <h2>How to cancel</h2>
        <ol>
          <li>Log in and open Plans &amp; Pricing.</li>
          <li>Choose Manage current plan on your active plan.</li>
          <li>Cancel the subscription in the Stripe billing portal and keep the confirmation.</li>
        </ol>
        <p>
          Cancellation stops the next renewal. Unless Stripe or Irish Panda tells you
          otherwise, paid features remain available until the end of the current paid period.
          Removing the app or stopping use does not cancel a subscription.
        </p>
      </section>

      <section>
        <h2>Refunds</h2>
        <p>
          We do not normally provide a refund for change of mind, unused time, forgotten
          cancellation or reduced seat usage after a billing period has started. We will
          provide refunds, cancellations or other remedies where required by the Australian
          Consumer Law, including where a service has a major problem or does not meet an
          applicable consumer guarantee.
        </p>
        <p>
          We may also correct duplicate or clearly erroneous charges after confirming the
          payment record. Approved refunds are returned to the original payment method;
          banking and card networks control how quickly they appear.
        </p>
      </section>

      <section>
        <h2>Request help</h2>
        <p>
          Email <a href="mailto:m.gough@irishpanda.com">m.gough@irishpanda.com</a>
          with the account email, business name, charge date, amount and reason for the
          request. Do not send complete card numbers or passwords.
        </p>
      </section>
    </LegalPage>
  );
}
