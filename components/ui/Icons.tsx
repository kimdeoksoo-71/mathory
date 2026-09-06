import React from 'react';
import { PH, PH_CORE_VERSION } from './phosphorPaths';

/**
 * M4 — 앱 전역 아이콘: Phosphor Icons regular 단일 계열 (Final_V4 D1~D5).
 *
 * - 도안은 생성 파일 `phosphorPaths.ts`(viewBox 256 · fill path)가 공급한다 — 수동 편집 금지,
 *   추가·교체는 scripts/gen-phosphor-paths.mjs의 ICONS 표에서.
 * - 획 굵기는 weight 파일이 정한다(regular = 256칸에 16). CSS·strokeWidth로 못 바꾼다.
 * - 최소 렌더 14px(D4). 14 미만 잔존(†)은 컨택트시트 판정 대상 — 임의 축소 금지.
 * - 유지 예외 3종: IconSave(자체 도안 — 저장=Firestore 확정 은유 + checked prop) ·
 *   IconGoogle · IconGithub(상표, D17). 이 셋만 viewBox 24 stroke 계열로 남는다.
 * - ⚠ 미사용 판별은 `grep -rnw IconX`(단어 경계) — JSX 태그 검색은 트리거 맵·ComponentType
 *   변수 같은 값 참조를 놓친다(IconExit 사례, Final_V4 §1-4·N8).
 * - ⚠ `.svg` 파일로 빼지 말 것 — `currentColor`가 끊긴다.
 */

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

/** Phosphor 공용 셸 — viewBox 256 · fill=currentColor. */
export function PhIcon({
  d, size = 16, color = 'currentColor', className, style,
}: { d: string; style?: React.CSSProperties } & IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color}
      className={className} style={style} aria-hidden>
      <path d={d} />
    </svg>
  );
}

/** 의미 이름 컴포넌트 팩토리 — 종별 기본 크기만 다르다. */
function phIcon(d: string, defaultSize: number) {
  return function Icon({ size = defaultSize, color = 'currentColor', className }: IconProps) {
    return <PhIcon d={d} size={size} color={color} className={className} />;
  };
}

/**
 * M5 D2 — 카탈로그 아이콘: `public/icons/phosphor/<ver>/`의 정적 SVG를 CSS mask로 씌워
 * `currentColor`를 유지한다("`.svg`로 빼면 currentColor가 끊긴다"는 `<img>` 얘기 — mask는
 * alpha만 쓰고 색은 background-color가 공급). **사용자 선택 폴더 아이콘 전용** — UI 상시
 * 아이콘은 계속 인라인 path(PhIcon: 첫 페인트 fetch 0). 404는 빈칸이 된다(mask엔 onError가
 * 없다) — 방어는 쓰기(피커가 인덱스 이름만)·읽기(isPhosphorIconName 불일치 → 기본 아이콘)에서.
 */
export function PhAsset({ name, weight = 'regular', size = 16, title }: {
  name: string; weight?: 'regular' | 'bold'; size?: number; title?: string;
}) {
  const url = `/icons/phosphor/${PH_CORE_VERSION}/${weight}/${name}${weight === 'bold' ? '-bold' : ''}.svg`;
  const mask = `url("${url}") center / contain no-repeat`;
  return (
    <span
      {...(title ? { role: 'img', 'aria-label': title, title } : { 'aria-hidden': true })}
      style={{
        display: 'inline-block', width: size, height: size, flexShrink: 0,
        backgroundColor: 'currentColor', WebkitMask: mask, mask,
      }}
    />
  );
}

/** 카탈로그 자산 URL — Sidebar의 bold 예열 fetch가 공유한다(M5 Q3). */
export function phAssetUrl(name: string, weight: 'regular' | 'bold'): string {
  return `/icons/phosphor/${PH_CORE_VERSION}/${weight}/${name}${weight === 'bold' ? '-bold' : ''}.svg`;
}

/* ═══ 내비게이션·셸 ═══ */
export const IconSidebar = phIcon(PH.sidebarSimple, 20);
export const IconSearch = phIcon(PH.magnifyingGlass, 18);
/** D11 — 툴바 찾기/바꾸기·IconSearch와 한 도안. AIBrandIcon(verify 폴백)이 소비한다. */
export const IconSearchPlain = IconSearch;
export const IconBazaar = phIcon(PH.storefront, 18);
export const IconRecent = phIcon(PH.clock, 18);
export const IconFolder = phIcon(PH.folder, 18);
export const IconInbox = phIcon(PH.tray, 14);
export const IconChevron = phIcon(PH.caretRight, 14);
export const IconChevronLeft = phIcon(PH.caretLeft, 16);
export const IconChevronDown = phIcon(PH.caretDown, 14);

