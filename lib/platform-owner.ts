import { isDefaultPlatformOwnerEmail } from "./platform-owner-shared.ts";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function configuredOwnerEmails() {
  const configured = process.env.ROOM_EQ_OWNER_EMAILS?.split(",") ?? [];
  return new Set(
    configured.map(normalizeEmail).filter(Boolean),
  );
}

export function isPlatformOwnerEmail(email: string | null | undefined) {
  return Boolean(
    email &&
      (isDefaultPlatformOwnerEmail(email) ||
        configuredOwnerEmails().has(normalizeEmail(email))),
  );
}
