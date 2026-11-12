import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { equipmentInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const equipments = await getPrisma().equipment.findMany({
      orderBy: [{ vehicleDetails: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(equipments);
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const data = equipmentInput.parse(await parseJson(request));
    const equipment = await getPrisma().equipment.create({ data });
    return NextResponse.json(equipment, { status: 201 });
  } catch (error) { return apiError(error); }
}
