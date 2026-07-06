// 리플레이용 출근시간 녹화: 30초 간격으로 HOME+상류 정류장 도착정보 스냅샷을 fixtures/에 저장
// 실행: npm run record                    → constants의 HOME 체인, 09:05까지
//       npm run record -- 09:30           → 종료시각 지정
//       npm run record -- 09:30 dev-test  → 파일명 지정 (기본 rush-YYYYMMDD)
//       npm run record -- 19:00 rush-pm 121000009  → 추가 정류장(쉼표 구분, 퇴근 서울 승차용)
import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { getArrivals, type Arrival } from "../lib/ggbus";
import { HOME_STOP } from "../constants/stops";

const [endH, endM] = (process.argv[2] ?? "09:05").split(":").map(Number);
const stationIds = [
  HOME_STOP.stationId,
  ...HOME_STOP.upstream.map((u) => u.stationId),
  ...(process.argv[4]?.split(",").filter(Boolean) ?? []),
];

const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
const name = process.argv[3] ?? `rush-${ymd}`;
const outFile = path.join(process.cwd(), "fixtures", `${name}.json`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

interface Snapshot {
  t: string;
  stations: Record<string, Arrival[]>;
}

// 기존 파일 이어쓰기 (재시작 안전)
const snapshots: Snapshot[] = fs.existsSync(outFile)
  ? JSON.parse(fs.readFileSync(outFile, "utf8"))
  : [];

const INTERVAL = 30_000;

async function tick() {
  const now = new Date();
  if (now.getHours() > endH || (now.getHours() === endH && now.getMinutes() >= endM)) {
    console.log(`녹화 종료: ${snapshots.length}개 스냅샷 → ${outFile}`);
    process.exit(0);
  }
  try {
    const stations: Record<string, Arrival[]> = {};
    for (const sid of stationIds) {
      stations[sid] = await getArrivals(sid);
    }
    snapshots.push({ t: now.toISOString(), stations });
    fs.writeFileSync(outFile, JSON.stringify(snapshots));
    console.log(
      `${now.toLocaleTimeString()} — ${stationIds.length}개 정류장 기록 (누적 ${snapshots.length})`,
    );
  } catch (e) {
    console.error(`${now.toLocaleTimeString()} — 실패, 계속:`, String(e));
  }
}

console.log(
  `녹화 시작: ${stationIds.join(", ")} / ${endH}:${String(endM).padStart(2, "0")}까지 30s 간격 → ${outFile}`,
);
tick();
setInterval(tick, INTERVAL);
