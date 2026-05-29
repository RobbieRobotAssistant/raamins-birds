import { NextRequest, NextResponse } from "next/server";

import { getByPeriod } from "@/lib/api";
import { parseWindow } from "@/lib/params";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const window = parseWindow(req.nextUrl.searchParams.get("window"));
  const data = await getByPeriod(window);
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
