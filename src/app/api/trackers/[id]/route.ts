import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { apiError, parseJson } from "@/lib/api-response";
import { trackerItemUpdateInput } from "@/lib/project-tracker-validation";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const changes = trackerItemUpdateInput.parse(await parseJson(request));
    const item = await getPrisma().projectTrackerItem.update({ where: { id }, data: changes });
    return NextResponse.json(item);
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    await requireUser();
    const { id } = await context.params;
    const prisma = getPrisma();
    const item = await prisma.projectTrackerItem.findUnique({
      where: { id }, select: { id: true, trackerType: true },
    });
    if (!item) return NextResponse.json({ error: "Tracker item not found." }, { status: 404 });
    if (item.trackerType === "substation") {
      return NextResponse.json({ error: "Substation has four fixed components. They cannot be deleted." }, { status: 400 });
    }
    await prisma.projectTrackerItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
