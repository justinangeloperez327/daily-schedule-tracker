import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { apiError, parseJson } from "@/lib/api-response";
import { trackerInitInput } from "@/lib/project-tracker-validation";
import {
  trackerInitialItems, trackerItemCode, trackerItemLabel, trackerTypeForProject,
} from "@/lib/project-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireUser();
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) return NextResponse.json({ error: "Select a project." }, { status: 400 });
    const prisma = getPrisma();
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, jobNo: true, clientName: true, mainCategory: true, subCategory: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const trackerType = trackerTypeForProject(project);
    const items = await prisma.projectTrackerItem.findMany({
      where: { projectId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({ project, trackerType, items });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    await requireUser();
    const input = trackerInitInput.parse(await parseJson(request));
    const prisma = getPrisma();
    const project = await prisma.project.findUnique({
      where: { id: input.projectId },
      select: { id: true, mainCategory: true, subCategory: true },
    });
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const trackerType = trackerTypeForProject(project);
    if (!trackerType) {
      return NextResponse.json({
        error: "Set the project's Subcategory to Substation, Bus Shelter or Guardrail to use this tracker.",
      }, { status: 400 });
    }

    if (trackerType === "substation") {
      // Repeat initialization is idempotent; existing dates/remarks are not overwritten.
      await prisma.projectTrackerItem.createMany({
        data: trackerInitialItems(trackerType).map((item) => ({
          ...item, projectId: project.id, trackerType,
        })),
        skipDuplicates: true,
      });
    } else {
      const existing = await prisma.projectTrackerItem.findMany({
        where: { projectId: project.id, trackerType },
        select: { code: true, sortOrder: true },
      });
      const codeNumbers = existing.map(({ code }) => Number(code.split("-").at(-1)))
        .filter((number) => Number.isInteger(number));
      const highest = Math.max(0, ...codeNumbers);
      const start = highest + 1;
      await prisma.projectTrackerItem.createMany({
        data: Array.from({ length: input.count }, (_, index) => {
          const sequence = start + index;
          return {
            projectId: project.id,
            trackerType,
            code: trackerItemCode(trackerType, sequence),
            label: trackerItemLabel(trackerType, sequence),
            sortOrder: sequence,
          };
        }),
        skipDuplicates: true,
      });
    }
    const items = await prisma.projectTrackerItem.findMany({
      where: { projectId: input.projectId },
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    });
    return NextResponse.json({ trackerType, items }, { status: 201 });
  } catch (error) { return apiError(error); }
}
