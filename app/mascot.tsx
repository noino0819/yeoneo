// 연어 마스코트 — 연어 UI.dc 원본 SVG 좌표. 몸통은 --accent로 다크 모드 자동 대응.

type Props = { width: number; className?: string };

/** 기본 마스코트. hero면 등지느러미·배·볼터치·눈 하이라이트 추가 (헤더용) */
export function Salmon({ width, className, hero }: Props & { hero?: boolean }) {
  return (
    <svg width={width} viewBox="0 0 88 68" className={className} aria-hidden>
      <polygon points="60,34 86,12 79,34 86,56" fill="#E05A43" />
      {hero && <polygon points="28,10 44,2 47,16" fill="#E05A43" />}
      <ellipse cx="34" cy="36" rx="33" ry="26" fill="var(--accent)" />
      {hero && <ellipse cx="30" cy="47" rx="23" ry="12" fill="#FFC9B2" />}
      <circle cx="19" cy="31" r="9" fill="#FFFFFF" />
      <circle cx="21" cy="32" r="4.6" fill="#33251F" />
      {hero && <circle cx="23" cy="30" r="1.7" fill="#FFFFFF" />}
      <circle cx="45" cy="31" r="9" fill="#FFFFFF" />
      <circle cx="47" cy="32" r="4.6" fill="#33251F" />
      {hero && <circle cx="49" cy="30" r="1.7" fill="#FFFFFF" />}
      <ellipse cx="33" cy="45" rx="4" ry="2.6" fill="#C2492F" />
      {hero && <circle cx="10" cy="41" r="3.6" fill="#FFA98C" />}
      {hero && <circle cx="56" cy="41" r="3.6" fill="#FFA98C" />}
    </svg>
  );
}

/** 외눈 미니 연어 — 로더·강 위를 헤엄치는 용도 */
export function SalmonMini({ width, className, flip }: Props & { flip?: boolean }) {
  return (
    <svg
      width={width}
      viewBox="0 0 88 68"
      className={`${flip ? "-scale-x-100 " : ""}${className ?? ""}`}
      aria-hidden
    >
      <polygon points="60,34 86,12 79,34 86,56" fill="#E05A43" />
      <ellipse cx="34" cy="36" rx="33" ry="26" fill="var(--accent)" />
      <circle cx="22" cy="31" r="8" fill="#FFFFFF" />
      <circle cx="24" cy="32" r="4" fill="#33251F" />
    </svg>
  );
}

/** 시무룩 연어 — 에러 상태 */
export function SalmonSad({ width, className }: Props) {
  return (
    <svg width={width} viewBox="0 0 88 68" className={className} aria-hidden>
      <polygon points="60,34 86,12 79,34 86,56" fill="#D8998C" />
      <ellipse cx="34" cy="36" rx="33" ry="26" fill="#EFA192" />
      <ellipse cx="30" cy="47" rx="23" ry="12" fill="#FAD3C4" />
      <circle cx="19" cy="31" r="9" fill="#FFFFFF" />
      <circle cx="21" cy="34" r="4.6" fill="#33251F" />
      <circle cx="45" cy="31" r="9" fill="#FFFFFF" />
      <circle cx="47" cy="34" r="4.6" fill="#33251F" />
      <ellipse cx="33" cy="46" rx="3" ry="2" fill="#B06A57" />
    </svg>
  );
}

/** 잠자는 연어 — 빈 상태 */
export function SalmonSleep({ width, className }: Props) {
  return (
    <svg width={width} viewBox="0 0 88 68" className={className} aria-hidden>
      <polygon points="60,34 86,12 79,34 86,56" fill="#B8C7D4" />
      <ellipse cx="34" cy="36" rx="33" ry="26" fill="#C9D6E1" />
      <ellipse cx="30" cy="47" rx="23" ry="12" fill="#E4EBF1" />
      <path d="M13 31 L25 31" stroke="#33251F" strokeWidth="3" strokeLinecap="round" />
      <path d="M39 31 L51 31" stroke="#33251F" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="33" cy="45" rx="3" ry="2" fill="#8AA0B2" />
    </svg>
  );
}
