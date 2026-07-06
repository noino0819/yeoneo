// 1단계에서 API 실측으로 채울 것. 노선번호를 웹 검색으로 추측해 하드코딩하지 말 것 (노선 개편 잦음).

export interface UpstreamStop {
  name: string;
  stationId: string;
  walkMin: number;
  lat: number;
  lng: number;
}

export interface PresetStop {
  name: string;
  stationId: string;
  lat: number;
  lng: number;
  upstream: UpstreamStop[];
}

export const HOME_STOP: PresetStop = {
  name: "동탄센트럴자이",
  stationId: "TBD", // 정류소 키워드검색 API로 확정
  lat: 0,
  lng: 0,
  upstream: [], // 노선정보 API의 경유 정류장 순서에서, 이 정류장 이전 2~3개를 추출
};

export type Destination = "gangnam" | "gangbuk";

export const ROUTE_TAGS: Record<
  string,
  { dest: Destination; doubleDeckPossible?: boolean }
> = {};

// 예측 계수 — 튜닝 가능하게 상수로 분리 (F2)
export const PREDICT_COEF = {
  peakBoardBase: 6, // 피크 시간대 정류장당 기본 예상 승차수
  offPeakBoardBase: 2, // 비피크 기본 예상 승차수
  peakStartHour: 7,
  peakEndHour: 9,
  headwayFactor: 0.4, // 앞차와의 간격(분)당 승차 증가
  recentPassRelief: 1.5, // 최근 N분간 동일 방향 통과 대수당 승차 감소
  doubleDeckRelief: 0.6, // 2층버스면 승차 압박 완화 계수 (좌석 공급 ↑)
};

// F3 강북행 대안 카드용 환승 근사치 (분) — v1은 정적 추정치, UI에 "추정" 명시
export const TRANSFER_PENALTY_MIN = 25;
