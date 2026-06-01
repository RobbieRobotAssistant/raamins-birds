import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE, isValidSession } from "@/lib/admin";
import { deleteReport, reportsEnabled } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Admin-gated: discard a report without deleting any detection (e.g. it was a
// false alarm or the ID is actually fine).
export async function POST(req: NextRequest) {
  if (!isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!reportsEnabled()) {
    return NextResponse.json({ error: "reporting unavailable" }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const key = String(body.key ?? "");
  if (!key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }
  try {
    await deleteReport(key);
  } catch {
    return NextResponse.json({ error: "could not dismiss" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
