import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { userCreateInput } from "@/lib/validation";
import { publicUserSelect } from "@/lib/user-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdmin();
    const users = await getPrisma().user.findMany({ select: publicUserSelect, orderBy: { username: "asc" } });
    return NextResponse.json(users);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const { password, ...input } = userCreateInput.parse(await parseJson(request));
    const prisma = getPrisma();
    if (await prisma.user.findUnique({ where: { username: input.username }, select: { id: true } })) {
      return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    }
    const user = await prisma.user.create({
      data: { ...input, passwordHash: await hashPassword(password) },
      select: publicUserSelect,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) { return apiError(error); }
}
