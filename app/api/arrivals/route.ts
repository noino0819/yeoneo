import { NextRequest, NextResponse } from "next/server";
import { getArrivalsCached } from "@/lib/ggbus";
import { HOME_STOP } from "@/constants/stops";

// 캐시는 ggbus.getArrivalsCached 공용 (salmon과 공유) — 서버리스 웜 인스턴스 단위
export async function GET(req: NextRequest) {
  const stationId =
    req.nextUrl.searchParams.get("stationId") ?? HOME_STOP.stationId;
  if (stationId === "TBD") {
    return NextResponse.json(
      { error: "stationId 미확정 (constants/stops.ts)" },
      { status: 503 },
    );
  }
  try {
    const arrivals = await getArrivalsCached(stationId);
    return NextResponse.json({ arrivals, cachedAt: Date.now() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
