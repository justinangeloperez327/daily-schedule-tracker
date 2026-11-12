import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { projectInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const projects = await getPrisma().project.findMany({
      orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(projects);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const data = projectInput.parse(await parseJson(request));
    const project = await getPrisma().project.create({ data });
    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
