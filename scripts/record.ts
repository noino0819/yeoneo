// 리플레이용 출근시간 녹화: 30초 간격으로 도착정보 스냅샷을 fixtures/에 저장
// 실행: npm run record -- <stationId> [종료시각 HH:MM, 기본 09:00]
// cron 예: 06:55에 시작해두면 07:00~09:00 커버
import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { getArrivals } from "../lib/ggbus";

const stationId = process.argv[2];
if (!stationId) {
  console.error("사용법: npm run record -- <stationId> [HH:MM]");
  process.exit(1);
}
const [endH, endM] = (process.argv[3] ?? "09:00").split(":").map(Number);

const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
const outFile = path.join(process.cwd(), "fixtures", `rush-${ymd}.json`);
fs.mkdirSync(path.dirname(outFile), { recursive: true });

// 기존 파일 이어쓰기 (재시작 안전)
const snapshots: { t: string; arrivals: unknown }[] = fs.existsSync(outFile)
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
    const arrivals = await getArrivals(stationId);
    snapshots.push({ t: now.toISOString(), arrivals });
    fs.writeFileSync(outFile, JSON.stringify(snapshots));
    console.log(`${now.toLocaleTimeString()} — ${arrivals.length}개 노선 기록 (누적 ${snapshots.length})`);
  } catch (e) {
    console.error(`${now.toLocaleTimeString()} — 실패, 계속:`, String(e));
  }
}

console.log(`녹화 시작: station=${stationId}, ${endH}:${String(endM).padStart(2, "0")}까지, 30s 간격 → ${outFile}`);
tick();
setInterval(tick, INTERVAL);
