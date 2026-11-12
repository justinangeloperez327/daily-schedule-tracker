import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { DatabaseConfigurationError } from "@/lib/prisma";
import { ZodError } from "zod";

function databaseError(message: string, status = 503) {
  return NextResponse.json({ error: message }, { status });
}

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message || "Invalid request." },
      { status: 400 }
    );
  }

  if (error instanceof DatabaseConfigurationError) {
    console.error("Database setup error: DATABASE_URL is missing.");
    return databaseError(
      "Database is not configured. Set DATABASE_URL in the server environment and restart or redeploy."
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

  // Prisma and PostgreSQL adapter errors can have different shapes.
  // Only return predefined messages. Never disclose hostnames, passwords or connection strings.
  const code = errorCode(error);
  const message = error instanceof Error ? error.message : "";
  console.error("Schedule API error:", error);

  if (["P2021", "P2022", "P1014", "42P01", "42703"].includes(code) ||
      /relation .* does not exist|column .* does not exist/i.test(message)) {
    return databaseError(
      "Database tables are missing or outdated. Apply the Prisma migrations with npm run db:deploy.",
      500
    );
  }

  if (["P1000", "28P01"].includes(code) || /password authentication failed/i.test(message)) {
    return databaseError(
      "PostgreSQL rejected the database credentials. Check the username and password in DATABASE_URL."
    );
  }

  if (["P1003", "3D000"].includes(code) || /database .* does not exist/i.test(message)) {
    return databaseError(
      "The configured PostgreSQL database does not exist. Check the database name in DATABASE_URL."
    );
  }

  if (["P1001", "P1002", "P1017", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT", "EAI_AGAIN", "ENETUNREACH"].includes(code) ||
      /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|getaddrinfo/i.test(message)) {
    return databaseError(
      "Cannot connect to PostgreSQL. Check the database host, port, network access and DATABASE_URL."
    );
  }

  return NextResponse.json(
    { error: "Server request failed. Check the server logs for the cause." },
    { status: 500 }
  );
}

export async function parseJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}
