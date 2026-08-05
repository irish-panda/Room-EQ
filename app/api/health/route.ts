import { NextResponse } from "next/server";
import { getReleaseReadiness } from "../../../lib/release-readiness";

export const dynamic = "force-dynamic";

export function GET() {
  const readiness = getReleaseReadiness();
  return NextResponse.json(
    {
      status: readiness.ready ? "ready" : "configuration-required",
      ...readiness,
    },
    {
      status: readiness.ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}
