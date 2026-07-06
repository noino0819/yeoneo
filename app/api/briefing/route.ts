import { NextRequest, NextResponse } from "next/server";

// F4: AI 통근 브리핑 — Gemini + 60초 캐시 + 실패 시 룰 기반 폴백
// 무료 한도(RPD) 순서대로 폴백: 3.1-flash-lite(500) → 2.5-flash-lite(20) → 룰 기반 문장
const MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite"];
const cached = new Map<string, { at: number; text: string; ai: boolean }>();
const TTL = 60_000;

const SYSTEM = `광역버스 통근 비서 '연어'의 브리핑 작성자입니다.
입력 JSON에 있는 사실만 언급하고, 과장하지 마세요.
정확히 2~3문장, 존댓말로 지금 어느 정류장에서 어떤 차를 타야 하는지 판단을 내려주세요.
destination이 있으면 그 도착 정류장 기준입니다. rideMin(분)이 있으면 승차시간과
대략적인 총 소요를 함께 언급하세요 (rideEstimated=true면 '약 N분'처럼 추정임을 표현).`;

async function gemini(data: unknown): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  let lastErr: unknown = new Error("no model tried");
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ parts: [{ text: JSON.stringify(data) }] }],
            generationConfig: { maxOutputTokens: 1000 },
          }),
        },
      );
      if (!res.ok) throw new Error(`Gemini(${model}) ${res.status}: ${await res.text()}`);
      const body = await res.json();
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error(`Gemini(${model}) empty response`);
      return text;
    } catch (e) {
      lastErr = e; // 한도 초과(429) 등 — 다음 모델로
    }
  }
  throw lastErr;
}

// AI 실패(한도 초과 등) 시에도 데모가 죽지 않게 하는 폴백 문장
// 기대 입력: { best?: { stopName, routeName, boardingProbability } }
function fallbackText(data: Record<string, unknown>): string {
  const best = data?.best as
    | { stopName?: string; routeName?: string; boardingProbability?: number }
    | undefined;
  if (best?.stopName && best?.routeName) {
    const pct = Math.round((best.boardingProbability ?? 0) * 100);
    return `지금은 ${best.stopName}에서 ${best.routeName} 탑승이 가장 유리합니다(탑승 확률 약 ${pct}%). 아래 정류장별 비교 카드를 참고하세요.`;
  }
  return "실시간 데이터 기준 아래 정류장별 비교 카드를 참고해 주세요.";
}

export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "JSON body 필요" }, { status: 400 });
  }
  // 방면 + 출발(첫 정류장) + 도착 정류장까지 캐시 키에 — 선택 바꾸면 새 브리핑
  const originName =
    Array.isArray(data.stops) && data.stops[0]?.name ? String(data.stops[0].name) : "";
  const destName = (data.destination as { name?: string } | null)?.name ?? "";
  const key = `${String(data.dest ?? "default")}:${originName}:${destName}`;
  const hit = cached.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ briefing: hit.text, ai: hit.ai, cachedAt: hit.at });
  }
  let entry: { at: number; text: string; ai: boolean };
  try {
    entry = { at: Date.now(), text: await gemini(data), ai: true };
  } catch (e) {
    console.error("briefing fallback:", e);
    entry = { at: Date.now(), text: fallbackText(data), ai: false };
  }
  cached.set(key, entry);
  return NextResponse.json({ briefing: entry.text, ai: entry.ai, cachedAt: entry.at });
}
