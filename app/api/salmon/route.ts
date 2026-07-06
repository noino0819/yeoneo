import { NextRequest, NextResponse } from "next/server";
import { getArrivals, type Arrival } from "@/lib/ggbus";
import { buildSalmon, chainForStation, kstHour, type SalmonData } from "@/lib/salmon";
import { HOME_STOP, type Destination } from "@/constants/stops";

// F2+F3 라이브: 출발 정류장 + 상류 정류장 동시 예측·비교 (연어 모드)
export type SalmonResponse = SalmonData & { generatedAt: number };

const cache = new Map<string, { at: number; data: Arrival[] }>();
const TTL = 15_000;

async function cachedArrivals(stationId: string): Promise<Arrival[]> {
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await getArrivals(stationId);
  cache.set(stationId, { at: Date.now(), data });
  return data;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const dest = (q.get("dest") ?? "gangnam") as Destination;
  const origin = {
    stationId: q.get("stationId") ?? HOME_STOP.stationId,
    name: q.get("name") ?? HOME_STOP.name,
    lat: Number(q.get("lat")) || HOME_STOP.lat,
    lng: Number(q.get("lng")) || HOME_STOP.lng,
  };
  try {
    const chain = await chainForStation(origin, dest);
    const arrivalsByStation = Object.fromEntries(
      await Promise.all(
        chain.map(async (s) => [s.stationId, await cachedArrivals(s.stationId)]),
      ),
    );
    const body: SalmonResponse = {
      ...buildSalmon(chain, arrivalsByStation, dest, kstHour()),
      generatedAt: Date.now(),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
