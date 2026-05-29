import { NextRequest, NextResponse } from "next/server";

import { getTopSpecies } from "@/lib/api";
import { parseWindow } from "@/lib/params";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const window = parseWindow(req.nextUrl.searchParams.get("window"));
  // Honor an explicit ?limit= (collage wants all species; Stats omits it → 10).
  // Clamped to the Pi API's accepted range (1..100).
  const raw = Number(req.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(raw)
    ? Math.min(100, Math.max(1, Math.trunc(raw)))
    : 10;
  const data = await getTopSpecies(window, limit);
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
