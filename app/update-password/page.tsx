"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "../../lib/auth-client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setMessage("That password reset link is incomplete or has expired.");
      return;
    }
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setMessage(error.message ?? "Your password could not be updated.");
      return;
    }
    setMessage("Password updated. Returning to your account…");
    window.setTimeout(() => window.location.assign("/"), 900);
  };

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/">Room EQ Assistant</Link>
      <section className="auth-card">
        <span className="eyebrow">Account security</span>
        <h1>Choose a new password</h1>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="button primary large" type="submit">Update password</button>
        </form>
      </section>
    </main>
  );
}
