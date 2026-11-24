import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { createSession, dummyPasswordHash, verifyPassword } from "@/lib/auth";
import { loginInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = loginInput.parse(await parseJson(request));
    const user = await getPrisma().user.findUnique({ where: { username: input.username } });
    const valid = await verifyPassword(input.password, user?.passwordHash ?? await dummyPasswordHash());
    if (!user || !valid || !user.active) {
      return NextResponse.json({ error: "Username or password is incorrect." }, { status: 401 });
    }
    await createSession(user.id);
    return NextResponse.json({ id: user.id, username: user.username, name: user.name, role: user.role });
  } catch (error) { return apiError(error); }
}
