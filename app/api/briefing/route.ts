import { NextRequest, NextResponse } from "next/server";

// F4: AI 통근 브리핑 — Gemini + 60초 캐시 + 실패 시 룰 기반 폴백
// 3.1-flash-lite: 무료 RPD 500 (2.5-flash는 20이라 부족)
const MODEL = "gemini-3.1-flash-lite";
let cached: { at: number; text: string; ai: boolean } | null = null;
const TTL = 60_000;

const SYSTEM = `동탄 광역버스 통근 비서 '연어'의 브리핑 작성자입니다.
입력 JSON에 있는 사실만 언급하고, 과장하지 마세요.
정확히 2~3문장, 존댓말로 지금 어느 정류장에서 어떤 차를 타야 하는지 판단을 내려주세요.`;

async function gemini(data: unknown): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
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
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const text = (body.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error("Gemini empty response");
  return text;
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
  if (cached && Date.now() - cached.at < TTL) {
    return NextResponse.json({ briefing: cached.text, ai: cached.ai, cachedAt: cached.at });
  }
  const data = await req.json().catch(() => null);
  if (!data) {
    return NextResponse.json({ error: "JSON body 필요" }, { status: 400 });
  }
  try {
    const text = await gemini(data);
    cached = { at: Date.now(), text, ai: true };
  } catch (e) {
    console.error("briefing fallback:", e);
    cached = { at: Date.now(), text: fallbackText(data), ai: false };
  }
  return NextResponse.json({ briefing: cached.text, ai: cached.ai, cachedAt: cached.at });
}
