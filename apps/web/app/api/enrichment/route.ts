import { NextResponse } from "next/server";

import { getEnrichment } from "@/lib/enrichment";

const CACHE = "public, s-maxage=300, stale-while-revalidate=600";

// Don't prerender at build (would fetch the Blob during deploy). The upstream
// fetch is still cached via the Next data cache.
export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getEnrichment();
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
