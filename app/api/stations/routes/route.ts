import { NextRequest, NextResponse } from "next/server";
import { getStationRoutes } from "@/lib/ggbus";

// 정류소 경유노선 + 종점 방면 — 지도 픽커에서 상·하행(건너편) 정류장 구분용
export interface StationRouteHit {
  name: string; // 노선번호
  dest: string; // 종점명 (방면)
}

const cache = new Map<string, { at: number; data: StationRouteHit[] }>();
const TTL = 3_600_000; // 노선 구성은 잘 안 바뀜

export async function GET(req: NextRequest) {
  const stationId = req.nextUrl.searchParams.get("stationId");
  if (!stationId) return NextResponse.json({ routes: [] });
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ routes: hit.data });
  }
  try {
    const raw = await getStationRoutes(stationId);
    const routes: StationRouteHit[] = raw.slice(0, 12).map((r) => ({
      name: String(r.routeName ?? ""),
      dest: String(r.routeDestName ?? ""),
    }));
    cache.set(stationId, { at: Date.now(), data: routes });
    return NextResponse.json({ routes });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
