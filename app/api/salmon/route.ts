import { NextRequest, NextResponse } from "next/server";
import { getArrivals, type Arrival } from "@/lib/ggbus";
import { buildSalmon, kstHour, STOP_CHAIN, type SalmonData } from "@/lib/salmon";
import type { Destination } from "@/constants/stops";

// F2+F3 라이브: HOME + 상류 정류장 동시 예측·비교 (연어 모드)
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
  const dest = (req.nextUrl.searchParams.get("dest") ?? "gangnam") as Destination;
  try {
    const arrivalsByStation = Object.fromEntries(
      await Promise.all(
        STOP_CHAIN.map(async (s) => [s.stationId, await cachedArrivals(s.stationId)]),
      ),
    );
    const body: SalmonResponse = {
      ...buildSalmon(arrivalsByStation, dest, kstHour()),
      generatedAt: Date.now(),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
