/**
 * Phase 71 — HWPX 스타일 표(v5 §1-2 · §3-2). import 0 — `test:exporthwpxstyles`가 단독 컴파일한다.
 *
 * 정본은 템플릿 hwpx(`docs/phasedocs/Mathory_tmp.hwpx`)의 **한글 이름**이다. 코드의 키는 영문 이름(engName)이고,
 * id·paraPr·charPr는 `scripts/hwpxSkeleton.mjs`가 이름으로 찾아 `skeleton/ids.ts`에 낸다(id를 여기 적지 말 것 —
 * 템플릿을 고칠 때마다 재배열된다, 2~6차에 실제로 전부 바뀌었다).
 *
 * ⚠ 이 파일의 `name: '…'` 줄은 추출 스크립트가 정규식으로 읽는다 — 한 항목 한 줄 형식을 지킬 것.
 * ⚠ 영문 이름은 영숫자만(D14 — 한글이 `.`·`-`를 받지 않는다).
 */

export type StyleKind = 'PARA' | 'CHAR';

export interface StyleDef {
  key: StyleKey;
  name: string;
  kind: StyleKind;
  use: string;
}

export type StyleKey =
  | 'Normal' | 'MTQBody' | 'MTQCont' | 'MTQEq' | 'MTQNum' | 'MTQCh5' | 'MTQCh3'
  | 'MTBoxText' | 'MTBoxItem' | 'MTFig'
  | 'MTSBody' | 'MTSEq' | 'MTSH1' | 'MTSStep1' | 'MTSStep2' | 'MTSTip';

/** 템플릿 스타일 창 순서(바탕글 포함 16) */
export const STYLES: readonly StyleDef[] = [
  { key: 'Normal', name: '바탕글', kind: 'PARA', use: '표 셀' },
  { key: 'MTQBody', name: '문제-본문', kind: 'PARA', use: '문제 탭 첫 문단(번호 런 + 탭)' },
  { key: 'MTQCont', name: '문제-이음', kind: 'PARA', use: '문제 탭의 나머지 문단' },
  { key: 'MTQEq', name: '문제-수식', kind: 'PARA', use: '문제 독립행 수식' },
  { key: 'MTQNum', name: '문제-번호', kind: 'CHAR', use: '번호 런' },
  { key: 'MTQCh5', name: '선지-5', kind: 'PARA', use: '선택지 4~5개 한 줄' },
  { key: 'MTQCh3', name: '선지-3', kind: 'PARA', use: '선택지 1~3개 · 긴 선택지 3+2' },
  { key: 'MTBoxText', name: '상자-글', kind: 'PARA', use: '글상자 안 일반 문단' },
  { key: 'MTBoxItem', name: '상자-항목', kind: 'PARA', use: '글상자 안 마커 문단' },
  { key: 'MTFig', name: '공통-그림', kind: 'PARA', use: '그림 · 자리표시' },
  { key: 'MTSBody', name: '해설-본문', kind: 'PARA', use: '풀이 일반 문단' },
  { key: 'MTSEq', name: '해설-수식', kind: 'PARA', use: '풀이 독립행 수식' },
  { key: 'MTSH1', name: '해설-제목', kind: 'PARA', use: 'heading · 미주 "N번"' },
  { key: 'MTSStep1', name: '해설-단계1', kind: 'PARA', use: '경우 C1 · 목록 1단계 · 마커 문단' },
  { key: 'MTSStep2', name: '해설-단계2', kind: 'PARA', use: '하위 경우 C1a · 들여쓰기 · 목록 2단계+' },
  { key: 'MTSTip', name: '해설-Tip', kind: 'PARA', use: '코칭 블록' },
];

export const STYLE_BY_KEY: Readonly<Record<StyleKey, StyleDef>> = Object.fromEntries(
  STYLES.map((s) => [s.key, s]),
) as Record<StyleKey, StyleDef>;
