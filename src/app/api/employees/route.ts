import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { apiError, parseJson } from "@/lib/api-response";
import { employeeInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireUser();
    const employees = await getPrisma().employee.findMany({
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(employees);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const data = employeeInput.parse(await parseJson(request));
    const employee = await getPrisma().employee.create({ data });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) { return apiError(error); }
}
