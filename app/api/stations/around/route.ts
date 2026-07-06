import { NextRequest, NextResponse } from "next/server";
import { getStationsAround } from "@/lib/ggbus";
import type { StationHit } from "@/app/api/stations/route";

// 핀 좌표 주변 정류소 — 지도 픽커용. 거리 계산·정렬은 클라이언트(walkMinutes)에서.
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");
  if (!lat || !lng) return NextResponse.json({ stations: [] });
  try {
    const raw = await getStationsAround(lng, lat);
    const stations: StationHit[] = raw.slice(0, 15).map((s) => ({
      stationId: String(s.stationId),
      name: String(s.stationName ?? ""),
      lat: Number(s.y),
      lng: Number(s.x),
      region: String(s.regionName ?? ""),
      mobileNo: s.mobileNo ? String(s.mobileNo).trim() : "",
    }));
    return NextResponse.json({ stations });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
