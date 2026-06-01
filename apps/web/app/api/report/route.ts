import { NextRequest, NextResponse } from "next/server";

import { reportsEnabled, saveReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Public: a viewer flags a recording as misidentified. Stored for admin review;
// never deletes anything on its own.
export async function POST(req: NextRequest) {
  if (!reportsEnabled()) {
    return NextResponse.json({ error: "reporting unavailable" }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Honeypot: a hidden field real users never fill. If set, accept-and-drop.
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const rowid = Number(body.rowid);
  const sci = String(body.sci_name ?? "").slice(0, 120);
  const com = String(body.com_name ?? "").slice(0, 120);
  const actual = String(body.actual ?? "").slice(0, 500).trim();
  const incorrect = body.incorrect === true || body.incorrect === "yes";

  if (!Number.isFinite(rowid) || rowid < 1 || !sci) {
    return NextResponse.json({ error: "invalid report" }, { status: 400 });
  }

  try {
    await saveReport({
      rowid: Math.trunc(rowid),
      sci_name: sci,
      com_name: com,
      incorrect,
      actual,
    });
  } catch {
    return NextResponse.json({ error: "could not save report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
