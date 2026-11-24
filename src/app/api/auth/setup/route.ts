import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { createSession, hashPassword } from "@/lib/auth";
import { setupInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Reports whether the first administrator still has to be created.
export async function GET() {
  try {
    const users = await getPrisma().user.count();
    return NextResponse.json({ needsSetup: users === 0 });
  } catch (error) { return apiError(error); }
}

// Creates the first administrator. Disabled once any user exists.
export async function POST(request: Request) {
  try {
    const input = setupInput.parse(await parseJson(request));
    const passwordHash = await hashPassword(input.password);
    const user = await getPrisma().$transaction(async (tx) => {
      // Serialise concurrent setup attempts so only one admin can be created.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(724001)`;
      if (await tx.user.count() > 0) return null;
      return tx.user.create({
        data: { name: input.name, username: input.username, passwordHash, role: "admin" },
      });
    });
    if (!user) {
      return NextResponse.json({ error: "Setup is already complete. Sign in instead." }, { status: 409 });
    }
    await createSession(user.id);
    return NextResponse.json({ id: user.id, username: user.username, name: user.name, role: user.role }, { status: 201 });
  } catch (error) { return apiError(error); }
}
