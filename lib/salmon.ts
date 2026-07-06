import { getRouteStations, getStationRoutes, type Arrival } from "./ggbus";
import {
  HOME_STOP,
  TRANSFER_PENALTY_MIN,
  classifyDest,
  type Destination,
} from "../constants/stops";
import { predictBoarding, expectedCommuteMin } from "./predict";
import { walkMinutes } from "./walk";

// F2+F3 조립 로직 — 라이브(/api/salmon)와 리플레이(/api/replay)가 공유하는 계산

export interface BusPlan {
  routeName: string;
  eta: number;
  seats: number;
  locationNo: number | null;
  busNow: string | null;
  isDoubleDeck: boolean;
  prob: number;
  expectedSeats: number;
  sigma: number;
  reasons: string[];
  commuteMin: number;
}

export interface ChainStop {
  name: string;
  stationId: string;
  walkMin: number;
  lat: number;
  lng: number;
}

export interface StopPlan extends ChainStop {
  buses: BusPlan[];
  best: BusPlan | null;
}

export interface SalmonData {
  dest: Destination;
  stops: StopPlan[];
  recommendation: (BusPlan & { stopName: string; walkMin: number }) | null;
  altViaGangnam: { commuteMin: number; routeName: string } | null;
}

export const STOP_CHAIN: ChainStop[] = [
  {
    name: HOME_STOP.name,
    stationId: HOME_STOP.stationId,
    walkMin: 0,
    lat: HOME_STOP.lat,
    lng: HOME_STOP.lng,
  },
  ...HOME_STOP.upstream.map((u) => ({
    name: u.name,
    stationId: u.stationId,
    walkMin: u.walkMin,
    lat: u.lat,
    lng: u.lng,
  })),
];

const MAX_UPSTREAM_WALK_MIN = 25;
const chainCache = new Map<string, { at: number; chain: ChainStop[] }>();

// 임의 출발 정류장의 상류 체인: 해당 방면 첫 노선의 경유목록에서 직전 정차 1~2개.
// ponytail: 노선 1개 기준 근사 — 노선별 상류가 갈리면 노선 교집합으로 개선.
export async function chainForStation(
  origin: { stationId: string; name: string; lat: number; lng: number },
  dest: Destination,
): Promise<ChainStop[]> {
  if (origin.stationId === HOME_STOP.stationId) return STOP_CHAIN; // 실측 프리셋
  const key = `${origin.stationId}:${dest}`;
  const hit = chainCache.get(key);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.chain;

  const chain: ChainStop[] = [
    {
      stationId: origin.stationId,
      name: origin.name,
      walkMin: 0,
      lat: origin.lat,
      lng: origin.lng,
    },
  ];
  try {
    const routes = await getStationRoutes(origin.stationId);
    const route = routes.find(
      (r) => classifyDest(String(r.routeDestName ?? "")) === dest,
    );
    if (route) {
      const sts = await getRouteStations(String(route.routeId));
      const idx = sts.findIndex((s) => String(s.stationId) === origin.stationId);
      for (let i = idx - 1; i >= 0 && i >= idx - 2; i--) {
        const lat = Number(sts[i].y);
        const lng = Number(sts[i].x);
        if (!lat || !lng) continue;
        const walk = walkMinutes({ lat: origin.lat, lng: origin.lng }, { lat, lng });
        if (walk > MAX_UPSTREAM_WALK_MIN) break;
        chain.push({
          stationId: String(sts[i].stationId),
          name: String(sts[i].stationName ?? sts[i].stationId),
          walkMin: walk,
          lat,
          lng,
        });
      }
    }
  } catch {
    // 체인 구성 실패해도 출발 정류장 하나로 동작
  }
  chainCache.set(key, { at: Date.now(), chain });
  return chain;
}

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
        sigma: p.sigma,
        reasons: p.reasons,
        commuteMin: expectedCommuteMin(walkMin, p.boardingProbability, headway),
      };
    })
    .sort((x, y) => x.commuteMin - y.commuteMin);
}

// arrivalsByStation: chain 각 정류장의 도착정보. hour: 피크 판정용 (KST)
export function buildSalmon(
  chain: ChainStop[],
  arrivalsByStation: Record<string, Arrival[]>,
  dest: Destination,
  hour: number,
): SalmonData {
  const stops: StopPlan[] = chain.map((s) => {
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
      arrivalsByStation[chain[0].stationId] ?? [],
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