/* ═══ 편집·문항 조작 ═══ */
export const IconPlus = phIcon(PH.plus, 18);
export const IconUndo = phIcon(PH.arrowUUpLeft, 18);
export const IconRedo = phIcon(PH.arrowUUpRight, 18);
export const IconEdit = phIcon(PH.pencilSimple, 14);
export const IconRename = phIcon(PH.cursorText, 14);
export const IconFolderMove = phIcon(PH.folderMove, 14);
export const IconTrash = phIcon(PH.trash, 14);
export const IconClose = phIcon(PH.x, 16);
export const IconCopy = phIcon(PH.copy, 14);
export const IconCheck = phIcon(PH.check, 14);
export const IconDownload = phIcon(PH.downloadSimple, 14);
export const IconGrip = phIcon(PH.dotsSixVertical, 14);
export const IconDotsVertical = phIcon(PH.dotsThreeVertical, 16);
/** D22 — 현행 IconDots도 도안이 세로 점 3개였다. 별칭으로 통합(이름만 유지). */
export const IconDots = IconDotsVertical;
export const IconShare = phIcon(PH.share, 14);
export const IconComment = phIcon(PH.chatText, 14);
export const IconBlockchain = phIcon(PH.graph, 14);
export const IconDocLines = phIcon(PH.fileText, 14);
export const IconCoachImportant = phIcon(PH.chatCenteredText, 14);
/** 문단 가로폭(SizeStepper 라벨). M3의 27×15 비정방 예외는 M4에서 폐기 — 정방 24(§4-5). */
export const IconTextWidth = phIcon(PH.textWidth, 24);
/** M5 D8 — "Agent" 글자 라벨(검수 13차 확정)을 대체한 아이콘. 옆 IconComment와 같은 크기로. */
export const IconAgent = phIcon(PH.legoSmiley, 14);
/** M5 D9 — AIBrandIcon의 '🤖' 글자 폴백 대체. */
export const IconRobot = phIcon(PH.robot, 14);

/** 로딩 스피너 — circle-notch 회전. animateTransform은 회전 대상(<path>)의 자식이어야 한다(D14). */
export function IconLoader({ size = 14, color = 'currentColor', className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill={color} className={className} aria-hidden>
      <path d={PH.circleNotch}>
        <animateTransform attributeName="transform" type="rotate"
          from="0 128 128" to="360 128 128" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/**
 * 저장 — 클라우드(Firestore 확정) + 체크(저장 완료). **유지 예외(D6, 덕수 확정)** — 이 앱의
 * 저장은 실제로 Firestore 확정을 뜻하므로 도안을 동작에 맞췄다(Phase 55c).
 * checked=false면 구름만 → 미저장(dirty). ListView 수정일 칸의 상태 표시기로도 쓰인다(3:1 규약).
 * ⚠️ IconCheck(단독 체크)와 용도가 다르다 — 여기 체크는 "구름 안의 완료 표시"다.
 */
export function IconSave({ size = 18, color = 'currentColor', checked = true }:
  IconProps & { checked?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 구름 (Feather cloud) */}
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      {/* 체크 좌표는 미리보기(48·18·14·12px) 검수로 확정 — 임의 조정 금지. */}
      {checked && <path d="M5.6 11.8 8 14.2 12.4 9.8" />}
    </svg>
  );
}

/* ═══ 버전 관리 (Phase 55b — 트리거 맵이 컴포넌트 값으로 참조한다) ═══ */

/** 편집 종료 자동 저장 트리거(editor_exit). D23 — sign-out(문+나가는 화살표). */
export const IconExit = phIcon(PH.exit, 14);
/** 이름 저장(named 버전). */
export const IconTag = phIcon(PH.tag, 14);
/** 버전 복원. ⚠ IconUndo(블록 편집 되돌리기)와 의미·도안 모두 별개 — 바꿔 쓰지 말 것. */
export const IconRestore = phIcon(PH.clockCounterClockwise, 14);

/** 버전 고정(pin). 켜짐은 Phosphor fill weight — "켜짐은 fill" 원칙의 공식 대응(D13). */
export function IconPin({ size = 14, color = 'currentColor', className, filled = false }:
  IconProps & { filled?: boolean }) {
  return <PhIcon d={filled ? PH.pushPinFill : PH.pushPin} size={size} color={color} className={className} />;
}

/* ═══ 브랜드 마크 — 유지 예외(D17). 상표는 아이콘 라이선스와 무관, 변형 금지 ═══ */

export function IconGoogle({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/**
 * GitHub 공식 마크(Invertocat). 버전 내보내기 버튼·배지에 쓴다. (GitHub 브랜드 가이드라인은
 * GitHub 연동을 나타내는 용도의 마크 사용을 허용한다. 변형·다른 서비스 돌려쓰기 금지.)
 */
export function IconGithub({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}
