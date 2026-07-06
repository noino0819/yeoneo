import { PREDICT_COEF as C } from "../constants/stops";

// F2: 도달 시 좌석 예측 — 룰 기반 v1. 순수함수 (테스트: scripts/check-predict.ts)
// ponytail: 룰 기반 근사. 시 교통카드 데이터 연계 시 학습 기반으로 교체

export interface PredictInput {
  remainSeats: number; // 현재 실측 잔여좌석
  upstreamStopCount: number; // 내 정류장 도착 전 거쳐올 정류장 수
  hour: number; // 현재 시각 (0-23)
  headwayMin: number; // 앞차와의 간격(분). 모르면 배차간격
  recentSamePassCount: number; // 최근 N분간 동일 방향 노선 통과 대수
  isDoubleDeck: boolean;
}

export interface Prediction {
  expectedSeats: number;
  boardingProbability: number; // 0~1
  reasons: string[];
}

export function predictBoarding(input: PredictInput): Prediction {
  const peak = input.hour >= C.peakStartHour && input.hour < C.peakEndHour;
  const base = peak ? C.peakBoardBase : C.offPeakBoardBase;

  // 정류장당 승차 = 도착률(base/전형배차) × 실제 배차간격.
  // v1은 base에 headway를 더해 정류장 수만큼 중복 가산 → 좌석 40석에도 2%가 나오던 원인.
  let perStop =
    (base / C.typicalHeadwayMin) * input.headwayMin -
    C.recentPassRelief * input.recentSamePassCount;
  if (input.isDoubleDeck) perStop *= C.doubleDeckRelief;
  perStop = Math.max(0.5, perStop);

  const boarded = perStop * input.upstreamStopCount;
  const expectedSeats = input.remainSeats - boarded;
  const boardingProbability = Math.min(0.98, Math.max(0.02, expectedSeats / 8));

  const reasons = [
    peak ? "출근 피크 시간대" : "비피크 시간대",
    `정류장당 예상 승차 ${perStop.toFixed(1)}명 × 상류 ${input.upstreamStopCount}개`,
    ...(input.isDoubleDeck ? ["2층버스(좌석 공급 여유)"] : []),
    ...(input.recentSamePassCount > 0
      ? [`최근 동일 방향 ${input.recentSamePassCount}대 통과(수요 일부 소진)`]
      : []),
  ];

  return {
    expectedSeats: Math.round(expectedSeats),
    boardingProbability: Math.round(boardingProbability * 100) / 100,
    reasons,
  };
}

// F3: 기대 총 통근시간 = 도보시간 + E[대기시간]
// E[대기] ≈ headway × (1-p)/p (기하분포 근사), 3배차로 캡
export function expectedCommuteMin(
  walkMin: number,
  boardingProbability: number,
  headwayMin: number,
): number {
  const p = Math.max(boardingProbability, 0.02);
  const wait = Math.min(headwayMin * ((1 - p) / p), headwayMin * 3);
  return Math.round(walkMin + wait);
}
