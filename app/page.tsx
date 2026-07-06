"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { HOME_STOP, type Destination } from "@/constants/stops";
import type { Arrival } from "@/lib/ggbus";
import type { TaggedRoute } from "@/app/api/routes/route";
import type { SalmonResponse } from "@/app/api/salmon/route";
import type { ReplayResponse } from "@/app/api/replay/route";
import { Salmon, SalmonMini, SalmonPoint, SalmonSad, SalmonSleep } from "@/app/mascot";
import { walkMinutes } from "@/lib/walk";

const POLL_MS = 25_000;
const REPLAY_STEP_MS = 2_500; // 30초 간격 스냅샷을 2.5초마다 → 12배속
const BRIEFING_MS = 60_000;

const pct = (p: number) => Math.round(p * 100);
const CARD = "rounded-[20px] bg-surface shadow-[0_2px_10px_rgba(60,30,20,0.05)]";

type Grade = "ok" | "warn" | "bad";
const GRADE_TEXT: Record<Grade, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-bad",
};
const probGrade = (p: number): Grade => (p >= 0.7 ? "ok" : p >= 0.4 ? "warn" : "bad");
const seatGrade = (n: number | null): Grade | null =>
  n === null || n < 0 ? null : n === 0 ? "bad" : n < 15 ? "warn" : "ok";

const seatText = (n: number | null) => (n === null || n < 0 ? "—" : `${n}석`);

// 정류장 좌표 — 내 위치 기반 도보시간(연어 UI.dc 3a "지금 출발" 타이밍)에 사용
const STOP_COORDS: Record<string, { lat: number; lng: number }> = Object.fromEntries(
  [HOME_STOP, ...HOME_STOP.upstream].map((s) => [s.stationId, { lat: s.lat, lng: s.lng }]),
);

