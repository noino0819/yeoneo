<div align="center">

<img src="docs/header.svg" width="100%" alt="연어 — 만석이면, 거슬러 오르세요" />

<br/><br/>

**연어는 상류로 거슬러 올라요. 만석 버스 앞의 당신도요.**

집 앞 정류장에선 맨날 만석인 광역버스도, 몇 정류장만 거슬러 올라가면 자리가 있어요.
실시간 잔여좌석과 예측으로 **어디서 타야 앉아서 출근하는지** 알려주는 PWA예요.

<br/>

[![Live](https://img.shields.io/badge/yeoneo.vercel.app-f97862?style=for-the-badge&logo=vercel&logoColor=white)](https://yeoneo.vercel.app)

![Next.js 16](https://img.shields.io/badge/Next.js_16-0e1b27?style=flat-square&logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-0e1b27?style=flat-square&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-0e1b27?style=flat-square&logo=typescript&logoColor=3178C6)
![Tailwind CSS 4](https://img.shields.io/badge/Tailwind_4-0e1b27?style=flat-square&logo=tailwindcss&logoColor=06B6D4)
![Leaflet](https://img.shields.io/badge/Leaflet-0e1b27?style=flat-square&logo=leaflet&logoColor=8ed081)
![PWA](https://img.shields.io/badge/PWA-0e1b27?style=flat-square&logo=pwa&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini_브리핑-0e1b27?style=flat-square&logo=googlegemini&logoColor=8E75B2)

</div>

<img src="docs/wave.svg" width="100%" alt="" />

## 📱 미리보기

<table>
<tr>
<td width="33%" valign="top"><img src="docs/shots/shot-light.png" alt="라이트 — 실시간 정류장 보드" /></td>
<td width="33%" valign="top"><img src="docs/shots/shot-dark.png" alt="다크 — 딥리버 스킨" /></td>
<td width="33%" valign="top"><img src="docs/shots/shot-picker.png" alt="지도 기반 정류장 픽커" /></td>
</tr>
<tr>
<td align="center"><sub>☀️ 선셋새먼 보드, 잔여좌석·탑승확률</sub></td>
<td align="center"><sub>🌙 딥리버 다크</sub></td>
<td align="center"><sub>🗺️ 지도 정류장 픽커</sub></td>
</tr>
</table>

<img src="docs/wave.svg" width="100%" alt="" />

## 🐟 왜 "연어"인가요?

<img align="right" src="app/salmon/sad.png" width="128" alt="만석 버스를 보낸 시무룩한 연어" />

출근길에 버스가 들어와요. 만석이에요. 다음 버스도, 그다음 버스도.

그런데 두세 정류장만 거슬러 올라가면 아직 자리가 남아 있거든요.
연어가 강을 거슬러 오르듯 몇 분 걸어 올라가서 앉아 갈지, 그냥 기다릴지.
그 계산을 대신 해주는 앱이에요.

- 지금 오는 버스에 좌석이 몇 개 남았는지
- 내 정류장에 도착할 때쯤엔 몇 석이나 남을지
- 만석이면 어디까지 걸어 올라가는 게 제일 빨리 앉아 가는 길인지

<br/>

<img src="docs/wave.svg" width="100%" alt="" />

## ✨ 핵심 기능

<table>
<tr>
<td width="50%" valign="top">

### 🚏 F1 · 실시간 정류장 보드

노선별 잔여좌석을 실시간 카드로 보여줘요. 방향 탭으로 상·하행을 오가고,
당겨서 새로고침. 25초마다 갱신하는데 한가한 시간대엔 알아서 느려져요.
API 쿼터가 터져도 보드가 통째로 죽는 대신 배너 하나 띄우고 버텨요.

</td>
<td width="50%" valign="top">

### 🔮 F2 · 도달 시 좌석 예측

지금 좌석 수는 사실 별 의미가 없어요. 중요한 건 **버스가 내 앞에 올 때쯤
몇 석 남느냐**죠. 시간대 · 배차간격 · 상류 정류장 수 · 최근 통과 대수 ·
2층버스 여부를 넣은 룰 기반 모델로 탑승확률을 계산하고, 왜 그렇게
판단했는지 근거도 같이 보여줘요.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🐟 F3 · 연어 모드

만석일 것 같으면 상류 정류장을 하나씩 거슬러 올라가며 따져봐요.
도보 시간(하버사인 · 4km/h)까지 합친 총 통근시간으로 비교해서
"3정거장 올라가면 12분 손해 보고 앉아 간다" 같은 답을 줘요.

</td>
<td width="50%" valign="top">

### 🤖 F4 · AI 브리핑

오늘 아침 상황을 한 문단으로 요약해줘요.
Gemini 3.1-flash-lite가 안 되면 2.5-flash-lite로, 그것도 안 되면
룰 기반으로 넘어가서 브리핑이 안 나오는 날은 없어요.

</td>
</tr>
</table>

<img src="docs/wave.svg" width="100%" alt="" />

## 🌊 연어 모드는 이렇게 돌아가요

<div align="center">
<img src="docs/salmon-run.svg" width="100%" alt="연어 모드 다이어그램 — 만석인 내 정류장에서 좌석이 남은 상류 정류장으로 거슬러 오르기" />
</div>

1. 출발 정류장이 만석일 것 같다 싶으면
2. 노선을 거슬러 올라가며 정류장마다 도착 시점 좌석을 예측하고
3. `도보 + 대기 + 승차` 시간을 다 합쳐서 제일 빨리 앉아 가는 출발지를 골라줘요

<div align="center">
<img src="docs/shots/shot-salmon.png" width="480" alt="연어 모드 실제 화면 — 상류 정류장별 도보시간·탑승확률 비교와 추천" />

<sub>🐟 실제 화면. 체인 위를 헤엄치는 연어와 정류장별 확률 비교</sub>
</div>

<details>
<summary><b>🧮 예측 공식 자세히 보기</b></summary>

<br/>

정류장당 승차 인원을 도착률로 추정하고, 탑승확률은 승차 수요를
포아송 과정으로 보고 정규근사로 계산해요.

```
정류장당 승차 = (시간대별 base ÷ 전형 배차간격) × 실제 배차간격 − 최근통과 완화
             × (2층버스면 좌석공급 완화 계수)

예상 승차 λ  = 정류장당 승차 × 상류 정류장 수
도달 시 좌석 = 현재 잔여좌석 − λ
탑승확률    = Φ( 도달 시 좌석 ÷ √(φ·λ) )     # 승차 ~ Poisson(λ), φ = 과산포 계수
```

계수는 [constants/stops.ts](constants/stops.ts)의 `PREDICT_COEF`에 모여 있고,
[scripts/check-predict.ts](scripts/check-predict.ts)로 검증해요.
`base`와 `φ`는 감으로 정한 값이 아니에요. 출근시간 녹화(`npm run record`)에서
버스를 차량번호로 추적해 정류장당 실제 승차를 재고, `npm run fit`이
계수 제안과 현행 대비 백테스트 오차(MAE)를 뽑아줘요.

**실전 예시: 서울역행 M4130.** 아침 녹화 실측 기준으로 이 동네에서 제일 빡센
노선이에요. 정류장당 ~3.4명을 태우고(강남 방면 6001·6003은 1.8~2.2명),
강남행은 24~34석씩 남겨 오는데 얘는 잔여좌석 중앙값 7석, 만석 직전으로
들어와요. 잔여 20석 · 5정거장 전 · 배차 10분(피크)이라면:

```
정류장당 승차 = (2 ÷ 10) × 10 = 2명      →  λ = 2 × 5 = 10명
도달 시 좌석 = 20 − 10 = 10석
탑승확률    = Φ( 10 ÷ √(5.4 × 10) ) = Φ(1.36) ≈ 91%
```

실측상 M4130은 평균보다 1.5배 빠르게 차서 체감은 이보다 빠듯해요.
그래서 다음 튜닝 후보가 노선별 계수 분리예요.

</details>

<img src="docs/wave.svg" width="100%" alt="" />

## 🗺️ 이런 것도 돼요

|  |  |
|:--:|:--|
| 🗺️ | **지도 정류장 픽커**: 핀 주변 정류소 · 도보시간 · GPS · 검색 통합, 방면 표시로 상·하행 쌍둥이 정류장 구분 |
| 📍 | **현위치 원탭 출발**: 지금 서 있는 곳에서 가장 가까운 정류장을 한 번에 출발지로 |
| 🔁 | **출발/도착 입력 패널**: 네이버 길찾기식 두 행 카드 + 스왑 버튼 |
| 📲 | **PWA 설치**: `beforeinstallprompt` 자체 버튼 + iOS 수동 안내, maskable 아이콘 |
| 🌙 | **다크모드**: 선셋새먼 라이트 / 딥리버 다크 스킨 (기본 라이트) |
| 📼 | **리플레이 모드**: 출근시간 녹화 fixture를 12배속 타임라인으로 재생, 정직 표기 배너 |

<img src="docs/wave.svg" width="100%" alt="" />

## 🚀 시작하기

<img align="right" src="app/salmon/point.png" width="120" alt="가이드하는 연어" />

```bash
git clone https://github.com/noino0819/yeoneo.git
cd yeoneo
npm install
```

`.env.local`에 키 두 개:

```bash
GG_BUS_API_KEY=공공데이터포털_인증키   # 경기도 버스정보 v2 (도착·위치·노선·정류소) 활용신청
GEMINI_API_KEY=Gemini_API_키          # 없어도 됨, 룰 기반 브리핑으로 폴백
```

```bash
npm run dev   # http://localhost:3000
```

### 스크립트

| 명령 | 설명 |
|:--|:--|
| `npm run dev` | 개발 서버 |
| `npm run record` | 출근시간 도착정보 녹화 (HOME + 상류 체인 동시) |
| `npm run fit` | 녹화에서 예측 계수 실측 피팅 + 백테스트 |
| `npm run check` | 좌석 예측 로직 검증 |
| `npm run setup:constants` | 정류장 · 노선 상수 셋업 |

## 📁 구조

```
app/
├─ api/                 # 경기버스 API 프록시 (arrivals · vehicles · predict · briefing · salmon · replay …)
├─ page.tsx             # 메인 보드 (F1~F4)
├─ station-picker.tsx   # 지도 기반 정류장 픽커 (Leaflet)
└─ salmon/              # 마스코트 🐟
constants/stops.ts      # HOME_STOP · 예측 계수 · 노선 태그
lib/
├─ ggbus.ts             # 경기도 버스정보 API 클라이언트
├─ predict.ts           # F2 좌석 예측 (룰 기반, 순수함수)
├─ salmon.ts            # F3 상류 체인 조립 (라이브·리플레이 공유)
└─ walk.ts              # 하버사인 도보 시간
scripts/                # 녹화 · 피팅 · 검증 · 상수 셋업
fixtures/               # 리플레이용 녹화 데이터
```

> 데이터 출처: [공공데이터포털](https://www.data.go.kr) 경기도 버스정보 서비스 v2

<img src="docs/wave.svg" width="100%" alt="" />

<div align="center">
<br/>

<img src="app/salmon/front.png" width="140" alt="연어 마스코트" />

**오늘도 앉아서 출근하세요 🎫**

만석 버스를 세 대 보낸 어느 통근러가 만들었습니다

</div>
