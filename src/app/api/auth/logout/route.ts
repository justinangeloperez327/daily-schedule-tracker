import { NextResponse } from "next/server";
import { apiError } from "@/lib/api-response";
import { destroySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
