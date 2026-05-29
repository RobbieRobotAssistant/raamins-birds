import { NextRequest, NextResponse } from "next/server";

import { getLifeList } from "@/lib/api";
import { parseSort } from "@/lib/params";

const CACHE = "public, s-maxage=60, stale-while-revalidate=120";

export async function GET(req: NextRequest) {
  const sort = parseSort(req.nextUrl.searchParams.get("sort"));
  const data = await getLifeList(sort);
  return NextResponse.json(data, { headers: { "Cache-Control": CACHE } });
}
