import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError } from "@/lib/api-response";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Marks everything up to now as read for the signed-in user.
export async function POST() {
  try {
    const user = await requireUser();
    await getPrisma().user.update({ where: { id: user.id }, data: { notificationsSeenAt: new Date() } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
