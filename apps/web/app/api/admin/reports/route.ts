import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE, isValidSession } from "@/lib/admin";
import { listReports, reportsEnabled } from "@/lib/reports";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!reportsEnabled()) {
    return NextResponse.json({ reports: [] });
  }
  const reports = await listReports();
  return NextResponse.json({ reports });
}
