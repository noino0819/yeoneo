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

// 2026-07-06 GBIS v2 API 실측. 동탄센트럴자이 아파트의 광역버스 승차 정류장은
// "상록.테크노밸리.GS자이" (서울방면). upstream은 M4130/M4434 경유 순서의 직전 정차 정류장.
export const HOME_STOP: PresetStop = {
  name: "상록.테크노밸리.GS자이",
  stationId: "233000121",
  lat: 37.2082833,
  lng: 127.0990667,
  upstream: [
    {
      name: "포스코더샵.롯데캐슬",
      stationId: "233000979",
      walkMin: 14,
      lat: 37.1999333,
      lng: 127.0991,
    },
    {
      name: "한화.린스트라우스",
      stationId: "233000978",
      walkMin: 22,
      lat: 37.1953833,
      lng: 127.0990833,
    },
  ],
};

export type Destination = "gangnam" | "gangbuk";

// 경유노선 실측 기준 방향 태깅. 6003(판교)·7200(인덕원)은 서울 방면이 아니라 제외.
export const ROUTE_TAGS: Record<
  string,
  { dest: Destination; doubleDeckPossible?: boolean }
> = {
  // 강남 방면 (신분당선강남역·서초)
  M4434: { dest: "gangnam" },
  "M4434(예약)": { dest: "gangnam" },
  "6001": { dest: "gangnam" },
  "6001(예약)": { dest: "gangnam" },
  "6002-1": { dest: "gangnam" },
  "6008": { dest: "gangnam" },
  // 서울역·강북 방면 — 배차 길어 놓쳤을 때 손실 큼 (예측 가치 최대)
  M4130: { dest: "gangbuk" },
  "M4130(예약)": { dest: "gangbuk" },
};

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
