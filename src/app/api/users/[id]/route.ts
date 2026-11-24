import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { userUpdateInput } from "@/lib/validation";
import { publicUserSelect } from "@/lib/user-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const { password, ...input } = userUpdateInput.parse(await parseJson(request));
    if (id === admin.id && (input.active === false || input.role === "user")) {
      return NextResponse.json({ error: "You cannot deactivate or demote your own account." }, { status: 400 });
    }
    const prisma = getPrisma();
    const user = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: { ...input, ...(password ? { passwordHash: await hashPassword(password) } : {}) },
        select: publicUserSelect,
      });
      // Sign the user out everywhere when their password changes or they are deactivated.
      if (password || input.active === false) await tx.session.deleteMany({ where: { userId: id } });
      return updated;
    });
    return NextResponse.json(user);
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const admin = await requireAdmin();
    const { id } = await context.params;
    if (id === admin.id) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }
    await getPrisma().user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
