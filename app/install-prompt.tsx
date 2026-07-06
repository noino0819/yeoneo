"use client";

import { useEffect, useState } from "react";

// 설치 유도: 안드로이드/PC는 beforeinstallprompt를 잡아 자체 버튼으로 프롬프트,
// iOS는 수동 안내 (Safari엔 설치 API가 없음). 한 번 닫으면 다시 안 뜸.

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export default function InstallPrompt() {
  const [bip, setBip] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("yn-install") === "done") return;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return; // 이미 앱으로 실행 중

    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      const t = setTimeout(() => setIos(true), 2_500);
      return () => clearTimeout(t);
    }
    const h = (e: Event) => {
      e.preventDefault();
      setBip(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const dismiss = () => {
    localStorage.setItem("yn-install", "done");
    setBip(null);
    setIos(false);
  };

  if (!bip && !ios) return null;
  return (
    <div className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-fit max-w-[92%] items-center gap-3 rounded-full border border-line bg-surface px-4 py-2.5 text-[13px] shadow-[0_4px_18px_rgba(60,30,20,0.18)]">
      {bip ? (
        <>
          <span className="whitespace-nowrap">📲 홈 화면에 앱으로 설치할 수 있어요</span>
          <button
            className="whitespace-nowrap rounded-full bg-accent px-3 py-1 font-bold text-white"
            onClick={() => {
              bip.prompt();
              dismiss();
            }}
          >
            설치
          </button>
        </>
      ) : (
        <span>
          📲 <b>공유</b> 버튼 → <b>홈 화면에 추가</b>로 앱처럼 쓸 수 있어요
        </span>
      )}
      <button className="px-1 text-faint" onClick={dismiss} aria-label="닫기">
        ✕
      </button>
    </div>
  );
}
