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

// 방향 분류: 노선 종점명(routeDestName) 키워드 매칭 — 화성시 전역 어느 정류장이든 동작.
// 예) 동탄 기준 강남행 M4434·6001·6002-1·6008, 서울역행 M4130이 자동 분류됨.
export const DEST_KEYWORDS: Record<Destination, string[]> = {
  gangnam: ["강남", "서초", "양재", "신논현"],
  gangbuk: ["서울역", "숭례문", "명동", "광화문", "강북"],
};

export function classifyDest(destName: string): Destination | null {
  for (const dest of Object.keys(DEST_KEYWORDS) as Destination[]) {
    if (DEST_KEYWORDS[dest].some((kw) => destName.includes(kw))) return dest;
  }
  return null; // 서울 방면 아님 → 보드 비표시
}

// 예측 계수 — 튜닝 가능하게 상수로 분리 (F2)
// 정류장당 승차 = 승객 도착률(명/분) × 앞차 간격(분). base는 전형 배차에서의 정류장당 승차.
export const PREDICT_COEF = {
  peakBoardBase: 6, // 피크: typicalHeadwayMin 배차 기준 정류장당 예상 승차수
  offPeakBoardBase: 2, // 비피크 동일 기준
  typicalHeadwayMin: 10, // base가 가정하는 배차간격 — 도착률 = base / typicalHeadwayMin
  peakStartHour: 7,
  peakEndHour: 9,
  recentPassRelief: 1.5, // 최근 N분간 동일 방향 통과 대수당 승차 감소
  doubleDeckRelief: 0.6, // 2층버스면 승차 압박 완화 계수 (좌석 공급 ↑)
};

// F3 강북행 대안 카드용 환승 근사치 (분) — v1은 정적 추정치, UI에 "추정" 명시
export const TRANSFER_PENALTY_MIN = 25;

// 도착 정류장까지 승차시간 추정용 광역버스 평균 영업속도(km/h)
// ponytail: 고정 상수 근사 — 출근 녹화로 노선·시간대별 실측 튜닝 예정
export const AVG_BUS_KMH = 45;

// 리플레이 모드 기본 fixture (fixtures/<이름>.json) — 출근시간 녹화 후 rush-YYYYMMDD로 교체
export const REPLAY_FILE = "dev-sample";
