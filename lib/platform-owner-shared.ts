const defaultOwnerEmails = new Set(["m.gough@irishpanda.com"]);

export function isDefaultPlatformOwnerEmail(email: string | null | undefined) {
  return email ? defaultOwnerEmails.has(email.trim().toLowerCase()) : false;
}
