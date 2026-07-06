import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { buildSalmon, STOP_CHAIN, type SalmonData } from "@/lib/salmon";
import { HOME_STOP, REPLAY_FILE, type Destination } from "@/constants/stops";
import type { Arrival } from "@/lib/ggbus";

// 리플레이 모드: 녹화된 출근시간 fixture를 스냅샷 단위로 재생.
// 예측 로직은 라이브와 동일(lib/salmon) — 데이터 소스만 다름.

interface Snapshot {
  t: string;
  stations: Record<string, Arrival[]>;
}

export interface ReplayResponse {
  index: number;
  total: number;
  t: string; // 스냅샷 실제 기록 시각 (정직 표기용)
  arrivals: Arrival[];
  salmon: SalmonData;
}

let loaded: { file: string; data: Snapshot[] } | null = null;

function load(file: string): Snapshot[] {
  if (loaded?.file === file) return loaded.data;
  const p = path.join(process.cwd(), "fixtures", `${file}.json`);
  const data = JSON.parse(fs.readFileSync(p, "utf8")) as Snapshot[];
  loaded = { file, data };
  return data;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const file = q.get("file") ?? REPLAY_FILE;
  if (!/^[\w-]+$/.test(file)) {
    return NextResponse.json({ error: "잘못된 파일명" }, { status: 400 });
  }
  const dest = (q.get("dest") ?? "gangnam") as Destination;
  try {
    const snapshots = load(file);
    const i =
      ((parseInt(q.get("i") ?? "0", 10) || 0) % snapshots.length + snapshots.length) %
      snapshots.length;
    const snap = snapshots[i];
    const hour = (new Date(snap.t).getUTCHours() + 9) % 24; // 기록 시각 기준 피크 판정
    const body: ReplayResponse = {
      index: i,
      total: snapshots.length,
      t: snap.t,
      arrivals: snap.stations[HOME_STOP.stationId] ?? [],
      salmon: buildSalmon(STOP_CHAIN, snap.stations, dest, hour),
    };
    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
