import { XMLParser } from "fast-xml-parser";

// 경기도 버스정보 API (공공데이터포털 활용신청 필요)
// ponytail: v2 경로는 키 발급 후 첫 호출로 검증 필요 — 실패 시 이 상수만 수정
const BASE = "https://apis.data.go.kr/6410000";
export const PATHS = {
  arrivals: "/busarrivalservice/v2/getBusArrivalListv2", // 정류소별 도착정보
  locations: "/buslocationservice/v2/getBusLocationListv2", // 노선별 차량 위치
  routeStations: "/busrouteservice/v2/getBusRouteStationListv2", // 노선 경유 정류장
  routeInfo: "/busrouteservice/v2/getBusRouteInfoItemv2", // 노선 기본정보(배차간격 등)
  stationSearch: "/busstationservice/v2/getBusStationListv2", // 정류소 키워드 검색
  stationRoutes: "/busstationservice/v2/getBusStationViaRouteListv2", // 정류소 경유노선
} as const;

const xml = new XMLParser({ ignoreAttributes: true });

async function ggFetch(
  path: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const key = process.env.GG_BUS_API_KEY;
  if (!key) throw new Error("GG_BUS_API_KEY not set");
  const qs = new URLSearchParams({ serviceKey: key, format: "json", ...params });
  const res = await fetch(`${BASE}${path}?${qs}`, { cache: "no-store" });
  const text = await res.text();
  const body = text.trimStart().startsWith("<") ? xml.parse(text) : JSON.parse(text);
  const response = body.response ?? body;
  const code = response?.msgHeader?.resultCode;
  // 4 = 결과 없음 (정상 케이스: 도착 예정 버스 없음)
  if (code !== undefined && code !== 0 && code !== "0" && code !== 4 && code !== "4") {
    throw new Error(
      `GG bus API error ${code}: ${response?.msgHeader?.resultMessage} (${path})`,
    );
  }
  return response?.msgBody ?? {};
}

// XML 파싱 시 항목이 1개면 객체, 여러 개면 배열로 오는 것을 배열로 통일
function asArray<T>(v: T | T[] | undefined | null): T[] {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

export interface Arrival {
  routeId: string;
  routeName: string;
  staOrder: number;
  predictTime1: number | null; // 도착예정(분)
  predictTime2: number | null;
  remainSeatCnt1: number | null; // 잔여좌석 (-1 = 정보 없음)
  remainSeatCnt2: number | null;
  plateNo1: string | null;
  plateNo2: string | null;
  lowPlate1: string | null; // 차량구분 참고
}

const num = (v: unknown): number | null =>
  v === undefined || v === null || v === "" ? null : Number(v);

export async function getArrivals(stationId: string): Promise<Arrival[]> {
  const body = await ggFetch(PATHS.arrivals, { stationId });
  return asArray<Record<string, unknown>>(
    (body.busArrivalList as never) ?? (body.itemList as never),
  ).map((it) => ({
    routeId: String(it.routeId),
    routeName: String(it.routeName ?? it.routeId),
    staOrder: Number(it.staOrder ?? 0),
    predictTime1: num(it.predictTime1),
    predictTime2: num(it.predictTime2),
    remainSeatCnt1: num(it.remainSeatCnt1),
    remainSeatCnt2: num(it.remainSeatCnt2),
    plateNo1: it.plateNo1 ? String(it.plateNo1) : null,
    plateNo2: it.plateNo2 ? String(it.plateNo2) : null,
    lowPlate1: it.lowPlate1 !== undefined ? String(it.lowPlate1) : null,
  }));
}

export interface BusLocation {
  routeId: string;
  stationSeq: number; // 현재 정류장 순번
  plateNo: string;
  remainSeatCnt: number | null;
}

export async function getBusLocations(routeId: string): Promise<BusLocation[]> {
  const body = await ggFetch(PATHS.locations, { routeId });
  return asArray<Record<string, unknown>>(
    (body.busLocationList as never) ?? (body.itemList as never),
  ).map((it) => ({
    routeId: String(it.routeId ?? routeId),
    stationSeq: Number(it.stationSeq ?? it.stationId ?? 0),
    plateNo: String(it.plateNo ?? ""),
    remainSeatCnt: num(it.remainSeatCnt),
  }));
}

// 초기 셋업용 (런타임 조회 X) — scripts/setup-constants.ts에서 사용
export async function searchStations(keyword: string) {
  const body = await ggFetch(PATHS.stationSearch, { keyword });
  return asArray<Record<string, unknown>>(
    (body.busStationList as never) ?? (body.itemList as never),
  );
}

export async function getStationRoutes(stationId: string) {
  const body = await ggFetch(PATHS.stationRoutes, { stationId });
  return asArray<Record<string, unknown>>(
    (body.busRouteList as never) ?? (body.itemList as never),
  );
}

export async function getRouteStations(routeId: string) {
  const body = await ggFetch(PATHS.routeStations, { routeId });
  return asArray<Record<string, unknown>>(
    (body.busRouteStationList as never) ?? (body.itemList as never),
  );
}
