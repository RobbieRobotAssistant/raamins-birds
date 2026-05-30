import { NextRequest, NextResponse } from "next/server";

import { getTopSpecies } from "@/lib/api";
import { parseWindow } from "@/lib/params";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const window = parseWindow(req.nextUrl.searchParams.get("window"));
  // Honor an explicit ?limit= (collage wants all species; Stats omits it → 10).
  // Note: a missing param is null, and Number(null) === 0, so check for absence
  // explicitly rather than relying on isFinite. Clamped to the Pi range (1..100).
  const limitParam = req.nextUrl.searchParams.get("limit");
  const parsed = limitParam === null ? 10 : Number(limitParam);
  const limit =
    Number.isFinite(parsed) && parsed >= 1 ? Math.min(100, Math.trunc(parsed)) : 10;
  const data = await getTopSpecies(window, limit);
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
