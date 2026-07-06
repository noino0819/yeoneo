"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_STOP, type Destination } from "@/constants/stops";
import type { Arrival } from "@/lib/ggbus";
import type { TaggedRoute } from "@/app/api/routes/route";
import type { SalmonResponse } from "@/app/api/salmon/route";

const POLL_MS = 25_000;
const BRIEFING_MS = 60_000;

const pct = (p: number) => Math.round(p * 100);

function probColor(p: number): string {
  if (p >= 0.7) return "text-emerald-600";
  if (p >= 0.4) return "text-amber-500";
  return "text-red-500";
}

function seatColor(n: number | null): string {
  if (n === null || n < 0) return "text-gray-400";
  if (n === 0) return "text-red-500";
  if (n < 15) return "text-amber-500";
  return "text-emerald-600";
}

const seatText = (n: number | null) => (n === null || n < 0 ? "—" : `${n}석`);

export default function Home() {
  const [routes, setRoutes] = useState<TaggedRoute[] | null>(null);
  const [arrivals, setArrivals] = useState<Map<string, Arrival>>(new Map());
  const [salmon, setSalmon] = useState<SalmonResponse | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; ai: boolean } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<Destination>("gangnam");
  const [error, setError] = useState<string | null>(null);
  const salmonRef = useRef<SalmonResponse | null>(null);

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

  // F3: 연어 모드 — 탭 방향 기준 HOME+상류 동시 예측
  useEffect(() => {
    let dead = false;
    const run = () =>
      fetch(`/api/salmon?dest=${tab}`)
        .then((r) => r.json())
        .then((d) => {
          if (dead || d.error) return;
          setSalmon(d);
          salmonRef.current = d;
        })
        .catch(() => {});
    run();
    const id = setInterval(run, POLL_MS);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [tab]);

  // F4: AI 브리핑 — 60초 간격 (서버에도 60초 캐시)
  useEffect(() => {
    let dead = false;
    const run = () => {
      const s = salmonRef.current;
      if (!s || s.dest !== tab) return;
      fetch("/api/briefing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          dest: s.dest,
          best: s.recommendation && {
            stopName: s.recommendation.stopName,
            routeName: s.recommendation.routeName,
            boardingProbability: s.recommendation.prob,
          },
          stops: s.stops.map((st) => ({
            name: st.name,
            walkMin: st.walkMin,
            best: st.best && {
              routeName: st.best.routeName,
              etaMin: st.best.eta,
              seatsNow: st.best.seats,
              boardingProbability: st.best.prob,
              isDoubleDeck: st.best.isDoubleDeck,
            },
          })),
          altViaGangnam: s.altViaGangnam,
        }),
      })
        .then((r) => r.json())
        .then((d) => !dead && d.briefing && setBriefing({ text: d.briefing, ai: d.ai }))
        .catch(() => {});
    };
    const t = setTimeout(run, 2_000); // salmon 첫 응답 직후
    const id = setInterval(run, BRIEFING_MS);
    return () => {
      dead = true;
      clearTimeout(t);
      clearInterval(id);
    };
  }, [tab]);

  const tabRoutes = (routes ?? [])
    .filter((r) => r.dest === tab)
    .map((r) => ({ route: r, arrival: arrivals.get(r.routeId) ?? null }))
    .sort(
      (a, b) =>
        (a.arrival?.predictTime1 ?? Infinity) - (b.arrival?.predictTime1 ?? Infinity),
    );

  const rec = salmon?.dest === tab ? salmon.recommendation : null;

  return (
    <main className="mx-auto w-full max-w-md flex-1 p-4 pb-10">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">
          연어 <span aria-hidden>🐟</span>
        </h1>
        <p className="mt-1 text-sm text-gray-500">{HOME_STOP.name} · 서울 방면</p>
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

      {briefing && (
        <section className="mb-3 rounded-xl border p-4 text-sm">
          <p className="mb-1 text-xs font-semibold text-gray-400">
            {briefing.ai ? "🤖 AI 통근 브리핑" : "요약"} · 예측치 기반
          </p>
          {briefing.text}
        </section>
      )}

      {rec && (
        <section className="mb-3 rounded-xl border-2 border-emerald-500/60 p-4">
          <p className="text-xs font-semibold text-emerald-600">
            🐟 연어 추천 · 예측치
          </p>
          <p className="mt-1 font-semibold">
            {rec.stopName === HOME_STOP.name
              ? "지금 이 정류장"
              : `${rec.stopName} (도보 ${rec.walkMin}분)`}
            에서 {rec.routeName}
          </p>
          <p className="mt-0.5 text-sm text-gray-500">
            {rec.eta}분 후 도착 · 예상 잔여 {Math.max(rec.expectedSeats, 0)}석 ·{" "}
            <span className={probColor(rec.prob)}>탑승 확률 {pct(rec.prob)}%</span>
            {rec.isDoubleDeck && " · 2층버스"}
          </p>
        </section>
      )}

      {salmon?.dest === tab && salmon.stops.length > 1 && (
        <section className="mb-3 flex gap-2 overflow-x-auto">
          {salmon.stops.map((s) => (
            <div
              key={s.stationId}
              className="min-w-28 flex-1 rounded-xl border p-3 text-center"
            >
              <p className="truncate text-xs text-gray-500">{s.name}</p>
              <p className="text-[11px] text-gray-400">
                {s.walkMin === 0 ? "여기" : `도보 ${s.walkMin}분`}
              </p>
              {s.best ? (
                <>
                  <p className={`text-lg font-bold ${probColor(s.best.prob)}`}>
                    {pct(s.best.prob)}%
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {s.best.routeName} · {s.best.eta}분
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-400">운행 없음</p>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "gangbuk" && salmon?.dest === "gangbuk" && salmon.altViaGangnam && (
        <section className="mb-3 rounded-xl border border-amber-400/60 p-4 text-sm">
          <p className="text-xs font-semibold text-amber-500">환승 대안</p>
          <p className="mt-1">
            서울역행을 놓칠 확률이 높습니다. 강남행{" "}
            <b>{salmon.altViaGangnam.routeName}</b> 탑승 후 환승 시 기대{" "}
            {salmon.altViaGangnam.commuteMin}분 (환승 소요는 정적 추정치)
          </p>
        </section>
      )}

      {error && (
        <p className="mb-3 rounded-lg border border-red-300 p-3 text-sm text-red-500">
          {error}
        </p>
      )}

      {routes === null ? (
        <p className="p-8 text-center text-sm text-gray-400">노선 불러오는 중…</p>
      ) : tabRoutes.length === 0 ? (
        <p className="p-8 text-center text-sm text-gray-400">이 방면 노선이 없습니다</p>
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
                  {arrival?.lowPlate1 === 2 && (
                    <span className="ml-1.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-xs font-semibold text-blue-500">
                      2층
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
              {arrival?.stationNm1 && (
                <p className="mt-1 text-xs text-gray-400">
                  현재 {arrival.stationNm1} ({arrival.locationNo1}정거장 전)
                </p>
              )}
              {arrival?.predictTime2 != null && (
                <p className="mt-0.5 text-xs text-gray-400">
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
