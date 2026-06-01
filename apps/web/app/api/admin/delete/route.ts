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

  // The Pi returns 404 "no detection {rowid}" when the detection is already
  // gone — e.g. two people reported the same recording and the first delete
  // already removed it. That's the desired end state, not a failure, so we
  // treat it as success and just clear this leftover report.
  const detail = !res.ok ? await res.text().catch(() => "") : "";
  const alreadyGone = res.status === 404 && /no detection/i.test(detail);
  if (!res.ok && !alreadyGone) {
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

  const note = alreadyGone
    ? "this detection was already deleted. it'll drop off the public site within a couple of minutes as the cache refreshes."
    : "detection deleted. it'll disappear from the public site within a couple of minutes as the cache refreshes.";
  return NextResponse.json({ ok: true, note });
}
