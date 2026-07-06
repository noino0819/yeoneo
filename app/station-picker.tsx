"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap, LayerGroup } from "leaflet";
import { haversineMeters, walkMinutes, type LatLng } from "@/lib/walk";
import type { StationHit } from "@/app/api/stations/route";

export interface PickedStop {
  stationId: string;
  name: string;
  lat: number;
  lng: number;
}

// 키 불필요 무료 타일 (CARTO — OSM 기반, 라이트/다크 세트)
const TILES = {
  light: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
};
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

// 지도 픽커: 핀(지도 중심)을 옮기면 주변 정류장을 도보 시간순으로 보여주고 골라서 확정
export function StationPicker({
  mode,
  center,
  geo,
  allowClear,
  onClear,
  onSelect,
  onClose,
}: {
  mode: "origin" | "dest";
  center: PickedStop;
  geo: LatLng | null;
  allowClear: boolean;
  onClear: () => void;
  onSelect: (st: PickedStop) => void;
  onClose: () => void;
}) {
  const isDest = mode === "dest";
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const Lref = useRef<typeof import("leaflet") | null>(null);
  const layerRef = useRef<LayerGroup | null>(null);
  // leaflet 도형은 CSS 변수를 못 받아서 마운트 시 실제 색을 한 번 읽어둠
  const colors = useRef({ pin: "#f97862", onPin: "#fff", surface: "#fff", ring: "#a39288", me: "#2e6fa3" });
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState<LatLng>({ lat: center.lat, lng: center.lng });
  const [lifted, setLifted] = useState(false);
  const [stops, setStops] = useState<StationHit[] | null>(null); // null = 불러오는 중
  const [selected, setSelected] = useState<StationHit | null>(null);
  const [me, setMe] = useState<LatLng | null>(geo);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StationHit[] | null>(null);
  // stationId → 경유 노선(방면) — 같은 이름 상·하행 쌍둥이 구분용
  const [dirs, setDirs] = useState<Record<string, { name: string; dest: string }[]>>({});

  // 지도 초기화 — leaflet은 window를 만져 SSR 불가라 동적 import
  useEffect(() => {
    let dead = false;
    (async () => {
      const mod = await import("leaflet");
      const L = ((mod as unknown as { default?: typeof mod }).default ?? mod) as typeof mod;
      if (dead || !mapEl.current) return;
      const css = getComputedStyle(document.documentElement);
      colors.current = {
        pin: css.getPropertyValue(isDest ? "--info" : "--accent").trim(),
        onPin: isDest ? "#fff" : css.getPropertyValue("--on-accent").trim(),
        surface: css.getPropertyValue("--surface").trim(),
        ring: css.getPropertyValue("--faint").trim(),
        me: css.getPropertyValue("--info").trim(),
      };
      const dark = document.documentElement.dataset.theme === "dark";
      const map = L.map(mapEl.current, {
        center: [center.lat, center.lng],
        zoom: 16,
        zoomControl: false,
      });
      L.tileLayer(dark ? TILES.dark : TILES.light, { maxZoom: 19, attribution: ATTR }).addTo(map);
      map.on("movestart", () => setLifted(true));
      map.on("moveend", () => {
        setLifted(false);
        const c = map.getCenter();
        setPin({ lat: c.lat, lng: c.lng });
      });
      Lref.current = L;
      mapRef.current = map;
      requestAnimationFrame(() => map.invalidateSize());
      setReady(true);
    })();
    return () => {
      dead = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 핀이 멈추면 주변 정류장 갱신 (반경 밖으로 나간 선택은 해제)
  useEffect(() => {
    const id = setTimeout(() => {
      fetch(`/api/stations/around?lat=${pin.lat}&lng=${pin.lng}`)
        .then((r) => r.json())
        .then((d) => {
          const list: StationHit[] = d.stations ?? [];
          setStops(list);
          setSelected((prev) =>
            prev && !list.some((s) => s.stationId === prev.stationId) ? null : prev,
          );
        })
        .catch(() => setStops([]));
    }, 250);
    return () => clearTimeout(id);
  }, [pin]);

  // 정류장 이름 검색 (기존 /api/stations 그대로) — 2글자 미만 리셋은 onChange에서
  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(() => {
      fetch(`/api/stations?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((d) => setHits(d.stations ?? []))
        .catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  // 핀 기준 도보 시간순 정렬
  const near = (stops ?? [])
    .map((s) => ({ ...s, m: Math.round(haversineMeters(pin, s)) }))
    .sort((a, b) => a.m - b.m)
    .slice(0, 6);

  // 대상(선택 or 최근접) 정류장의 경유 노선·방면 로드 — 어느 방향 폴인지 보여줌
  const targetId = (selected ?? near[0])?.stationId;
  const dirsFetched = useRef(new Set<string>());
  useEffect(() => {
    if (!targetId || dirsFetched.current.has(targetId)) return;
    dirsFetched.current.add(targetId);
    fetch(`/api/stations/routes?stationId=${targetId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.routes) setDirs((prev) => ({ ...prev, [targetId]: d.routes }));
      })
      .catch(() => {});
  }, [targetId]);

  // 마커·도보 점선 다시 그리기
  useEffect(() => {
    const L = Lref.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;
    layerRef.current?.remove();
    const g = L.layerGroup();
    const c = colors.current;
    const target = selected ?? near[0] ?? null;
    if (target) {
      L.polyline(
        [
          [pin.lat, pin.lng],
          [target.lat, target.lng],
        ],
        { color: c.pin, weight: 2.5, dashArray: "6 6" },
      ).addTo(g);
      L.marker([(pin.lat + target.lat) / 2, (pin.lng + target.lng) / 2], {
        interactive: false,
        icon: L.divIcon({
          className: "",
          iconSize: [0, 0],
          html: `<span style="display:inline-block;transform:translate(-50%,-50%);background:${c.pin};color:${c.onPin};font-weight:800;font-size:11px;padding:3px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">도보 ${walkMinutes(pin, target)}분</span>`,
        }),
      }).addTo(g);
    }
    near.forEach((s) => {
      const isTarget = target !== null && s.stationId === target.stationId;
      const m = L.circleMarker([s.lat, s.lng], {
        radius: isTarget ? 9 : 6.5,
        color: isTarget ? c.surface : c.ring,
        weight: 2.5,
        fillColor: isTarget ? c.pin : c.surface,
        fillOpacity: 1,
      })
        .on("click", () => setSelected(s))
        .addTo(g);
      if (isTarget)
        m.bindTooltip(s.name, {
          permanent: true,
          direction: "top",
          offset: [0, -10],
          className: "yn-stop-label",
        });
    });
    if (me)
      L.circleMarker([me.lat, me.lng], {
        radius: 6,
        color: "#fff",
        weight: 2.5,
        fillColor: c.me,
        fillOpacity: 1,
      }).addTo(g);
    g.addTo(map);
    layerRef.current = g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, stops, selected, pin, me]);

  const locate = () => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const ll = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(ll);
        mapRef.current?.setView([ll.lat, ll.lng], 16);
      },
      () => {},
      { maximumAge: 60_000 },
    );
  };

  const pickHit = (s: StationHit) => {
    setQ("");
    setHits(null);
    setSelected(s);
    mapRef.current?.setView([s.lat, s.lng], 16);
  };

  const basisMe = me !== null && haversineMeters(pin, me) < 40;
  const pinColor = isDest ? "bg-info" : "bg-accent";
  const pinText = isDest ? "text-info" : "text-accent-deep";
  const pinSoft = isDest ? "bg-info-soft" : "bg-accent-soft";

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/40 lg:justify-center"
      onClick={onClose}
    >
      <div
        className="relative mx-auto flex h-[88dvh] w-full max-w-[430px] flex-col rounded-t-[24px] bg-surface lg:h-[80vh] lg:max-w-[520px] lg:rounded-[24px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 + 검색 */}
        <div className="relative z-[1200] flex flex-col gap-2.5 p-4 pb-3">
          <div className="flex items-center justify-between">
            <b className="text-base font-extrabold">
              {isDest ? "도착 정류장" : "출발 정류장"}
            </b>
            <button onClick={onClose} className="text-sm font-bold text-faint">
              닫기
            </button>
          </div>
          <div className="relative">
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim().length < 2) setHits(null);
              }}
              placeholder="정류장 이름으로 찾기 (지도를 움직여도 돼요)"
              className="w-full rounded-xl border border-line bg-bg px-4 py-3 text-sm font-medium text-ink outline-none focus:border-accent"
            />
            {hits !== null && (
              <div className="absolute inset-x-0 top-full z-[1300] mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-line bg-surface shadow-xl">
                {hits.length === 0 ? (
                  <p className="py-5 text-center text-xs font-medium text-faint">
                    검색 결과가 없어요
                  </p>
                ) : (
                  hits.map((s) => (
                    <button
                      key={`${s.stationId}-${s.mobileNo}`}
                      onClick={() => pickHit(s)}
                      className="block w-full border-b border-line px-4 py-2.5 text-left last:border-0"
                    >
                      <span className="block text-sm font-bold text-ink">{s.name}</span>
                      <span className="block text-xs font-medium text-faint">
                        {s.region}
                        {s.mobileNo && ` · ${s.mobileNo}`}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* 지도 + 중앙 고정 핀 + GPS */}
        <div className="relative min-h-0 flex-1">
          <div ref={mapEl} className="absolute inset-0" />
          <div
            className={`pointer-events-none absolute left-1/2 top-1/2 z-[1000] -translate-x-1/2 -translate-y-full transition-transform ${lifted ? "-translate-y-[calc(100%+7px)]" : ""}`}
            aria-hidden
          >
            <div
              className={`h-[26px] w-[26px] -rotate-45 rounded-[50%_50%_50%_4px] border-[2.5px] border-white shadow-md ${pinColor}`}
            >
              <div className="absolute inset-[7px] rounded-full bg-white" />
            </div>
            <div className="mx-auto mt-1 h-1 w-2 rounded-full bg-black/30" />
          </div>
          <button
            onClick={locate}
            aria-label="내 위치로 이동"
            className="absolute bottom-3 right-3 z-[1000] grid h-11 w-11 place-items-center rounded-full border border-line bg-surface text-info shadow-lg"
          >
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="3.4" />
              <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            </svg>
          </button>
        </div>

        {/* 가까운 정류장 시트 */}
        <div className="flex flex-col px-4 pb-4 pt-2.5">
          <div className="flex items-baseline gap-2">
            <b className="text-sm font-extrabold">가까운 정류장</b>
            <span
              className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${basisMe ? "bg-info-soft text-info" : `${pinSoft} ${pinText}`}`}
            >
              {basisMe ? "내 위치 기준" : "핀 위치 기준"}
            </span>
            {allowClear && (
              <button
                onClick={onClear}
                className="ml-auto text-[11.5px] font-extrabold text-bad"
              >
                도착 지정 해제
              </button>
            )}
          </div>
          <div className="mt-1 h-[212px] overflow-y-auto">
            {stops === null ? (
              <p className="py-8 text-center text-xs font-medium text-faint">
                주변 정류장을 찾는 중…
              </p>
            ) : near.length === 0 ? (
              <p className="py-8 text-center text-xs font-medium text-faint">
                근처에 정류장이 없어요 — 지도를 옮겨보세요 🐟
              </p>
            ) : (
              near.map((s, i) => {
                const sel = selected?.stationId === s.stationId;
                const isTarget = targetId === s.stationId;
                const dir = isTarget ? dirs[s.stationId] : undefined;
                return (
                  <button
                    key={`${s.stationId}-${s.mobileNo}`}
                    onClick={() => setSelected(s)}
                    className={`flex w-full items-center gap-3 rounded-xl border-b border-line px-1 py-2.5 text-left last:border-0 ${sel ? `${pinSoft} border-transparent` : ""}`}
                  >
                    <span
                      className={`grid h-[30px] w-[30px] flex-none place-items-center rounded-full text-xs font-extrabold tabular-nums ${i === 0 ? `${pinColor} ${isDest ? "text-white" : "text-on-accent"}` : "bg-track text-muted"}`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ink">
                        <span className="truncate">{s.name}</span>
                        {i === 0 && (
                          <span
                            className={`flex-none rounded-full px-1.5 py-px text-[9.5px] font-extrabold ${pinSoft} ${pinText}`}
                          >
                            가장 가까움
                          </span>
                        )}
                      </span>
                      <span className="mt-px flex items-center gap-1.5 text-[11px] font-medium text-faint">
                        {s.mobileNo && (
                          <span className="rounded-md bg-track px-1.5 text-[10px] font-bold text-muted tabular-nums">
                            {s.mobileNo}
                          </span>
                        )}
                        {s.region}
                      </span>
                      {dir && dir.length > 0 && (
                        <span className="mt-0.5 block truncate text-[10.5px] font-semibold text-muted">
                          {dir
                            .slice(0, 3)
                            .map((r) => `${r.name} ${r.dest} 방면`)
                            .join(" · ")}
                          {dir.length > 3 && ` 외 ${dir.length - 3}개`}
                        </span>
                      )}
                    </span>
                    <span className="flex-none text-right tabular-nums">
                      <b className="block text-sm font-extrabold text-ink">
                        도보 {walkMinutes(pin, s)}분
                      </b>
                      <span className="text-[10.5px] font-semibold text-faint">{s.m}m</span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 확정 CTA */}
        {selected && (
          <button
            onClick={() =>
              onSelect({
                stationId: selected.stationId,
                name: selected.name,
                lat: selected.lat,
                lng: selected.lng,
              })
            }
            className={`absolute bottom-3 left-3 right-3 z-[1100] flex items-center gap-3 rounded-2xl px-4 py-3 text-left shadow-xl ${pinColor} ${isDest ? "text-white" : "text-on-accent"}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-extrabold">{selected.name}</span>
              <span className="block text-[11px] font-semibold opacity-85">
                {isDest ? "도착" : "출발"} 정류장으로 설정 · 핀에서 도보{" "}
                {walkMinutes(pin, selected)}분
              </span>
            </span>
            <span className="flex-none rounded-xl bg-white/20 px-3.5 py-2 text-[13px] font-extrabold">
              설정
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
