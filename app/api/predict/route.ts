import { NextRequest, NextResponse } from "next/server";
import { predictBoarding, type PredictInput } from "@/lib/predict";

// F2: 좌석 예측 스코어링. body: { inputs: PredictInput[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const inputs = body?.inputs as PredictInput[] | undefined;
  if (!Array.isArray(inputs) || inputs.length > 100) {
    return NextResponse.json({ error: "inputs 배열 필요 (최대 100개)" }, { status: 400 });
  }
  return NextResponse.json({ predictions: inputs.map(predictBoarding) });
}
