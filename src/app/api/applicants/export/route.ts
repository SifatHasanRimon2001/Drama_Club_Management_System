import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";

function sanitizeCsvValue(value: string): string {
  // Prevent CSV formula injection by prefixing dangerous characters
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value;
  }
  return value;
}

function escapeCsv(value: string): string {
  const sanitized = sanitizeCsvValue(value);
  if (sanitized.includes('"') || sanitized.includes(',') || sanitized.includes('\n')) {
    return '"' + sanitized.replace(/"/g, '""') + '"';
  }
  return sanitized;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("registration.review");
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const windowId = url.searchParams.get("windowId");

    if (!windowId) {
      return NextResponse.json(
        { error: "windowId query param is required" },
        { status: 400 }
      );
    }

    const applicants = await prisma.applicant.findMany({
      where: { registrationWindowId: windowId },
      orderBy: { createdAt: "desc" },
    });

    // Build CSV
    const headers = [
      "Name",
      "Email",
      "Phone",
      "Student ID",
      "Department Preferences",
      "Skills",
      "Acting Experience",
      "Portfolio URL",
      "Status",
      "Applied At",
    ];

    const rows = applicants.map((a) => [
      a.name,
      a.email,
      a.phone,
      a.studentId,
      (a.departmentPrefs || []).join("; "),
      (a.skills || []).join("; "),
      a.actingExperience || "",
      a.portfolioUrl || "",
      a.status,
      a.createdAt.toISOString(),
    ]);

    const csvLines = [headers.join(",")];
    for (const r of rows) {
      csvLines.push(r.map(escapeCsv).join(","));
    }
    const csv = csvLines.join("\n");

    await logAudit({
      actorId: auth.userId,
      action: "applicant.exported",
      entityType: "Applicant",
      entityId: windowId,
      metadata: { count: applicants.length, windowId },
    });

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="applicants-${windowId.replace(/[^a-zA-Z0-9-]/g, "")}.csv"`,
      },
    });
  } catch (error) {
    console.error("[Applicants Export GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
