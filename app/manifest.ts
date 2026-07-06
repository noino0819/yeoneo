import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "연어 — 광역버스 탑승 확률 예측",
    short_name: "연어",
    description:
      "실시간 잔여좌석과 AI 예측으로 어느 정류장에서 타야 할지 알려드려요.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf1eb",
    theme_color: "#f97862",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
