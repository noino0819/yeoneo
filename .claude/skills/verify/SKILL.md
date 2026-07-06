---
name: verify
description: 연어 앱 변경을 실제로 띄워서 눈으로 확인하는 레시피 (dev 서버 + puppeteer-core 스크린샷)
---

# 연어 verify 레시피

## 빌드·기동
- `npm run build` — 타입체크 포함. opengraph-image는 빌드 시 Pretendard OTF를 CDN에서 fetch하므로 네트워크 필요.
- `npm run dev -- -p 3457` (백그라운드). `.env.local`에 GG_BUS_API_KEY·GEMINI_API_KEY 있음 — 라이브 API 동작.

## API 스모크
- `curl "localhost:3457/api/replay?i=0&dest=gangnam"` — fixture 재생 (키 없이도 동작)
- `curl "localhost:3457/api/arrivals?stationId=233000121"` — 라이브 GBIS
- `curl localhost:3457/opengraph-image -o og.png` — OG 이미지

## 화면 캡처 — 반드시 puppeteer-core
`chrome --headless=new --screenshot`은 이 머신에서 ~1.1× 스케일로 그려 가짜 오버플로가 보인다. 믿지 말 것.
스크래치패드에 `npm i puppeteer-core` 후 `executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`로 실행.
- `page.emulateMediaFeatures([{name:"prefers-color-scheme", value:"dark"}])` — 1b 다크 스킨 확인
- viewport 390(모바일 1a) / 1200(데스크톱 1d)
- 리플레이: `리플레이` 텍스트 포함 버튼 click → 배너·fixture 데이터 확인
- 탭 전환: `서울역` 포함 버튼 click → 강북 방면·환승 대안 확인

## 주의
- salmon(/api/salmon)이 GBIS 플레이크로 한 틱 빌 수 있음 — 카드에 확률 바 없이 뜨는 건 정상 (다음 폴링에 채워짐)
- 심야엔 도착정보가 비어 빈 상태 카드가 뜸 — 리플레이 모드로 데이터 있는 화면 확인
