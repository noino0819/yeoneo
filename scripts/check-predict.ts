// 실행: node scripts/check-predict.ts (Node 23.6+ 타입 스트리핑)
import assert from "node:assert";
import { predictBoarding, expectedCommuteMin, boardingProb } from "../lib/predict";
import { walkMinutes } from "../lib/walk";

const base = {
  remainSeats: 20,
  upstreamStopCount: 2,
  hour: 8,
  headwayMin: 10,
  recentSamePassCount: 0,
  isDoubleDeck: false,
};

const peak = predictBoarding(base);
const offPeak = predictBoarding({ ...base, hour: 14 });
assert(peak.expectedSeats < offPeak.expectedSeats, "피크에 더 많이 줄어야 함");

// 실측(fit): 2층버스는 정류장당 더 많이 태움 — 승객의 이득은 잔여좌석 자체가 큰 데서 옴
const doubleDeck = predictBoarding({ ...base, isDoubleDeck: true });
assert(doubleDeck.expectedSeats <= peak.expectedSeats, "2층버스는 승차 흡수가 커야 함");

const fullBus = predictBoarding({ ...base, remainSeats: 2 });
assert(fullBus.boardingProbability <= 0.4, "만석 임박이면 확률 낮아야 함");
assert(
  predictBoarding({ ...base, remainSeats: 2, upstreamStopCount: 5 }).boardingProbability <= 0.25,
  "만석 임박 + 상류 많으면 확률 더 낮아야 함",
);
assert(peak.boardingProbability > 0 && peak.boardingProbability < 1, "0~1 범위");

assert(
  expectedCommuteMin(7, 0.9, 10) < expectedCommuteMin(0, 0.2, 10),
  "확률 90% 도보7분이 확률 20% 도보0분보다 빨라야 함",
);

// 회귀 방지: 비피크·좌석 넉넉·기본배차(15분)에서 헐값 확률이 나오면 안 됨 (headway 중복가산 버그)
const midday = predictBoarding({
  remainSeats: 39,
  upstreamStopCount: 7,
  hour: 13,
  headwayMin: 15,
  recentSamePassCount: 0,
  isDoubleDeck: false,
});
assert(
  midday.boardingProbability >= 0.7,
  `비피크 39석/7정거장 확률이 너무 낮음: ${midday.boardingProbability}`,
);

// 대기열 반영: 내 앞 사람이 많을수록 확률 단조 감소(98% 캡 구간은 동률 허용)
assert(
  boardingProb(peak.expectedSeats, peak.sigma) >=
    boardingProb(peak.expectedSeats - 5, peak.sigma) &&
    boardingProb(peak.expectedSeats - 5, peak.sigma) >
      boardingProb(peak.expectedSeats - 15, peak.sigma),
  "대기 인원 증가 시 확률이 줄어야 함",
);

// walkMinutes: 위경도 근방 ~500m ≈ 8분
const m = walkMinutes({ lat: 37.2, lng: 127.07 }, { lat: 37.2045, lng: 127.07 });
assert(m >= 7 && m <= 9, `도보시간 계산 이상: ${m}`);

console.log("check-predict OK");
