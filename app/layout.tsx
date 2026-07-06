import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://yeoneo.vercel.app"),
  title: "연어 — 광역버스 탑승 확률 예측",
  description:
    "지금 오는 그 버스, 탈 수 있을까? 실시간 잔여좌석과 AI 예측으로 어느 정류장에서 타야 할지 알려드려요.",
  openGraph: {
    title: "연어 — 광역버스 탑승 확률 예측",
    description:
      "지금 오는 그 버스, 탈 수 있을까? 실시간 잔여좌석과 AI 예측으로 어느 정류장에서 타야 할지 알려드려요.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <link
          rel="stylesheet"
          precedence="default"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {children}
      </body>
    </html>
  );
}
