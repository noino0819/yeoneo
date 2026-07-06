import { NextRequest, NextResponse } from "next/server";
import { getArrivals, type Arrival } from "@/lib/ggbus";
import {
  HOME_STOP,
  TRANSFER_PENALTY_MIN,
  classifyDest,
  type Destination,
} from "@/constants/stops";
import { predictBoarding, expectedCommuteMin } from "@/lib/predict";

// F2+F3: HOME + 상류 정류장 동시 예측·비교 (연어 모드)

export interface BusPlan {
  routeName: string;
  eta: number; // 도착까지 분
  seats: number;
  locationNo: number | null;
  busNow: string | null; // 버스 현재 위치 정류장명
  isDoubleDeck: boolean;
  prob: number; // 탑승 확률 0~1
  expectedSeats: number;
  reasons: string[];
  commuteMin: number; // 도보 + 기대 대기
}

export interface StopPlan {
  name: string;
  stationId: string;
  walkMin: number;
  buses: BusPlan[];
  best: BusPlan | null;
}

export interface SalmonResponse {
  dest: Destination;
  stops: StopPlan[];
  recommendation: (BusPlan & { stopName: string; walkMin: number }) | null;
  altViaGangnam: { commuteMin: number; routeName: string } | null;
  generatedAt: number;
}

const cache = new Map<string, { at: number; data: Arrival[] }>();
const TTL = 15_000;

async function cachedArrivals(stationId: string): Promise<Arrival[]> {
  const hit = cache.get(stationId);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  const data = await getArrivals(stationId);
  cache.set(stationId, { at: Date.now(), data });
  return data;
}

// Vercel 서버는 UTC — KST 시각으로 피크 판정
const kstHour = () => Math.floor(Date.now() / 3_600_000 + 9) % 24;

function toPlans(arrivals: Arrival[], dest: Destination, walkMin: number): BusPlan[] {
  return arrivals
    .filter(
      (a) =>
        classifyDest(a.routeDestName) === dest &&
        a.predictTime1 !== null &&
        (a.remainSeatCnt1 ?? -1) >= 0,
    )
    .map((a) => {
      const headway =
        a.predictTime2 !== null
          ? Math.max(a.predictTime2 - a.predictTime1!, 3)
          : 15; // 다음 차 정보 없으면 15분 근사
      const isDoubleDeck = a.lowPlate1 === 2;
      const p = predictBoarding({
        remainSeats: a.remainSeatCnt1!,
        upstreamStopCount: a.locationNo1 ?? 3,
        hour: kstHour(),
        headwayMin: headway,
        recentSamePassCount: 0,
        isDoubleDeck,
      });
      return {
        routeName: a.routeName,
        eta: a.predictTime1!,
        seats: a.remainSeatCnt1!,
        locationNo: a.locationNo1,
        busNow: a.stationNm1,
        isDoubleDeck,
        prob: p.boardingProbability,
        expectedSeats: p.expectedSeats,
        reasons: p.reasons,
        commuteMin: expectedCommuteMin(walkMin, p.boardingProbability, headway),
      };
    })
    .sort((x, y) => x.commuteMin - y.commuteMin);
}

export async function GET(req: NextRequest) {
  const dest = (req.nextUrl.searchParams.get("dest") ?? "gangnam") as Destination;
  const chain = [
    { name: HOME_STOP.name, stationId: HOME_STOP.stationId, walkMin: 0 },
    ...HOME_STOP.upstream.map((u) => ({
      name: u.name,
      stationId: u.stationId,
      walkMin: u.walkMin,
    })),
  ];
  try {
    const stops: StopPlan[] = await Promise.all(
      chain.map(async (s) => {
        const buses = toPlans(await cachedArrivals(s.stationId), dest, s.walkMin);
        return { ...s, buses, best: buses[0] ?? null };
      }),
    );

    const withBest = stops.filter((s) => s.best);
    const recStop = withBest.length
      ? withBest.reduce((a, b) => (a.best!.commuteMin <= b.best!.commuteMin ? a : b))
      : null;
    const recommendation = recStop
      ? { ...recStop.best!, stopName: recStop.name, walkMin: recStop.walkMin }
      : null;

    // 강북행 대안: 놓칠 확률이 높으면 강남행 + 환승 기대값 제시 (환승 소요는 정적 추정치)
    let altViaGangnam: SalmonResponse["altViaGangnam"] = null;
    if (dest === "gangbuk" && (!recommendation || recommendation.prob < 0.5)) {
      const gangnamBest = toPlans(
        await cachedArrivals(HOME_STOP.stationId),
        "gangnam",
        0,
      )[0];
      if (gangnamBest) {
        altViaGangnam = {
          commuteMin: gangnamBest.commuteMin + TRANSFER_PENALTY_MIN,
          routeName: gangnamBest.routeName,
        };
      }
    }

    const body: SalmonResponse = {
      dest,
      stops,
      recommendation,
      altViaGangnam,
      generatedAt: Date.now(),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
