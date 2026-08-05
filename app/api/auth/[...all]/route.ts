import { toNextJsHandler } from "better-auth/next-js";
import { createRoomEqAuth } from "../../../../lib/auth";

async function handle(request: Request, method: "GET" | "POST") {
  const auth = createRoomEqAuth();
  const handler = toNextJsHandler(auth)[method];
  try {
    return await handler(request);
  } catch (error) {
    console.error("Room EQ authentication request failed:", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
      code:
        error && typeof error === "object" && "code" in error
          ? String(error.code)
          : undefined,
    });
    return Response.json({ message: "Authentication service is unavailable." }, { status: 503 });
  }
}

export function GET(request: Request) {
  return handle(request, "GET");
}

export function POST(request: Request) {
  return handle(request, "POST");
}
