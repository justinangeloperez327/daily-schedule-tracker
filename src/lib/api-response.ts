import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { ZodError } from "zod";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Invalid request." },
      { status: 400 }
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "This record is in use by a schedule. Remove those assignments before deleting it." },
        { status: 409 }
      );
    }
    if (error.code === "P2025") {
      return NextResponse.json({ error: "Record not found." }, { status: 404 });
    }
    if (error.code === "P2002") {
      return NextResponse.json({ error: "A record with this value already exists." }, { status: 409 });
    }
  }
  console.error("Schedule API error:", error);
  return NextResponse.json({ error: "Request failed. Check database configuration and try again." }, { status: 500 });
}

export async function parseJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}
