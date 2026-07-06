import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 리플레이 fixture를 서버리스 번들에 포함 (fs 동적 읽기라 트레이싱이 못 잡음)
  outputFileTracingIncludes: { "/api/replay": ["./fixtures/**"] },
};

export default nextConfig;
