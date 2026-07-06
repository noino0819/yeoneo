import type { Arrival } from "./ggbus";
import {
  HOME_STOP,
  TRANSFER_PENALTY_MIN,
  classifyDest,
  type Destination,
} from "../constants/stops";
import { predictBoarding, expectedCommuteMin } from "./predict";

// F2+F3 조립 로직 — 라이브(/api/salmon)와 리플레이(/api/replay)가 공유하는 순수 계산

export interface BusPlan {
  routeName: string;
  eta: number;
  seats: number;
  locationNo: number | null;
  busNow: string | null;
  isDoubleDeck: boolean;
  prob: number;
  expectedSeats: number;
  reasons: string[];
  commuteMin: number;
}

export interface StopPlan {
  name: string;
  stationId: string;
  walkMin: number;
  buses: BusPlan[];
  best: BusPlan | null;
}

export interface SalmonData {
  dest: Destination;
  stops: StopPlan[];
  recommendation: (BusPlan & { stopName: string; walkMin: number }) | null;
  altViaGangnam: { commuteMin: number; routeName: string } | null;
}

export const STOP_CHAIN = [
  { name: HOME_STOP.name, stationId: HOME_STOP.stationId, walkMin: 0 },
  ...HOME_STOP.upstream.map((u) => ({
    name: u.name,
    stationId: u.stationId,
    walkMin: u.walkMin,
  })),
];

function toPlans(
  arrivals: Arrival[],
  dest: Destination,
  walkMin: number,
  hour: number,
): BusPlan[] {
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
        hour,
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

// arrivalsByStation: STOP_CHAIN 각 정류장의 도착정보. hour: 피크 판정용 (KST)
export function buildSalmon(
  arrivalsByStation: Record<string, Arrival[]>,
  dest: Destination,
  hour: number,
): SalmonData {
  const stops: StopPlan[] = STOP_CHAIN.map((s) => {
    const buses = toPlans(arrivalsByStation[s.stationId] ?? [], dest, s.walkMin, hour);
    return { ...s, buses, best: buses[0] ?? null };
  });

  const withBest = stops.filter((s) => s.best);
  const recStop = withBest.length
    ? withBest.reduce((a, b) => (a.best!.commuteMin <= b.best!.commuteMin ? a : b))
    : null;
  const recommendation = recStop
    ? { ...recStop.best!, stopName: recStop.name, walkMin: recStop.walkMin }
    : null;

  // 강북행 대안: 놓칠 확률 높으면 강남행 + 환승 기대값 (환승 소요는 정적 추정치)
  let altViaGangnam: SalmonData["altViaGangnam"] = null;
  if (dest === "gangbuk" && (!recommendation || recommendation.prob < 0.5)) {
    const gangnamBest = toPlans(
      arrivalsByStation[HOME_STOP.stationId] ?? [],
      "gangnam",
      0,
      hour,
    )[0];
    if (gangnamBest) {
      altViaGangnam = {
        commuteMin: gangnamBest.commuteMin + TRANSFER_PENALTY_MIN,
        routeName: gangnamBest.routeName,
      };
    }
  }

  return { dest, stops, recommendation, altViaGangnam };
}

export const kstHour = () => Math.floor(Date.now() / 3_600_000 + 9) % 24;
