import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";

// 연어 UI.dc 2a — 선셋 OG (720×378 시안의 1200×630 스케일업, ×5/3)
export const alt = "연어 — 만석이면, 거슬러 오르세요";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const font = (weight: string) =>
  fetch(
    `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-${weight}.otf`,
  ).then((r) => r.arrayBuffer());

export default async function Image() {
  const [extraBold, semiBold, mascot] = await Promise.all([
    font("ExtraBold"),
    font("SemiBold"),
    // 이 라우트는 빌드 시 정적 생성되므로 fs 접근은 빌드 타임에만 일어남
    readFile(path.join(process.cwd(), "app/salmon/front.png")),
  ]);
  const mascotSrc = `data:image/png;base64,${mascot.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#FBF1EB",
          fontFamily: "Pretendard",
          color: "#2B2320",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 197,
            background: "#14324B",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 160,
            display: "flex",
            gap: 23,
            opacity: 0.5,
          }}
        >
          {Array.from({ length: 27 }).map((_, i) => (
            <div key={i} style={{ width: 23, height: 8, background: "#BFD7EA" }} />
          ))}
        </div>
        <img
          src={mascotSrc}
          alt=""
          width={300}
          height={Math.round((300 * 480) / 402)}
          style={{ position: "absolute", right: 107, bottom: 97 }}
        />
        <div
          style={{
            position: "absolute",
            left: 93,
            top: 107,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              background: "#FEE7DD",
              color: "#E05A43",
              fontSize: 25,
              fontWeight: 800,
              borderRadius: 99,
              padding: "12px 27px",
            }}
          >
            화성시 광역버스 통근 비서
          </div>
          <div
            style={{
              marginTop: 33,
              display: "flex",
              flexDirection: "column",
              fontSize: 97,
              fontWeight: 800,
              letterSpacing: -2.5,
              lineHeight: 1.2,
            }}
          >
            <span>만석이면,</span>
            <span>거슬러 오르세요</span>
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            left: 93,
            bottom: 67,
            display: "flex",
            alignItems: "center",
            gap: 23,
          }}
        >
          <span style={{ fontSize: 50, fontWeight: 800, color: "#FFFFFF" }}>연어</span>
          <span style={{ fontSize: 27, fontWeight: 600, color: "#8FB0CC" }}>
            실시간 잔여좌석 · AI 탑승 확률 예측
          </span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: extraBold, weight: 800 },
        { name: "Pretendard", data: semiBold, weight: 600 },
      ],
    },
  );
}
