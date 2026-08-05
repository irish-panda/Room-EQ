"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

export function ForgotPasswordForm({ enabled }: { enabled: boolean }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setPending(true);
    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/update-password",
      });
      if (error) throw new Error(error.message ?? "Recovery could not be started.");
      setSent(true);
      setMessage(
        "If an account uses that email, a reset link is on its way. Check your inbox and spam folder.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Recovery could not be started.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/">Room EQ Assistant</Link>
      <section className="auth-card">
        <span className="eyebrow">Account recovery</span>
        <h1>Reset your password</h1>
        <p>Enter the email used for your Room EQ Assistant login.</p>
        {enabled ? (
          <form className="auth-form" onSubmit={(event) => void submit(event)}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </label>
            {message && <p className="auth-message" role="status">{message}</p>}
            <button className="button primary large" type="submit" disabled={pending || sent}>
              {pending ? "Sending…" : sent ? "Reset email sent" : "Send reset link"}
            </button>
          </form>
        ) : (
          <div className="auth-message" role="status">
            <p>Email recovery is temporarily unavailable. Contact support for account help.</p>
            <a href="mailto:m.gough@irishpanda.com">m.gough@irishpanda.com</a>
          </div>
        )}
        <Link className="auth-text-link" href="/sign-in">Back to login</Link>
      </section>
    </main>
  );
}
