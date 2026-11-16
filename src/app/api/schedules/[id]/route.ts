import { NextResponse } from "next/server";

// The legacy per-job endpoints have been superseded by date-level schedule sheets.
export function GET() {
  return NextResponse.json({ error: "Use /api/schedule-sheets for the new schedule register." }, { status: 410 });
}
export function POST() { return GET(); }
export function PUT() { return GET(); }
export function DELETE() { return GET(); }
