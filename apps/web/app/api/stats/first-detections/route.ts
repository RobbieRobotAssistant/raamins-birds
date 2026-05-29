import { NextResponse } from "next/server";

import { getFirstDetections } from "@/lib/api";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

// Don't prerender at build (would fetch the Pi during deploy). The upstream
// fetch is still cached via the Next data cache, so the Pi stays protected.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getFirstDetections(20);
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
