import { NextRequest, NextResponse } from "next/server";
import { getStationRoutes } from "@/lib/ggbus";
import { classifyDest, HOME_STOP, type Destination } from "@/constants/stops";

export interface TaggedRoute {
  routeId: string;
  routeName: string;
  destName: string;
  typeName: string;
  dest: Destination;
}

// 노선 구성은 하루 안에 안 바뀜 — 1시간 캐시
const cache = new Map<string, { at: number; data: TaggedRoute[] }>();
const TTL = 3_600_000;

export async function GET(req: NextRequest) {
  const stationId =
    req.nextUrl.searchParams.get("stationId") ?? HOME_STOP.stationId;
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ routes: hit.data, cachedAt: hit.at });
  }
  try {
    const raw = await getStationRoutes(stationId);
    const routes = raw.flatMap((r): TaggedRoute[] => {
      const destName = String(r.routeDestName ?? "");
      const dest = classifyDest(destName);
      if (!dest) return [];
      return [
        {
          routeId: String(r.routeId),
          routeName: String(r.routeName),
          destName,
          typeName: String(r.routeTypeName ?? ""),
          dest,
        },
      ];
    });
    if (cache.size >= 500) cache.clear(); // 무한 증식 방지
    cache.set(stationId, { at: Date.now(), data: routes });
    return NextResponse.json({ routes, cachedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
