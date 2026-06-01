import { NextRequest, NextResponse } from "next/server";

import { ADMIN_COOKIE, isValidSession } from "@/lib/admin";
import { BIRD_API_URL } from "@/lib/config";
import { deleteReport } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Admin-gated: delete a detection at the source (via the Pi -> BirdNET-Pi),
// then remove the report.
export async function POST(req: NextRequest) {
  if (!isValidSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.MODERATION_TOKEN || "";
  if (!BIRD_API_URL || !token) {
    return NextResponse.json(
      { error: "moderation not configured (BIRD_API_URL / MODERATION_TOKEN)" },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const rowid = Number(body.rowid);
  const key = String(body.key ?? "");
  if (!Number.isFinite(rowid) || rowid < 1) {
    return NextResponse.json({ error: "invalid rowid" }, { status: 400 });
  }

  const res = await fetch(
    `${BIRD_API_URL}/api/moderate/delete/${Math.trunc(rowid)}`,
    {
      method: "POST",
      headers: { "x-moderation-token": token },
      cache: "no-store",
    }
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `source delete failed (${res.status})`, detail: detail.slice(0, 300) },
      { status: 502 }
    );
  }

  if (key) {
    try {
      await deleteReport(key);
    } catch {
      /* detection is gone; a leftover report blob is harmless */
    }
  }
  return NextResponse.json({ ok: true });
}
