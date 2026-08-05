import { roomEqBusiness } from "../../../../lib/room-eq-gateway";

export async function POST() {
  await roomEqBusiness("health").catch(() => undefined);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store" },
  });
}
