import { NextRequest, NextResponse } from "next/server";
import { getArrivals } from "@/lib/ggbus";
import { HOME_STOP } from "@/constants/stops";

// ponytail: 모듈 스코프 캐시 — 서버리스 웜 인스턴스 단위. 트래픽 늘면 KV로
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 15_000;

export async function GET(req: NextRequest) {
  const stationId =
    req.nextUrl.searchParams.get("stationId") ?? HOME_STOP.stationId;
  if (stationId === "TBD") {
    return NextResponse.json(
      { error: "stationId 미확정 (constants/stops.ts)" },
      { status: 503 },
    );
  }
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ arrivals: hit.data, cachedAt: hit.at });
  }
  try {
    const arrivals = await getArrivals(stationId);
    cache.set(stationId, { at: Date.now(), data: arrivals });
    return NextResponse.json({ arrivals, cachedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
