export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold">
        연어 <span aria-hidden>🐟</span>
      </h1>
      <p className="text-lg text-balance">
        광역버스를 타기위해 오늘도 정류장을 거슬러오르는 모든 연어들을 위하여
      </p>
      <p className="max-w-md text-sm text-gray-500 text-balance">
        실시간 잔여좌석과 AI 예측으로 지금 어느 정류장에서 어떤 버스를 타야
        하는지 알려드리는 통근 비서입니다.
      </p>
      <p className="rounded-full border px-4 py-1 text-xs text-gray-400">
        실시간 데이터 연동 준비 중
      </p>
    </main>
  );
}
