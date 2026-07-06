"use client";

import { useCallback, useEffect, useState } from "react";
import { HOME_STOP, type Destination } from "@/constants/stops";
import type { Arrival } from "@/lib/ggbus";
import type { TaggedRoute } from "@/app/api/routes/route";

const POLL_MS = 25_000;

function seatColor(n: number | null): string {
  if (n === null || n < 0) return "text-gray-400";
  if (n === 0) return "text-red-500";
  if (n < 15) return "text-amber-500";
  return "text-emerald-600";
}

function seatText(n: number | null): string {
  return n === null || n < 0 ? "—" : `${n}석`;
}

export default function Home() {
  const [routes, setRoutes] = useState<TaggedRoute[] | null>(null);
  const [arrivals, setArrivals] = useState<Map<string, Arrival>>(new Map());
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<Destination>("gangnam");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/routes?stationId=${HOME_STOP.stationId}`)
      .then((r) => r.json())
      .then((d) => setRoutes(d.routes ?? []))
      .catch(() => setError("노선 정보를 불러오지 못했습니다"));
  }, []);

  const poll = useCallback(() => {
    fetch(`/api/arrivals?stationId=${HOME_STOP.stationId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setArrivals(new Map((d.arrivals as Arrival[]).map((a) => [a.routeId, a])));
        setUpdatedAt(new Date());
        setError(null);
      })
      .catch(() => setError("도착 정보를 불러오지 못했습니다"));
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  const tabRoutes = (routes ?? [])
    .filter((r) => r.dest === tab)
    .map((r) => ({ route: r, arrival: arrivals.get(r.routeId) ?? null }))
    .sort(
      (a, b) =>
        (a.arrival?.predictTime1 ?? Infinity) -
        (b.arrival?.predictTime1 ?? Infinity),
    );

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">
          연어 <span aria-hidden>🐟</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {HOME_STOP.name} · 서울 방면
        </p>
        <p className="text-xs text-gray-400">
          {updatedAt
            ? `${updatedAt.toLocaleTimeString("ko-KR")} 갱신 · 25초 자동 갱신`
            : "불러오는 중…"}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl border p-1 text-sm font-medium">
        {(
          [
            ["gangnam", "강남 방면"],
            ["gangbuk", "서울역·강북 방면"],
          ] as [Destination, string][]
        ).map(([d, label]) => (
          <button
            key={d}
            onClick={() => setTab(d)}
            className={`rounded-lg py-2 transition-colors ${
              tab === d ? "bg-foreground text-background" : "text-gray-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-300 p-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {routes === null ? (
        <p className="p-8 text-center text-sm text-gray-400">노선 불러오는 중…</p>
      ) : tabRoutes.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">
          이 방면 노선이 없습니다
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {tabRoutes.map(({ route, arrival }) => (
            <li key={route.routeId} className="rounded-xl border p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-lg font-bold">
                  {route.routeName}
                  {route.typeName.includes("광역급행") && (
                    <span className="ml-1.5 rounded bg-red-500/10 px-1.5 py-0.5 text-xs font-semibold text-red-500">
                      M버스
                    </span>
                  )}
                </span>
                <span className="text-lg font-semibold">
                  {arrival?.predictTime1 != null
                    ? `${arrival.predictTime1}분 후`
                    : "운행 정보 없음"}
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between text-sm">
                <span className="truncate text-gray-400">→ {route.destName}</span>
                <span className={seatColor(arrival?.remainSeatCnt1 ?? null)}>
                  잔여 {seatText(arrival?.remainSeatCnt1 ?? null)}
                </span>
              </div>
              {arrival?.predictTime2 != null && (
                <p className="mt-1 text-xs text-gray-400">
                  다음 차 {arrival.predictTime2}분 후 · 잔여{" "}
                  {seatText(arrival.remainSeatCnt2)}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-xs text-gray-400 text-balance">
        광역버스를 타기 위해 오늘도 정류장을 거슬러 오르는 모든 연어들을 위하여
      </p>
    </main>
  );
}
