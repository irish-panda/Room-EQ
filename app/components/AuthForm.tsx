"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authClient } from "../../lib/auth-client";

function safeNext() {
  const value = new URLSearchParams(window.location.search).get("next");
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/";
}

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "sign-up";

  useEffect(() => {
    void fetch("/api/account/warm", { method: "POST" }).catch(() => undefined);
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    if (isSignUp && name.trim().length < 2) {
      setMessage("Enter your full name so your account is easy to identify.");
      return;
    }
    if (isSignUp && password !== confirmPassword) {
      setMessage("The passwords do not match.");
      return;
    }
    setPending(true);
    let succeeded = false;
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: name.trim(),
          callbackURL: safeNext(),
        });
        if (error) {
          setMessage(error.message ?? "Account creation failed.");
          return;
        }
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
          callbackURL: safeNext(),
        });
        if (error) {
          setMessage(error.message ?? "Login failed.");
          return;
        }
      }
      succeeded = true;
      window.location.replace(safeNext());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      if (!succeeded) setPending(false);
    }
  };

  const signInWithGoogle = async () => {
    setPending(true);
    setMessage("");
    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: safeNext(),
        errorCallbackURL: "/sign-in?error=Google+login+could+not+be+completed.",
      });
      if (error) {
        setMessage(error.message ?? "Google login could not start.");
        setPending(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Google login could not start.");
      setPending(false);
    }
  };

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/">Room EQ Assistant</Link>
      <section className={`auth-card${isSignUp ? " auth-card-signup" : ""}`}>
        <span className="eyebrow">{isSignUp ? "Your account" : "Welcome back"}</span>
        <h1>{isSignUp ? "Create your login" : "Welcome back"}</h1>
        <p>
          {isSignUp
            ? "Create your own login first. You can create or join a business once you are inside."
            : "Log in to continue to Room EQ Assistant."}
        </p>
        <button
          className="button secondary auth-google"
          type="button"
          disabled={pending}
          onClick={() => void signInWithGoogle()}
        >
          Continue with Google
        </button>
        <div className="auth-divider"><span>or use email</span></div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {isSignUp && (
            <label>
              Full name
              <input
                type="text"
                autoComplete="name"
                minLength={2}
                maxLength={100}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </label>
          )}
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {isSignUp && (
            <label>
              Confirm password
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
          )}
          {isSignUp ? (
            <p className="auth-help">Use at least 10 characters. Your name can be changed later.</p>
          ) : (
            <Link className="auth-text-link" href="/forgot-password">Forgot password?</Link>
          )}
          {message && (
            <div className="auth-message" role="status">
              <p>{message}</p>
            </div>
          )}
          <button className="button primary large" disabled={pending} type="submit">
            {pending
              ? isSignUp ? "Creating account…" : "Logging in…"
              : isSignUp ? "Create account" : "Log in"}
          </button>
          {isSignUp && (
            <p className="auth-consent">
              By creating an account, you agree to the <Link href="/terms">Terms</Link>{" "}
              and acknowledge the <Link href="/privacy">Privacy Policy</Link>.
            </p>
          )}
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "Need an account?"}{" "}
          <Link href={isSignUp ? "/sign-in" : "/sign-up"}>
            {isSignUp ? "Log in" : "Create one"}
          </Link>
        </p>
      </section>
    </main>
  );
}
