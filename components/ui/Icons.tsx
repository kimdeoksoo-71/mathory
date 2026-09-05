import React from 'react';

interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

const defaultProps: IconProps = { size: 18, color: 'currentColor' };

export function IconSidebar({ size = 20, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

/**
 * 돋보기 — 툴바 '찾기/바꾸기'(`UnifiedToolbar`의 `SearchReplaceIcon`)에서 **코너 브라켓만 뺀** 것.
 * 그쪽은 viewBox 64 · stroke 3.5에 브라켓이 상자를 채우므로, 단독으로 쓰려면 글리프를
 * 24 상자에 맞춰 다시 그려야 한다(비율은 원 r : 손잡이 ≈ 1 : 0.9로 동일하게 유지).
 * ⚠️ `.svg` 파일로 빼지 말 것 — `currentColor`가 끊긴다.
 */
export function IconSearchPlain({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="10.8" cy="10.8" r="6.4" />
      <path d="M15.4 15.4 L20 20" />
    </svg>
  );
}

export function IconBlockchain({ size = 14, color = 'currentColor' }: IconProps) {
  // 2D 플랫 — 둥근 사각형 3개를 삼각형 배치로 연결
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {/* 상단 사각형 */}
      <rect x="8.5" y="1.5" width="7" height="7" rx="1.5" />
      {/* 좌하단 사각형 */}
      <rect x="1.5" y="15.5" width="7" height="7" rx="1.5" />
      {/* 우하단 사각형 */}
      <rect x="15.5" y="15.5" width="7" height="7" rx="1.5" />
      {/* 상단 → 좌하단 */}
      <line x1="10" y1="8.5" x2="6.5" y2="15.5" />
      {/* 상단 → 우하단 */}
      <line x1="14" y1="8.5" x2="17.5" y2="15.5" />
      {/* 좌하단 → 우하단 */}
      <line x1="8.5" y1="19" x2="15.5" y2="19" />
    </svg>
  );
}

// Phase 52: Bazaar(공용 광장) — 차양 천막(장터) 아이콘
export function IconBazaar({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 4 L21 4 L21 8 L3 8 Z" />                              {/* 차양 틀 */}
      <path d="M3 8 q3 3 6 0 q3 -3 6 0 q3 3 6 0 q3 -3 6 0" />            {/* 차양 물결 */}
      <path d="M5 8 L5 20 M19 8 L19 20 M5 20 L19 20" />                 {/* 좌우 벽 + 바닥 */}
      <path d="M10 20 L10 14 L14 14 L14 20" />                          {/* 출입구 */}
    </svg>
  );
}

export function IconPlus({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconSearch({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}

export function IconFolder({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 7c0-1.1.9-2 2-2h4l2 2h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7z" />
    </svg>
  );
}

export function IconRecent({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <polyline points="12,7 12,12 15.5,14" />
    </svg>
  );
}

// Phase 55a: 굽은 화살표 실행취소/재실행
export function IconUndo({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a4.5 4.5 0 1 1 0 9H9" />
    </svg>
  );
}

export function IconRedo({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 14l5-5-5-5" />
      <path d="M20 9H9.5a4.5 4.5 0 1 0 0 9H15" />
    </svg>
  );
}

export function IconUser({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

export function IconDots({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="6" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="18" r="1.5" />
    </svg>
  );
}

export function IconChevron({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="9,6 15,12 9,18" />
    </svg>
  );
}

export function IconChevronLeft({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="15,18 9,12 15,6" />
    </svg>
  );
}

export function IconChevronDown({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="6,9 12,15 18,9" />
    </svg>
  );
}

export function IconEdit({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
      <path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function IconRename({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconFolderMove({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M3 7c0-1.1.9-2 2-2h4l2 2h8c1.1 0 2 .9 2 2v8c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V7z" />
      <polyline points="12,11 12,17" />
      <polyline points="9,14 12,11 15,14" />
    </svg>
  );
}

export function IconTrash({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

/**
 * 저장 — 클라우드(Firestore 확정) + 체크(저장 완료).
 * Phase 55c: 플로피디스크를 폐기했다. 이 앱의 저장은 실제로 Firestore 확정을 뜻하므로
 * (SaveStatus 주석 참조) 도안을 동작에 맞췄다.
 *
 * checked=false면 구름만 → 미저장(dirty) 상태.
 * ⚠️ IconCheck(단독 체크 — 복사 완료 등)와 용도가 다르다. 여기 체크는 "구름 안의 완료 표시"다.
 */
export function IconSave({ size = 18, color = 'currentColor', checked = true }:
  IconProps & { checked?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 구름 (Feather cloud) */}
      <path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z" />
      {/* 체크 = 저장 완료. 구름 왼쪽 로브(중심 9,12 · r8) 안쪽에 시각 중심 정렬.
          좌표는 미리보기(48·18·14·12px) 검수로 확정 — 임의 조정 금지. */}
      {checked && <path d="M5.6 11.8 8 14.2 12.4 9.8" />}
    </svg>
  );
}

export function IconExit({ size = 18, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 상자 — 오른쪽이 열려 화살표가 빠져나감 */}
      <path d="M13 4 H6 a2 2 0 0 0 -2 2 V18 a2 2 0 0 0 2 2 h7" />
      {/* 오른쪽으로 나가는 화살표 */}
      <path d="M10 12 H21" />
      <path d="M17.5 8.5 L21 12 L17.5 15.5" />
    </svg>
  );
}

export function IconClose({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

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

/* ═══ Sprint 2 신규 아이콘 ═══ */

export function IconGrip({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="8" x2="20" y2="8" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="16" x2="20" y2="16" />
    </svg>
  );
}

export function IconSplit({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="12" x2="20" y2="12" />
      <polyline points="8,8 4,12 8,16" />
      <polyline points="16,8 20,12 16,16" />
    </svg>
  );
}

export function IconSplitAll({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="8" x2="20" y2="8" />
      <polyline points="8,5 4,8 8,11" />
      <polyline points="16,5 20,8 16,11" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <polyline points="8,13 4,16 8,19" />
      <polyline points="16,13 20,16 16,19" />
    </svg>
  );
}

export function IconImage({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21,15 16,10 5,21" />
    </svg>
  );
}

export function IconBox({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="14" y2="12" />
    </svg>
  );
}

export function IconCopy({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  );
}

export function IconTrashEmpty({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  );
}

export function IconCheck({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4,12 9,17 20,6" />
    </svg>
  );
}

export function IconDotsVertical({ size = 16, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

export function IconDownload({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export function IconChoices({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="6" cy="6" r="2" />
      <line x1="11" y1="6" x2="20" y2="6" />
      <circle cx="6" cy="12" r="2" />
      <line x1="11" y1="12" x2="20" y2="12" />
      <circle cx="6" cy="18" r="2" />
      <line x1="11" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function IconInbox({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 16,12 14,15 10,15 8,12 2,12" />
      <path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" />
    </svg>
  );
}

export function IconLineSplit({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function IconSparkle({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
    </svg>
  );
}

/** 종이에 가로선 3개 — 문제 정보(메타데이터) 아이콘 */
export function IconDocLines({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function IconShare({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

export function IconLoader({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
        <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

/* ═══ Phase 55b — 버전 관리 아이콘 4종 ═══
 *
 * 규약: 아이콘의 상태 변형은 boolean prop으로 표현한다. 스위치 방식은 도안에 맞춘다 —
 *   fill 전환(IconPin.filled) 또는 요소 유무(IconSave.checked).
 *
 * ⚠️ 버전 복원에 IconUndo를 쓰지 말 것 — Phase 55a 블록 Undo 버튼이 점유 중이다.
 *    복원은 IconRestore(시계 + 반시계 호)로 "시간을 되돌린다"는 의미를 따로 표현한다.
 */

/**
 * GitHub 공식 마크(Invertocat). 버전 내보내기 버튼·배지에 쓴다.
 *
 * 이것만 stroke가 아니라 fill이라 주변 1.8 stroke 아이콘과 질감이 다르다. 의도된
 * 예외다 — 공식 마크는 채움이 원형이고, 목적지가 GitHub라는 걸 한눈에 알리는 게
 * 시각적 균질성보다 중요하다. (GitHub 브랜드 가이드라인은 GitHub 연동을 나타내는
 * 용도의 마크 사용을 허용한다. 마크를 변형하거나 다른 서비스에 돌려쓰지 말 것.)
 */
export function IconGithub({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/** 이름 저장(named 버전). */
export function IconTag({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z" />
      <circle cx="7" cy="7" r="1.2" fill={color} stroke="none" />
    </svg>
  );
}

/** 버전 고정(pin). 켜짐은 채움, 꺼짐은 외곽선. */
export function IconPin({ size = 14, color = 'currentColor', filled = false }:
  IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : 'none'} stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 01-1.11 1.79l-1.78.9A2 2 0 005 15.24V16a1 1 0 001 1h12a1 1 0 001-1v-.76a2 2 0 00-1.11-1.79l-1.78-.9A2 2 0 0115 10.76V6h1a2 2 0 000-4H8a2 2 0 000 4h1z" />
    </svg>
  );
}

/** 버전 복원(restore). IconUndo(편집 되돌리기)와 의미·도안 모두 별개. */
export function IconRestore({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

/* Phase 59a — 코칭 블록 아이콘 2종.
   GitHub octicon(report / stop)의 실루엣을 이 파일 규격(viewBox 24 · strokeWidth 1.8 ·
   fill none · stroke=currentColor)으로 다시 그린 것이다.
   ⚠ lucide·octicons 패키지를 추가하지 않는다 — 아이콘 2개 때문에 의존성을 늘릴 이유가 없고,
     외부 세트는 이 파일의 획 두께·viewBox 규격과 어긋나 12종 사이에서 혼자 튄다.
   ⚠ 느낌표의 점은 길이 0에 가까운 선 + strokeLinecap="round"로 만든다(원을 따로 그리면
     stroke 기반인 다른 획과 굵기가 어긋난다). */

/** 댓글 — 둥근 말풍선 + 점 3개 (M3 A2 · D1).
 *  💬 이모지 5곳을 대체한다(단색 stroke 아이콘들 사이에서 컬러 면 채움이 혼자 튀었다).
 *  ⚠ 둥근 윤곽이 구분점이다 — IconCoachImportant(코칭)가 **네모** 말풍선+느낌표라
 *    같은 네모로 그리면 둘이 혼동된다.
 *  ⚠ 점은 길이 0 선 + strokeLinecap="round"(:505 규약) — 원을 따로 그리면 굵기가 어긋난다. */
/** 문단 가로폭 — 좌우 세로바 + 양방향 화살표 (M3 A5 · 검수 반영 2026-09-05).
 *  ⚠ 이 파일 규격(viewBox 24 정사각)의 유일한 예외다 — 덕수 검수: 크기 1.8배·가로로
 *    더 넓게·세로바 풀하이트·**획 두께와 색은 스테퍼 꺾쇠와 동일**. 꺾쇠(viewBox=렌더
 *    1:1, stroke 1.8 = 시각 1.8px)와 같은 문법으로 그려야 두께가 물리적으로 같다 —
 *    24 viewBox를 축소 렌더하면 획이 1.1px대로 가늘어져 어긋난다. */
export function IconTextWidth({ size = 27, color = 'currentColor' }: { size?: number; color?: string }) {
  const h = Math.round(size * 15 / 27);
  /* 검수 2차(2026-09-05): 화살표만 획 1.4로 한 단 가늘게(세로바는 꺾쇠와 같은 1.8 유지) ·
     가로선을 세로바에 바짝 — 스트로크 엣지 간 틈 ≈1px(미세한 틈만). */
  return (
    <svg width={size} height={h} viewBox="0 0 27 15" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {/* 검수 4차: 세로바만 획 절반(1.8→0.9) — 화살표 1.4, 꺾쇠 1.8과 별개 */}
      <line x1="1.2" y1="0.9" x2="1.2" y2="14.1" strokeWidth="0.9" />
      <line x1="25.8" y1="0.9" x2="25.8" y2="14.1" strokeWidth="0.9" />
      <g strokeWidth="1.4">
        <line x1="3.8" y1="7.5" x2="23.2" y2="7.5" />
        <path d="M6.8 4.7 3.8 7.5l3 2.8" />
        <path d="M20.2 4.7 23.2 7.5l-3 2.8" />
      </g>
    </svg>
  );
}

export function IconComment({ size = 14, color = 'currentColor' }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      <line x1="8.2" y1="11.5" x2="8.3" y2="11.5" />
      <line x1="11.95" y1="11.5" x2="12.05" y2="11.5" />
      <line x1="15.7" y1="11.5" x2="15.8" y2="11.5" />
    </svg>
  );
}

export function IconCoachImportant({ size = 14, color = 'currentColor' }: IconProps) {
  // 말풍선 + 느낌표 — "이건 알고 가라"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="19" height="14" rx="2.5" />
      <path d="M7.5 17.5v3.5l4-3.5" />
      <line x1="12" y1="7" x2="12" y2="11.5" />
      <line x1="12" y1="14.2" x2="12" y2="14.3" />
    </svg>
  );
}

export function IconCoachCaution({ size = 14, color = 'currentColor' }: IconProps) {
  // 팔각형(정지) + 느낌표 — "여기서 빠진다"
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.6 2.5h6.8l4.9 4.9v6.8l-4.9 4.9H8.6l-4.9-4.9V7.4z" />
      <line x1="12" y1="7.3" x2="12" y2="12.4" />
      <line x1="12" y1="15.4" x2="12" y2="15.5" />
    </svg>
  );
}