export default function Home() {
  const [routes, setRoutes] = useState<TaggedRoute[] | null>(null);
  const [arrivals, setArrivals] = useState<Map<string, Arrival>>(new Map());
  const [salmon, setSalmon] = useState<SalmonResponse | null>(null);
  const [briefing, setBriefing] = useState<{ text: string; ai: boolean } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [tab, setTab] = useState<Destination>("gangnam");
  const [replay, setReplay] = useState(false);
  const [replayT, setReplayT] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);
  const [geoPrompt, setGeoPrompt] = useState(false);
  const salmonRef = useRef<SalmonResponse | null>(null);
  const replayIdx = useRef(0);

  const locate = useCallback(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        setGeo({ lat: p.coords.latitude, lng: p.coords.longitude });
        localStorage.setItem("yn-geo", "on");
        setGeoPrompt(false);
      },
      () => {
        localStorage.setItem("yn-geo", "off");
        setGeoPrompt(false);
      },
      { maximumAge: 60_000 },
    );
  }, []);

  // 위치: 이전에 허용했으면 조용히 갱신, 처음이면 카드로 물어봄
  // (localStorage는 SSR에 없어 hydration 후 effect에서 읽어야 함)
  useEffect(() => {
    const pref = localStorage.getItem("yn-geo");
    if (pref === "on") locate();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    else if (pref === null) setGeoPrompt(true);
  }, [locate]);

  const loadRoutes = useCallback(() => {
    fetch(`/api/routes?stationId=${HOME_STOP.stationId}`)
      .then((r) => r.json())
      .then((d) => setRoutes(d.routes ?? []))
      .catch(() => setError("노선 정보를 불러오지 못했습니다"));
  }, []);

  useEffect(loadRoutes, [loadRoutes]);

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

  // 라이브: 도착정보 폴링
  useEffect(() => {
    if (replay) return;
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll, replay]);

  // 라이브: F3 연어 모드
  useEffect(() => {
    if (replay) return;
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
  }, [tab, replay]);

  // 리플레이: fixture 스냅샷 재생 (예측 로직은 라이브와 동일)
  useEffect(() => {
    if (!replay) return;
    let dead = false;
    const step = () =>
      fetch(`/api/replay?i=${replayIdx.current}&dest=${tab}`)
        .then((r) => r.json())
        .then((d: ReplayResponse & { error?: string }) => {
          if (dead || d.error) return;
          setArrivals(new Map(d.arrivals.map((a) => [a.routeId, a])));
          const s = { ...d.salmon, generatedAt: Date.parse(d.t) };
          setSalmon(s);
          salmonRef.current = s;
          setReplayT(d.t);
          setUpdatedAt(new Date(d.t));
          replayIdx.current = (d.index + 1) % d.total;
        })
        .catch(() => {});
    step();
    const id = setInterval(step, REPLAY_STEP_MS);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [tab, replay]);

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
    const t = setTimeout(run, 2_000);
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

  const salmonTab = salmon?.dest === tab ? salmon : null;
  const rec = salmonTab?.recommendation ?? null;
  // 홈 정류장의 노선별 예측 — 정류장 보드 카드의 탑승 확률 바에 사용
  const homePlans = new Map(
    (salmonTab?.stops[0]?.buses ?? []).map((b) => [b.routeName, b]),
  );
  const homeBest = salmonTab?.stops[0]?.best ?? null;
  const saving =
    rec && homeBest && rec.stopName !== HOME_STOP.name
      ? Math.round(homeBest.commuteMin - rec.commuteMin)
      : null;
  const riverStops = salmonTab ? [...salmonTab.stops].reverse() : [];

  // 위치 켜짐: 정류장별 실제 도보시간으로 기대 통근(도보+대기)을 재계산해 재추천.
  // 서버 wait = commuteMin - 정적 walkMin (확률 기반 기대 대기) — 같은 버스면 도착시각이
  // 동일하므로 승차시간은 비교에 영향 없음.
  const myPlans =
    geo && salmonTab
      ? new Map(
          salmonTab.stops.map((s) => {
            const c = STOP_COORDS[s.stationId];
            const walk = c ? walkMinutes(geo, c) : s.walkMin;
            const wait = s.best ? Math.max(s.best.commuteMin - s.walkMin, 0) : null;
            return [s.stationId, { walk, total: wait === null ? null : walk + wait }];
          }),
        )
      : null;
  const myRecStop =
    myPlans && salmonTab
      ? (salmonTab.stops
          .filter((s) => s.best && myPlans.get(s.stationId)?.total != null)
          .sort(
            (a, b) =>
              myPlans.get(a.stationId)!.total! - myPlans.get(b.stationId)!.total!,
          )[0] ?? null)
      : null;
  const myRecPlan = myRecStop ? (myPlans?.get(myRecStop.stationId) ?? null) : null;
  // 표시용 추천: 위치 기준이 있으면 그걸로, 없으면 서버(집 기준) 추천
  const dispRec = myRecStop?.best
    ? { ...myRecStop.best, stopName: myRecStop.name, walkMin: myRecPlan!.walk }
    : rec;
  const myHomePlan =
    myPlans && salmonTab ? (myPlans.get(salmonTab.stops[0].stationId) ?? null) : null;
  const mySaving =
    myRecStop && salmonTab && myRecStop.stationId !== salmonTab.stops[0].stationId &&
    myHomePlan?.total != null && myRecPlan?.total != null
      ? Math.round(myHomePlan.total - myRecPlan.total)
      : null;

  const retry = () => {
    setError(null);
    if (routes === null) loadRoutes();
    poll();
  };

  return (
    <main className="mx-auto w-full max-w-[430px] flex-1 px-4 pb-10 pt-3 lg:max-w-[1080px]">
      <header className="flex items-center gap-3 px-1">
        <span className="yn-bob shrink-0">
          <Salmon width={42} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h1 className="whitespace-nowrap text-2xl font-extrabold tracking-tight">연어</h1>
            <span className="truncate text-xs font-semibold text-faint">
              만석이면, 거슬러 오르세요
            </span>
          </div>
          <p className="mt-0.5 truncate text-[13px] font-medium text-muted">
            {HOME_STOP.name} → 서울 방면
          </p>
        </div>
        <button
          onClick={() => {
            replayIdx.current = 0;
            setReplay(!replay);
          }}
          className="shrink-0 rounded-full border-[1.5px] border-line bg-surface px-3 py-1.5 text-xs font-bold text-accent-deep"
        >
          {replay ? "실시간" : "리플레이"}
        </button>
        <button
          onClick={() => {
            const el = document.documentElement;
            const next = el.dataset.theme === "dark" ? "light" : "dark";
            el.dataset.theme = next;
            localStorage.setItem("yn-theme", next);
          }}
          aria-label="라이트/다크 모드 전환"
          className="theme-toggle relative h-[26px] w-[46px] shrink-0 rounded-full bg-track"
        >
          <span className="theme-knob absolute left-[2px] top-[2px] flex h-[22px] w-[22px] items-center justify-center rounded-full bg-surface shadow-[0_1px_4px_rgba(60,30,20,0.25)]">
            <svg
              className="dark-hide"
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#E8A13A"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="12" cy="12" r="4.5" fill="#E8A13A" stroke="none" />
              <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M19.4 4.6l-1.8 1.8M6.4 17.6l-1.8 1.8" />
            </svg>
            <svg
              className="dark-show"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="#8FB0CC"
              aria-hidden
            >
              <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
            </svg>
          </span>
        </button>
      </header>

      <div className="mt-2 flex items-center gap-2 px-1.5">
        <span className="relative inline-block h-4 w-[46px] shrink-0">
          <span className="yn-swim absolute left-0 top-[3px] inline-block">
            <SalmonMini width={18} />
          </span>
        </span>
        <span className="text-xs font-medium text-faint">
          {updatedAt
            ? replay
              ? `${updatedAt.toLocaleTimeString("ko-KR", { hour12: false })} 시점 재생 중`
              : `${updatedAt.toLocaleTimeString("ko-KR", { hour12: false })} 갱신 · 25초마다 자동 갱신`
            : "도착 정보를 거슬러 올라가는 중…"}
        </span>
      </div>

      {replay && replayT && (
        <div className="mt-3 rounded-[14px] border border-info/25 bg-info-soft px-3.5 py-2.5 text-xs font-semibold text-info">
          {new Date(replayT).toLocaleString("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}{" "}
          실데이터 리플레이 재생 중 (12배속) — 실시간 정보가 아닙니다
        </div>
      )}

      <nav className="mt-3.5 grid grid-cols-2 gap-1 rounded-2xl bg-track p-1">
        {(
          [
            ["gangnam", "강남 방면"],
            ["gangbuk", "서울역·강북 방면"],
          ] as [Destination, string][]
        ).map(([d, label]) => (
          <button
            key={d}
            onClick={() => setTab(d)}
            className={`rounded-xl py-2.5 text-sm transition-colors ${
              tab === d
                ? "bg-accent font-bold text-on-accent shadow-[0_3px_8px_rgba(224,90,67,0.35)]"
                : "font-semibold text-faint"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-3.5 flex flex-col gap-3 lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-6">
        {/* 정류장 보드 */}
        <section className="order-3 flex flex-col gap-2.5 lg:order-none">
          {routes === null && error ? (
            <ErrorCard detail={error} onRetry={retry} onReplay={() => setReplay(true)} />
          ) : routes === null || (!updatedAt && !error) ? (
            <SkeletonCard />
          ) : error && arrivals.size === 0 && !replay ? (
            <ErrorCard detail={error} onRetry={retry} onReplay={() => setReplay(true)} />
          ) : tabRoutes.length === 0 ? (
            <EmptyCard replay={replay} onReplay={() => setReplay(true)} />
          ) : (
            <>
              {error && !replay && (
                <p className="rounded-[14px] bg-bad-soft px-3.5 py-2.5 text-xs font-semibold text-bad">
                  {error} — 마지막으로 받은 정보를 표시 중이에요
                </p>
              )}
              <ul className="flex flex-col gap-2.5">
                {tabRoutes.map(({ route, arrival }, i) => {
                  const mBus = route.typeName.includes("광역급행");
                  const plan = homePlans.get(route.routeName);
                  const seats = arrival?.remainSeatCnt1 ?? null;
                  const sGrade = seatGrade(seats);
                  const sub = [
                    arrival?.stationNm1 &&
                      `현재 ${arrival.stationNm1} (${arrival.locationNo1}정거장 전)`,
                    arrival?.predictTime2 != null &&
                      `다음 차 ${arrival.predictTime2}분 후 · 잔여 ${seatText(arrival.remainSeatCnt2)}`,
                  ].filter(Boolean);
                  return (
                    <li
                      key={route.routeId}
                      className={`yn-fadeup ${CARD} p-4`}
                      style={{ animationDelay: `${0.12 + i * 0.08}s` }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`whitespace-nowrap rounded-[10px] px-2.5 py-1 text-sm font-extrabold ${
                            mBus ? "bg-info-soft text-info" : "bg-accent-soft text-accent-deep"
                          }`}
                        >
                          {route.routeName}
                        </span>
                        <span className="min-w-0 truncate text-[11px] font-semibold text-faint">
                          {mBus ? "M버스" : route.typeName} · {route.destName}
                        </span>
                        {arrival?.lowPlate1 === 2 && (
                          <span className="rounded-md bg-info-soft px-1.5 py-0.5 text-[10px] font-extrabold text-info">
                            2층
                          </span>
                        )}
                        <span className="ml-auto shrink-0 whitespace-nowrap">
                          {arrival?.predictTime1 != null ? (
                            <span className="text-2xl font-extrabold">
                              {arrival.predictTime1}
                              <span className="text-[13px] font-bold text-muted">분 후</span>
                            </span>
                          ) : (
                            <span className="text-sm font-semibold text-faint">
                              운행 정보 없음
                            </span>
                          )}
                        </span>
                      </div>
                      {seats !== null && seats >= 0 && (
                        <div className="mt-3 flex items-center gap-2.5">
                          <span className="whitespace-nowrap text-xs font-semibold text-muted">
                            잔여{" "}
                            <b className={sGrade ? GRADE_TEXT[sGrade] : "text-faint"}>
                              {seats}석
                            </b>
                          </span>
                          <span className="h-[7px] flex-1 overflow-hidden rounded-full bg-track">
                            {plan && (
                              <span
                                className="yn-fill block h-full rounded-full"
                                style={{
                                  width: `${pct(plan.prob)}%`,
                                  background: `var(--${probGrade(plan.prob)})`,
                                }}
                              />
                            )}
                          </span>
                          {plan && (
                            <span
                              className={`whitespace-nowrap text-xs font-extrabold ${GRADE_TEXT[probGrade(plan.prob)]}`}
                            >
                              탑승 {pct(plan.prob)}%
                            </span>
                          )}
                        </div>
                      )}
                      {sub.length > 0 && (
                        <p className="mt-2.5 text-xs font-medium text-faint">
                          {sub.join(" · ")}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <aside className="contents lg:flex lg:flex-col lg:gap-4">
          {/* 위치 권한 카드 (UI.dc 3a) */}
          {geoPrompt && (
            <section className={`yn-fadeup order-1 ${CARD} p-4 lg:order-none`}>
              <div className="flex items-start gap-3">
                <span className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] bg-info-soft">
                  <span className="relative h-3.5 w-3.5 rounded-full border-[3.5px] border-info">
                    <span className="absolute left-1/2 top-1/2 h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-info" />
                  </span>
                </span>
                <div>
                  <b className="text-sm font-extrabold text-ink">
                    내 위치로 도보시간을 계산할까요?
                  </b>
                  <p className="mt-1 text-xs font-medium leading-relaxed text-faint">
                    &ldquo;지금 출발하면 도착 3분 전&rdquo; 같은 출발 타이밍을
                    알려드려요. 위치는 서버에 저장되지 않아요.
                  </p>
                </div>
              </div>
              <div className="mt-3.5 grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    localStorage.setItem("yn-geo", "off");
                    setGeoPrompt(false);
                  }}
                  className="rounded-xl bg-track py-3 text-[13px] font-bold text-faint"
                >
                  나중에
                </button>
                <button
                  onClick={locate}
                  className="rounded-xl bg-accent py-3 text-[13px] font-bold text-on-accent"
                >
                  위치 허용
                </button>
              </div>
            </section>
          )}

          {/* F4 AI 브리핑 */}
          {briefing && (
            <section className="yn-fadeup order-2 flex items-start gap-3 rounded-[20px] bg-accent-soft p-4 lg:order-none">
              <SalmonPoint width={28} className="mt-0.5 shrink-0" />
              <div>
                <p className="mb-1 text-[11px] font-extrabold tracking-wide text-accent-deep">
                  {briefing.ai ? "AI 통근 브리핑" : "오늘의 요약"} · 예측치 기반
                </p>
                <p className="text-[13.5px] font-medium leading-relaxed text-ink/85 [text-wrap:pretty]">
                  {briefing.text}
                </p>
              </div>
            </section>
          )}

          {/* 강북행 환승 대안 (만석 경고) */}
          {tab === "gangbuk" && salmonTab?.altViaGangnam && (
            <section className="yn-fadeup order-2 flex items-center gap-2.5 rounded-2xl border border-bad/25 bg-bad-soft p-3 lg:order-none">
              <span className="yn-pulse flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-bad text-[15px] font-extrabold text-white">
                !
              </span>
              <div>
                <b className="text-[13px] font-bold text-bad">
                  서울역행을 놓칠 확률이 높아요 — 환승 대안
                </b>
                <p className="mt-0.5 text-[11.5px] font-medium text-bad/80">
                  강남행 <b>{salmonTab.altViaGangnam.routeName}</b> 탑승 후 환승 시 기대{" "}
                  {salmonTab.altViaGangnam.commuteMin}분 (환승 소요는 정적 추정치)
                </p>
              </div>
            </section>
          )}

          {/* F3 연어 모드 */}
          {salmonTab && salmonTab.stops.length > 1 && (
            <section
              className={`yn-fadeup order-4 ${CARD} rounded-[22px] p-4 lg:order-none`}
              style={{ animationDelay: "0.3s" }}
            >
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-extrabold">연어 모드</h2>
                <span className="text-xs font-semibold text-faint">
                  {myPlans ? "내 위치 기준 비교" : "상류로 가면 더 확실해요"}
                </span>
              </div>

              {/* 강 — 상류가 왼쪽 */}
              <div className="relative mt-3.5 h-[58px]">
                <div className="river-track absolute left-2 right-2 top-[26px] h-1 rounded-full" />
                <span className="yn-upstream absolute top-3 z-[2]">
                  <SalmonMini width={32} />
                </span>
                {riverStops.map((s, i) => {
                  const isRec = dispRec?.stopName === s.name;
                  const last = i === riverStops.length - 1;
                  const x = (i / (riverStops.length - 1)) * 100;
                  return (
                    <span key={s.stationId}>
                      <span
                        className={`absolute rounded-full ${
                          isRec
                            ? "yn-pulse top-[22px] h-3 w-3 border-[3px] border-surface bg-accent shadow-[0_0_0_2px_var(--accent)]"
                            : "top-6 h-2 w-2"
                        }`}
                        style={{
                          background: isRec ? undefined : "var(--river-a)",
                          ...(i === 0
                            ? { left: 8 }
                            : last
                              ? { right: 8 }
                              : { left: `${x}%`, transform: "translateX(-50%)" }),
                        }}
                      />
                      <span
                        className={`absolute top-[42px] whitespace-nowrap text-[10.5px] ${
                          isRec ? "font-bold text-accent-deep" : "font-semibold text-faint"
                        }`}
                        style={
                          i === 0
                            ? { left: 0 }
                            : last
                              ? { right: 0 }
                              : { left: `${x}%`, transform: "translateX(-50%)" }
                        }
                      >
                        {s.walkMin === 0 && !myPlans ? "여기" : s.name}
                      </span>
                    </span>
                  );
                })}
              </div>

              {/* 정류장별 비교 */}
              <div className="mt-3.5 flex flex-col gap-2">
                {riverStops.map((s) => {
                  const isRec = dispRec?.stopName === s.name;
                  return (
                    <div
                      key={s.stationId}
                      className={`grid grid-cols-[108px_1fr_44px] items-center gap-2.5 rounded-[14px] px-3 ${
                        isRec ? "bg-accent-soft py-2.5" : "py-1.5"
                      }`}
                    >
                      <span
                        className={`min-w-0 text-[12.5px] ${
                          isRec ? "font-extrabold text-accent-deep" : "font-bold text-muted"
                        }`}
                      >
                        <span className="block truncate">
                          {s.walkMin === 0 && !myPlans ? "여기서 대기" : s.name}
                        </span>
                        <span
                          className={`block text-[10.5px] ${
                            isRec
                              ? "font-semibold text-accent-deep/70"
                              : "font-medium text-faint"
                          }`}
                        >
                          도보 {myPlans?.get(s.stationId)?.walk ?? s.walkMin}분
                          {isRec && " · 추천"}
                        </span>
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-track">
                        {s.best && (
                          <span
                            className="yn-fill block h-full rounded-full"
                            style={{
                              width: `${pct(s.best.prob)}%`,
                              background: isRec
                                ? "var(--accent)"
                                : `var(--${probGrade(s.best.prob)})`,
                            }}
                          />
                        )}
                      </span>
                      <b
                        className={`text-right text-[15px] ${
                          isRec
                            ? "text-accent-deep"
                            : s.best
                              ? GRADE_TEXT[probGrade(s.best.prob)]
                              : "text-faint"
                        }`}
                      >
                        {s.best ? `${pct(s.best.prob)}%` : "—"}
                      </b>
                    </div>
                  );
                })}
              </div>

              {myPlans && mySaving !== null && mySaving > 0 && dispRec ? (
                <p className="mt-3 rounded-xl bg-bg px-3 py-2.5 text-xs font-semibold text-muted">
                  내 위치 기준 — {dispRec.walkMin}분 걸어 {dispRec.stopName}에서 타면{" "}
                  {HOME_STOP.name} 대기보다{" "}
                  <b className="text-accent-deep">약 {mySaving}분 단축</b> (예측치)
                </p>
              ) : !myPlans && saving !== null && saving > 0 && rec ? (
                <p className="mt-3 rounded-xl bg-bg px-3 py-2.5 text-xs font-semibold text-muted">
                  {rec.walkMin}분 걸어 {rec.stopName}에서 타면 여기서 기다리는 것보다{" "}
                  <b className="text-accent-deep">약 {saving}분 단축</b> (예측치 기준)
                </p>
              ) : null}

              {dispRec && (
                <div className="mt-3 flex items-start gap-2.5 rounded-[14px] bg-river px-3.5 py-3">
                  <span className="yn-pulse mt-1 h-2 w-2 shrink-0 rounded-full bg-[#7FD6A8]" />
                  <div className="flex flex-col gap-1">
                    <span className="text-[12.5px] font-bold text-[#EAF2F9]">
                      {dispRec.stopName === HOME_STOP.name && !myPlans
                        ? "지금 이 정류장"
                        : `${dispRec.stopName} (도보 ${dispRec.walkMin}분)`}
                      에서 <b className="text-[#FFB09B]">{dispRec.routeName}</b> ·{" "}
                      {dispRec.eta}분 후 · 예상 잔여{" "}
                      {Math.max(dispRec.expectedSeats, 0)}석
                      {dispRec.isDoubleDeck && " · 2층버스"}
                    </span>
                    {myRecPlan && (
                      <span className="text-xs font-semibold text-[#C6D8E6]">
                        {dispRec.eta >= myRecPlan.walk ? (
                          <>
                            도보 {myRecPlan.walk}분 + 대기 {dispRec.eta - myRecPlan.walk}
                            분 → <b className="text-[#7FD6A8]">{dispRec.eta}분 뒤 탑승</b>
                          </>
                        ) : (
                          <>
                            도보 {myRecPlan.walk}분 —{" "}
                            <b className="text-[#FFB09B]">
                              이번 차({dispRec.eta}분 후)는 빠듯해요
                            </b>
                            {myRecPlan.total !== null &&
                              ` · 기대 총 ${myRecPlan.total}분`}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}
        </aside>
      </div>

      <p className="mt-6 text-center text-[11.5px] font-medium text-faint/80">
        오늘도 거슬러 오르는 모든 연어들을 위하여
      </p>
    </main>
  );
}

function SkeletonCard() {
  return (
    <div className={`${CARD} p-4`}>
      <div className="flex items-center gap-2">
        <span className="skeleton h-7 w-16 rounded-[10px]" />
        <span className="skeleton h-3 w-28 rounded-full" />
        <span className="skeleton ml-auto h-6 w-14 rounded-lg" />
      </div>
      <div className="mt-3.5 flex items-center gap-2.5">
        <span className="skeleton h-3 w-14 rounded-full" />
        <span className="skeleton h-[7px] flex-1 rounded-full" />
      </div>
      <div className="mt-3.5 flex justify-center">
        <span className="relative inline-block h-5 w-[60px]">
          <span className="yn-swim absolute left-0 top-0 inline-block">
            <SalmonMini width={24} />
          </span>
        </span>
      </div>
      <p className="mt-1.5 text-center text-[11.5px] font-semibold text-faint">
        도착 정보를 거슬러 올라가는 중…
      </p>
    </div>
  );
}

function ErrorCard({
  detail,
  onRetry,
  onReplay,
}: {
  detail: string;
  onRetry: () => void;
  onReplay: () => void;
}) {
  return (
    <div className={`${CARD} p-6 text-center`}>
      <span className="inline-block">
        <SalmonSad width={56} />
      </span>
      <p className="mt-2.5 text-sm font-extrabold">물살이 너무 세요</p>
      <p className="mt-1 text-xs font-medium text-faint">
        {detail}. 잠시 후 다시 시도해 주세요.
      </p>
      <div className="mt-3.5 flex justify-center gap-2">
        <button
          onClick={onRetry}
          className="rounded-xl bg-accent px-5 py-2.5 text-xs font-bold text-on-accent"
        >
          다시 시도
        </button>
        <button
          onClick={onReplay}
          className="rounded-xl border-[1.5px] border-line bg-surface px-5 py-2.5 text-xs font-bold text-accent-deep"
        >
          출근시간 리플레이 보기
        </button>
      </div>
    </div>
  );
}

function EmptyCard({ replay, onReplay }: { replay: boolean; onReplay: () => void }) {
  return (
    <div className={`${CARD} p-6 text-center`}>
      <span className="inline-block opacity-85">
        <SalmonSleep width={58} />
      </span>
      <p className="mt-2.5 text-sm font-extrabold">이 방면 버스가 없어요</p>
      <p className="mt-1 text-xs font-medium text-faint">
        운행 시간이 아니거나 노선 정보가 없어요 · 연어도 자러 갑니다
      </p>
      {!replay && (
        <button
          onClick={onReplay}
          className="mt-3.5 rounded-xl border-[1.5px] border-line bg-surface px-5 py-2.5 text-xs font-bold text-accent-deep"
        >
          출근시간 리플레이 보기
        </button>
      )}
    </div>
  );
}
