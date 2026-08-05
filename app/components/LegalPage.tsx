import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="legal-page">
      <header className="legal-topbar">
        <Link className="legal-brand" href="/">Room EQ Assistant</Link>
        <Link className="legal-back" href="/">Back to the app</Link>
      </header>
      <article className="legal-document">
        <header className="legal-heading">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <small>Last updated 4 August 2026</small>
        </header>
        <div className="legal-content">{children}</div>
      </article>
      <footer className="legal-footer">
        <span>Room EQ Assistant is an Irish Panda product.</span>
        <nav aria-label="Legal and support">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refunds">Cancellation & refunds</Link>
          <Link href="/support">Support</Link>
        </nav>
      </footer>
    </main>
  );
}
