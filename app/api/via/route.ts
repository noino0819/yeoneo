import { NextRequest, NextResponse } from "next/server";
import { getRouteStations, getStationRoutes } from "@/lib/ggbus";
import { haversineMeters } from "@/lib/walk";
import { classifyDest } from "@/constants/stops";

// 출발 정류장의 각 노선이 도착 정류장을 경유하는지 판정.
// GBIS는 같은 물리 정류장을 노선/지역마다 다른 stationId로 등록하기도 해서
// stationId 일치 + 좌표 근접(250m)으로 매칭하고, 노선별 실제 도착 stationId를 돌려준다
// (도착예정 조회 = 승차시간 계산에 그 id가 필요).
export interface ViaInfo {
  stationId: string; // 해당 노선의 도착 정류장 stationId
  km: number; // 출발→도착 경로 거리 (정류장 좌표 폴리라인 근사)
}
export interface ViaResponse {
  via: Record<string, ViaInfo>; // routeId → 경유 정보
}

const NEAR_M = 250;
const cache = new Map<string, { at: number; via: Record<string, ViaInfo> }>();
const TTL = 3_600_000;

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const originId = q.get("originId");
  const destId = q.get("destId");
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  if (!originId || !destId || !lat || !lng) {
    return NextResponse.json({ error: "originId, destId, lat, lng 필요" }, { status: 400 });
  }
  const key = `${originId}:${destId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ via: hit.via } satisfies ViaResponse);
  }
  try {
    const routes = (await getStationRoutes(originId)).filter(
      (r) => classifyDest(String(r.routeDestName ?? "")) !== null,
    );
    const via: Record<string, ViaInfo> = {};
    await Promise.all(
      routes.slice(0, 16).map(async (r) => {
        const routeId = String(r.routeId);
        try {
          const sts = await getRouteStations(routeId);
          const oi = sts.findIndex((s) => String(s.stationId) === originId);
          if (oi < 0) return;
          const mi = sts.slice(oi + 1).findIndex(
            (s) =>
              String(s.stationId) === destId ||
              haversineMeters({ lat: Number(s.y), lng: Number(s.x) }, { lat, lng }) <
                NEAR_M,
          );
          if (mi >= 0) {
            const di = oi + 1 + mi;
            const pts = sts.map((s) => ({ lat: Number(s.y), lng: Number(s.x) }));
            let km = 0;
            for (let i = oi; i < di; i++) km += haversineMeters(pts[i], pts[i + 1]);
            via[routeId] = {
              stationId: String(sts[di].stationId),
              km: Math.round((km / 1000) * 10) / 10,
            };
          }
        } catch {
          // 노선 하나 실패는 무시
        }
      }),
    );
    cache.set(key, { at: Date.now(), via });
    return NextResponse.json({ via } satisfies ViaResponse);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
