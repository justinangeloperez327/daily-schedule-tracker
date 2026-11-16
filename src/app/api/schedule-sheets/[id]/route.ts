import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { apiError, parseJson } from "@/lib/api-response";
import { scheduleSheetInput } from "@/lib/validation";
import { sheetDto, sheetInclude } from "@/lib/schedule-sheet-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const sheet = await getPrisma().scheduleSheet.findUnique({ where: { id }, include: sheetInclude });
    if (!sheet) return NextResponse.json({ error: "Schedule not found." }, { status: 404 });
    return NextResponse.json(sheetDto(sheet));
  } catch (error) { return apiError(error); }
}

export async function PUT(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const data = scheduleSheetInput.parse(await parseJson(request));
    const prisma = getPrisma();
    const sheet = await prisma.$transaction(async (tx) => {
      const existing = await tx.schedule.findMany({ where: { sheetId: id }, select: { id: true } });
      const existingIds = new Set(existing.map((entry) => entry.id));
      const keptIds = data.dispatches.flatMap((entry) => entry.id ? [entry.id] : []);
      if (keptIds.some((key) => !existingIds.has(key))) {
        throw new Error("Invalid dispatch row identifier.");
      }

      await tx.scheduleSheet.update({ where: { id }, data: { date: data.date } });
      await tx.schedule.deleteMany({ where: { sheetId: id, id: { notIn: keptIds } } });

      for (const [index, entry] of data.dispatches.entries()) {
        const fields = {
          date: data.date,
          sortOrder: index,
          shift: entry.shift,
          scope: entry.scope,
          campStart: entry.campStart,
          timeIn: entry.timeIn,
          timeOut: entry.timeOut,
          projectId: entry.projectId,
        };

        if (entry.id) {
          await tx.schedule.update({
            where: { id: entry.id },
            data: {
              ...fields,
              employees: {
                deleteMany: {},
                create: entry.employeeIds.map((employeeId) => ({ employeeId })),
              },
              foremen: {
                deleteMany: {},
                create: entry.foremanIds.map((employeeId) => ({ employeeId })),
              },
              equipments: {
                deleteMany: {},
                create: entry.equipmentIds.map((equipmentId) => ({ equipmentId })),
              },
            },
          });
        } else {
          await tx.schedule.create({
            data: {
              ...fields,
              sheetId: id,
              jobNo: "",
              employees: { create: entry.employeeIds.map((employeeId) => ({ employeeId })) },
              foremen: { create: entry.foremanIds.map((employeeId) => ({ employeeId })) },
              equipments: { create: entry.equipmentIds.map((equipmentId) => ({ equipmentId })) },
            },
          });
        }
      }

      return tx.scheduleSheet.findUniqueOrThrow({ where: { id }, include: sheetInclude });
    });
    return NextResponse.json(sheetDto(sheet));
  } catch (error) { return apiError(error); }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    await getPrisma().scheduleSheet.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
