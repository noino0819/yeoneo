// 녹화 fixture로 PREDICT_COEF 실측 피팅: 버스를 plateNo로 추적해 정류장당 실제 승차를 측정.
// 실행: npm run fit                → fixtures/rush-*.json 전체
//       npm run fit -- dev-sample  → 특정 파일 지정
// 출력: 실측 요약 + 제안 계수 + 현행/피팅 백테스트 MAE. 계수 반영은 constants/stops.ts에 수동으로.
import fs from "node:fs";
import path from "node:path";
import { PREDICT_COEF as C } from "../constants/stops";
import type { Arrival } from "../lib/ggbus";

interface Obs {
  t: number;
  loc: number;
  seats: number;
  dd: boolean;
  peak: boolean;
  headway: number | null;
}
interface Snapshot {
  t: string;
  stations: Record<string, Arrival[]>;
}

const dir = path.join(process.cwd(), "fixtures");
const args = process.argv.slice(2);
const files = args.length
  ? args.map((n) => (n.endsWith(".json") ? n : `${n}.json`))
  : fs.readdirSync(dir).filter((f) => f.startsWith("rush-") && f.endsWith(".json"));

if (!files.length) {
  console.log("녹화 파일이 없습니다. 출근시간에 `npm run record` 먼저 → fixtures/rush-*.json");
  process.exit(1);
}

// 1. 스냅샷 → 버스별 관측 시퀀스 (파일:정류장:노선:차량 단위)
const tracks = new Map<string, Obs[]>();
for (const f of files) {
  const snaps: Snapshot[] = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  for (const snap of snaps) {
    const t = Date.parse(snap.t);
    const hour = Math.floor(t / 3_600_000 + 9) % 24; // KST
    for (const [sid, arrivals] of Object.entries(snap.stations)) {
      for (const a of arrivals) {
        if (!a.plateNo1 || a.locationNo1 === null || (a.remainSeatCnt1 ?? -1) < 0) continue;
        const key = `${f}:${sid}:${a.routeId}:${a.plateNo1}`;
        const list = tracks.get(key) ?? [];
        list.push({
          t,
          loc: a.locationNo1,
          seats: a.remainSeatCnt1!,
          dd: a.lowPlate1 === 2,
          peak: hour >= C.peakStartHour && hour < C.peakEndHour,
          headway:
            a.predictTime1 !== null && a.predictTime2 !== null
              ? Math.max(a.predictTime2 - a.predictTime1, 3)
              : null,
        });
        tracks.set(key, list);
      }
    }
  }
}

// 2. 연속 관측 쌍(버스가 k정거장 전진) → 정류장당 승차 표본
interface Sample {
  perStop: number;
  stops: number;
  drop: number;
  peak: boolean;
  dd: boolean;
  headway: number | null;
}
const samples: Sample[] = [];
for (const obs of tracks.values()) {
  obs.sort((x, y) => x.t - y.t);
  for (let i = 1; i < obs.length; i++) {
    const a = obs[i - 1];
    const b = obs[i];
    const stops = a.loc - b.loc;
    if (stops < 1 || b.t - a.t > 5 * 60_000) continue; // 전진 없음 / 관측 공백
    const perStop = (a.seats - b.seats) / stops;
    if (Math.abs(perStop) > 15) continue; // API 글리치 컷
    samples.push({ perStop, stops, drop: a.seats - b.seats, peak: a.peak, dd: a.dd, headway: a.headway });
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN;
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const groups = {
  peakNormal: samples.filter((s) => s.peak && !s.dd),
  peakDD: samples.filter((s) => s.peak && s.dd),
  offPeak: samples.filter((s) => !s.peak),
};
const MIN_SAMPLES = 10;
const perStopOf = (g: Sample[]) => median(g.map((s) => s.perStop));
const headwayOf = (g: Sample[]) => {
  const hs = g.filter((s) => s.headway !== null).map((s) => s.headway!);
  return hs.length ? median(hs) : C.typicalHeadwayMin;
};
// 실측 per-stop → base 환산: base = perStop × 전형배차 / 관측배차
const toBase = (g: Sample[]) =>
  Math.round(((perStopOf(g) * C.typicalHeadwayMin) / headwayOf(g)) * 10) / 10;

// 과산포: Poisson이면 Var(drop)=E[drop]. 실측 비율이 날짜별 변동 포함 분산 배수.
const fitOverdispersion = (g: Sample[]) => {
  const drops = g.filter((s) => s.drop > 0).map((s) => s.drop);
  if (drops.length < MIN_SAMPLES) return null;
  const m = mean(drops);
  const v = mean(drops.map((d) => (d - m) ** 2));
  return Math.max(1, Math.round((v / m) * 10) / 10);
};

// 3. 백테스트: 좌석 감소 예측 MAE (현행 계수 vs 피팅 계수)
const modelDrop = (
  s: Sample,
  coef: { peak: number; offPeak: number; ddRelief: number },
) => {
  let per =
    ((s.peak ? coef.peak : coef.offPeak) / C.typicalHeadwayMin) *
    (s.headway ?? C.typicalHeadwayMin);
  if (s.dd) per *= coef.ddRelief;
  return Math.max(0.5, per) * s.stops;
};
const mae = (coef: Parameters<typeof modelDrop>[1]) =>
  mean(samples.map((s) => Math.abs(s.drop - modelDrop(s, coef))));

// 4. 리포트
console.log(`파일 ${files.length}개 · 추적 버스 ${tracks.size}대 · 표본 ${samples.length}개`);
console.log(
  `  (피크 일반 ${groups.peakNormal.length} / 피크 2층 ${groups.peakDD.length} / 비피크 ${groups.offPeak.length})\n`,
);

const enough = (g: Sample[]) => g.length >= MIN_SAMPLES;
const fitted = {
  peak: enough(groups.peakNormal) ? toBase(groups.peakNormal) : C.peakBoardBase,
  offPeak: enough(groups.offPeak) ? toBase(groups.offPeak) : C.offPeakBoardBase,
  ddRelief:
    enough(groups.peakDD) && enough(groups.peakNormal)
      ? Math.round((perStopOf(groups.peakDD) / perStopOf(groups.peakNormal)) * 100) / 100
      : C.doubleDeckRelief,
};
const phi = fitOverdispersion(groups.peakNormal) ?? C.overdispersion;

const line = (label: string, cur: number, fit: number, g: Sample[] | null) =>
  console.log(
    `  ${label}: ${cur} → ${fit}${g && !enough(g) ? "  (표본 부족 — 현행 유지)" : ""}`,
  );
console.log("제안 PREDICT_COEF (현행 → 피팅):");
line("peakBoardBase", C.peakBoardBase, fitted.peak, groups.peakNormal);
line("offPeakBoardBase", C.offPeakBoardBase, fitted.offPeak, groups.offPeak);
line("doubleDeckRelief", C.doubleDeckRelief, fitted.ddRelief, groups.peakDD);
line("overdispersion", C.overdispersion, phi, groups.peakNormal);

if (samples.length) {
  console.log(
    `\n백테스트 MAE(좌석 감소 예측 오차): 현행 ${mae({ peak: C.peakBoardBase, offPeak: C.offPeakBoardBase, ddRelief: C.doubleDeckRelief }).toFixed(2)}석 → 피팅 ${mae(fitted).toFixed(2)}석`,
  );
} else {
  console.log("\n표본 0개 — 녹화가 짧거나 좌석 정보가 없는 노선입니다.");
}
