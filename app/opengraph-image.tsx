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
  const [extraBold, semiBold] = await Promise.all([
    font("ExtraBold"),
    font("SemiBold"),
  ]);
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
        <svg
          style={{ position: "absolute", right: 107, bottom: 97 }}
          width={317}
          viewBox="0 0 88 68"
        >
          <polygon points="60,34 86,12 79,34 86,56" fill="#E05A43" />
          <polygon points="28,10 44,2 47,16" fill="#E05A43" />
          <ellipse cx="34" cy="36" rx="33" ry="26" fill="#F97862" />
          <ellipse cx="30" cy="47" rx="23" ry="12" fill="#FFC9B2" />
          <circle cx="19" cy="31" r="9" fill="#FFFFFF" />
          <circle cx="21" cy="32" r="4.6" fill="#33251F" />
          <circle cx="23" cy="30" r="1.7" fill="#FFFFFF" />
          <circle cx="45" cy="31" r="9" fill="#FFFFFF" />
          <circle cx="47" cy="32" r="4.6" fill="#33251F" />
          <circle cx="49" cy="30" r="1.7" fill="#FFFFFF" />
          <ellipse cx="33" cy="44" rx="4" ry="2.6" fill="#C2492F" />
          <circle cx="10" cy="41" r="3.6" fill="#FFA98C" />
          <circle cx="56" cy="41" r="3.6" fill="#FFA98C" />
        </svg>
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
