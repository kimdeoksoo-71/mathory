import type React from 'react';

/* ═══════════════════════════════════════════════════════════════
   개선묶음 M2 A — 다이얼로그 스타일의 단일 원천 (D1′)

   값은 `components/import/SheetImportModal.tsx:76-108`을 **그대로 복제**했다.
   그 파일이 원본이고 `BatchVerifyDialog.tsx:26-59`가 사본이다(그쪽 주석이
   "상수가 export돼 있지 않아 사본"이라고 스스로 밝힌다).

   ⚠ 새 규격을 만들지 않는다. 이 작업의 목적은 "팝업이 두 갈래(네이티브/자체)로
     갈린 것"을 없애는 것이지 아홉 번째 모달 디자인을 세우는 것이 아니다.
     그래서 radius 10 · 테두리 없음 · shadow 0 8px 32px를 그대로 쓴다 —
     기존 모달 8종 사이에 놓았을 때 튀지 않아야 한다.
   ⚠ 기존 2파일(SheetImportModal · BatchVerifyDialog)은 이번 범위가 아니다(D7′).
     나중에 그 둘을 이 상수로 갈아끼울 수는 있지만, 그건 별건이다.
   ═══════════════════════════════════════════════════════════════ */

/** 현행 최고 z-index(10000: Sidebar 컨텍스트 메뉴 2곳 · SvgViewer 전체화면) 위.
 *  ⚠ 기존 z-index 전면 재배치는 범위 밖이다(D2′). 이 토큰 하나만 새로 세운다.
 *  ⚠ 실측 계층: 1000(ContextMenu 등) · 1400 · 2000 · 3000(툴바 2곳) ·
 *    9000(SheetImport·BatchVerify·ImageTypeSelect) · 9998/9999(Ggb·Svg 전체화면) ·
 *    10000(Sidebar·SvgViewer). 다이얼로그는 그 어느 것 위에서도 떠야 한다 —
 *    시트 모달 안에서 confirm을 부르는 경로가 실제로 있다. */
export const Z_DIALOG = 10500;

/** RefTooltip 등 "다이얼로그보다는 아래, 나머지보다는 위" 계층 (개선묶음 M2 C에서 사용) */
export const Z_TOOLTIP = Z_DIALOG - 100;

export const dialogOverlay: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: Z_DIALOG,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

/** 본체. width는 호출부가 준다(확인 420 · 입력 420 · 폴더 픽커 480). */
export const dialogBody: React.CSSProperties = {
  background: 'var(--bg-card, #fff)', borderRadius: 10,
  maxWidth: '92vw', maxHeight: '88vh',
  display: 'flex', flexDirection: 'column',
  boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
  fontFamily: 'var(--font-ui)',
};

export const dialogHead: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  minHeight: 57, padding: '0 16px', flexShrink: 0,
  borderBottom: '1px solid var(--border-light, #eee)',
  fontSize: 14, fontWeight: 700, color: 'var(--text-primary)',
};

export const dialogContent: React.CSSProperties = {
  padding: 16, overflowY: 'auto', flex: 1, minHeight: 0,
  fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-primary)',
  /* 다행 메시지는 배열로 받아 <div>로 나눠 그리므로 pre-line이 필요 없다.
     그래도 사용자가 넘긴 문자열 안의 \n을 삼키지 않도록 남겨 둔다. */
  whiteSpace: 'pre-line',
};

export const dialogFoot: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
  minHeight: 57, padding: '0 16px', flexShrink: 0,
  borderTop: '1px solid var(--border-light, #eee)',
};

export const dialogInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: 14,
  fontFamily: 'var(--font-ui)', color: 'var(--text-primary)',
  background: 'var(--bg-input, #fff)',
  border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
};

/** 위험 버튼 색은 RestoreConfirm 전례(#e53935)를 따른다. */
export const DANGER = '#e53935';

export function dialogBtn(
  kind: 'primary' | 'ghost' | 'danger',
  disabled = false,
): React.CSSProperties {
  return {
    padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
    fontFamily: 'var(--font-ui)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    border: kind === 'ghost' ? '1px solid var(--border-light, #ddd)' : 'none',
    background: kind === 'ghost' ? 'transparent'
      : kind === 'danger' ? DANGER
      : 'var(--mathory-red-dark, #BC5F3F)',
    color: kind === 'ghost' ? 'var(--text-primary, #222)' : '#fff',
  };
}

/* ═══ 개선묶음 M2 (덕수 보완 4) — 우측 드로어 = 떠 있는 카드 ═══
   상하좌우 같은 여백을 둔다. 한 변이라도 0이면 "붙어 있는 패널"로 읽혀
   3단 구분(사이드바 < 중앙 < 드로어)의 인상이 무너진다. */
export const DRAWER_INSET = 8;
export const DRAWER_RADIUS = 10;
