import { NextRequest, NextResponse } from "next/server";

import { getSpeciesDetail } from "@/lib/api";
import { parseWindow } from "@/lib/params";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const sci = req.nextUrl.searchParams.get("sci");
  if (!sci) {
    return NextResponse.json({ error: "missing sci" }, { status: 400 });
  }
  const window = parseWindow(req.nextUrl.searchParams.get("window"));
  const data = await getSpeciesDetail(sci, window);
  if (!data) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
