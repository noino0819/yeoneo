import { NextRequest, NextResponse } from "next/server";
import { searchStations } from "@/lib/ggbus";

// 정류장 키워드 검색 — 출발/도착 정류장 선택용
export interface StationHit {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
  region: string;
  mobileNo: string; // 정류소 고유번호 (동명 정류장 구분용)
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json({ stations: [] });
  try {
    const raw = await searchStations(q);
    const stations: StationHit[] = raw.slice(0, 30).map((s) => ({
      stationId: String(s.stationId),
      name: String(s.stationName ?? ""),
      lat: Number(s.y),
      lng: Number(s.x),
      region: String(s.regionName ?? ""),
      mobileNo: s.mobileNo ? String(s.mobileNo) : "",
    }));
    return NextResponse.json({ stations });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
