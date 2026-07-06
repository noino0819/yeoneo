import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 리플레이 fixture를 서버리스 번들에 포함 (fs 동적 읽기라 트레이싱이 못 잡음)
  outputFileTracingIncludes: { "/api/replay": ["./fixtures/**"] },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 위치는 이 앱 자신만, 나머지 민감 센서는 차단
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
