import { NextRequest, NextResponse } from "next/server";

import { AUDIO_REVALIDATE, BIRD_API_URL, USE_MOCKS } from "@/lib/config";

// Proxy + cache audio clips. Tradeoff: clips flow through Vercel (counts
// against Vercel bandwidth) instead of visitors hitting the tunnel directly.
// Upside: the Pi/tunnel is never exposed to public traffic, and Vercel's CDN
// edge-caches each immutable clip after the first request.
export async function GET(
  _req: NextRequest,
  { params }: { params: { rowid: string } }
) {
  const { rowid } = params;
  if (!/^\d+$/.test(rowid)) {
    return new NextResponse("bad id", { status: 400 });
  }
  if (USE_MOCKS) {
    // No Pi to proxy in mock mode; clips only exist on the live device.
    return new NextResponse("audio unavailable in mock mode", { status: 404 });
  }

  const upstream = await fetch(`${BIRD_API_URL}/api/recordings/${rowid}`, {
    next: { revalidate: AUDIO_REVALIDATE },
  });
  if (!upstream.ok || !upstream.body) {
    return new NextResponse("clip not found", {
      status: upstream.status || 404,
    });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
