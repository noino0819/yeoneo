// 연어 마스코트 — 연어 UI.dc v2 PNG 에셋 (app/salmon/*). static import로 치수 자동.
import Image, { type StaticImageData } from "next/image";
import front from "./salmon/front.png";
import point from "./salmon/point.png";
import swim from "./salmon/swim.png";
import sad from "./salmon/sad.png";

type Props = { width: number; className?: string };

function pic(src: StaticImageData, { width, className }: Props, style?: React.CSSProperties) {
  return (
    <Image
      src={src}
      alt=""
      className={className}
      style={{ width, height: "auto", ...style }}
      aria-hidden
    />
  );
}

/** 정면 마스코트 — 헤더·히어로 */
export const Salmon = (p: Props) => pic(front, p);

/** 가리키는 연어 — AI 브리핑 */
export const SalmonPoint = (p: Props) => pic(point, p);

/** 헤엄치는 연어 — 로더·강 */
export const SalmonMini = (p: Props) => pic(swim, p);

/** 시무룩 연어 — 에러 상태 */
export const SalmonSad = (p: Props) => pic(sad, p);

/** 잠자는 연어 — 빈 상태 (시무룩 + 흑백 처리, UI.dc 3b) */
export const SalmonSleep = (p: Props) =>
  pic(sad, p, { filter: "grayscale(0.85) opacity(0.55)" });
