import { NextRequest, NextResponse } from "next/server";
import { getBusLocations } from "@/lib/ggbus";

const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 15_000;

export async function GET(req: NextRequest) {
  const routeId = req.nextUrl.searchParams.get("routeId");
  if (!routeId) {
    return NextResponse.json({ error: "routeId 필요" }, { status: 400 });
  }
  const hit = cache.get(routeId);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ vehicles: hit.data, cachedAt: hit.at });
  }
  try {
    const vehicles = await getBusLocations(routeId);
    cache.set(routeId, { at: Date.now(), data: vehicles });
    return NextResponse.json({ vehicles, cachedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
