import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { createSession, hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { profileUpdateInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await requireUser());
  } catch (error) { return apiError(error); }
}

// Update your own name and/or password.
export async function PUT(request: Request) {
  try {
    const user = await requireUser();
    const input = profileUpdateInput.parse(await parseJson(request));
    const prisma = getPrisma();
    if (input.newPassword) {
      const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
      if (!(await verifyPassword(input.currentPassword ?? "", account.passwordHash))) {
        return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
      }
    }
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.newPassword ? { passwordHash: await hashPassword(input.newPassword) } : {}),
      },
      select: { id: true, username: true, name: true, role: true },
    });
    if (input.newPassword) {
      // Sign out every other device, then keep this one signed in with a fresh session.
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await createSession(user.id);
    }
    return NextResponse.json(updated);
  } catch (error) { return apiError(error); }
}
