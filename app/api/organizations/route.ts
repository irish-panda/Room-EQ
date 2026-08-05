import { NextResponse } from "next/server";
import {
  createOrganization,
  listOrganizations,
} from "../../../lib/organizations-server";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { isPlatformOwnerEmail } from "../../../lib/platform-owner";

export async function GET() {
  const user = await getAuthenticatedUser({ useCookieCache: true });
  if (!user) {
    return NextResponse.json({ error: "Sign in to view businesses." }, { status: 401 });
  }

  try {
    return NextResponse.json({
      organizations: await listOrganizations(user.id),
      isPlatformOwner: isPlatformOwnerEmail(user.email),
    });
  } catch (error) {
    console.error(
      "Could not list Room EQ organizations:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return NextResponse.json(
      { error: "Businesses could not be loaded." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to create a business." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (typeof body?.name !== "string") {
    return NextResponse.json({ error: "Enter a business name." }, { status: 400 });
  }

  try {
    return NextResponse.json(
      { organization: await createOrganization(user, body.name) },
      { status: 201 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_ORGANIZATION_NAME") {
      return NextResponse.json(
        { error: "Business names must be between 2 and 100 characters." },
        { status: 400 },
      );
    }
    console.error("Could not create Room EQ organization:", message);
    return NextResponse.json(
      { error: "The business could not be created." },
      { status: 500 },
    );
  }
}
