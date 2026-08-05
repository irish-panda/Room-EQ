import { headers } from "next/headers";
import { createRoomEqAuth } from "./auth";

export async function getAuthenticatedUser(options?: { useCookieCache?: boolean }) {
  const requestHeaders = await headers();
  const session = options?.useCookieCache
    ? await createRoomEqAuth().api.getSession({ headers: requestHeaders })
    : await createRoomEqAuth().api.getSession({
        headers: requestHeaders,
        query: { disableCookieCache: true },
      });
  return session?.user ?? null;
}
