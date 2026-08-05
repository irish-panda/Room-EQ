type GatewayKind = "auth" | "business";

type GatewayErrorPayload = {
  error?: string;
  code?: string;
};

export class RoomEqGatewayError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "RoomEqGatewayError";
    this.code = code;
  }
}

function requiredEnvironment(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export async function roomEqGateway<T>(input: {
  kind: GatewayKind;
  operation: string;
  model?: string;
  payload?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(requiredEnvironment("ROOM_EQ_GATEWAY_URL"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${requiredEnvironment("ROOM_EQ_SUPABASE_ANON_KEY")}`,
      apikey: requiredEnvironment("ROOM_EQ_SUPABASE_PUBLISHABLE_KEY"),
      "x-room-eq-gateway-secret": requiredEnvironment("ROOM_EQ_GATEWAY_SECRET"),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | ({ data?: T } & GatewayErrorPayload)
    | null;
  if (!response.ok || !body || !("data" in body)) {
    throw new RoomEqGatewayError(
      body?.error ?? "Room EQ data service is unavailable.",
      body?.code,
    );
  }
  return body.data as T;
}

export function roomEqBusiness<T>(
  operation: string,
  payload: Record<string, unknown> = {},
) {
  return roomEqGateway<T>({ kind: "business", operation, payload });
}
