/**
 * Phase 70 D2 — 블록 type → 내보내기 kind 매핑표 (단일 원천).
 *
 * Firestore `type` 17종(활성 15 + 레거시 2)은 그대로 두고, 직렬화기(LaTeX·Typst·장래 HWPX)는
 * **kind만** 본다. 새 preset이 같은 구조면 이 표에 한 줄, 구조가 새로우면 kind를 더하고
 * 직렬화기를 손본다.
 *
 * ⚠ import 0 — `npm run test:exportkinds`가 이 파일 하나를 tsc로 단독 컴파일하고,
 *   `types/problem.ts`의 union 원문을 파싱해 17종이 빠짐없이 매핑됐는지 대조한다
 *   (사본 목록을 테스트에 두지 않는다 — `tests/exportMd.test.mjs`의 ALL_TYPES가 13종에서 멈춘 전례).
 * ⚠ 레거시 `math_block`·`bullet`·`coach_caution`은 편집창을 연 문항만 정규화되므로
 *   Firestore에 남아 있다(`EditorView.normalizeBlockType`) — 여기서 받아야 한다.
 */

export type ExportKind =
  | 'para'        // 마크다운 본문(문단·목록·표·인용)
  | 'heading'     // 제목
  | 'indent'      // 들여쓰기(callout) — 위치만, 테두리 없음
  | 'admonition'  // 코칭 — 왼쪽 바 + 아이콘 + 'Tip'
  | 'case'        // 경우 · 하위 경우 — 라벨 C1/C1a + 제목행 + 본문
  | 'framed'      // 테두리 상자(gana·roman·box)
  | 'choices'     // 선택지 ①~⑤
  | 'figure';     // 그림(image·svg·ggb)

export type ExportVariant =
  | 'tip'
  | 'top' | 'sub'
  | 'gana' | 'roman' | 'plain'
  | 'image' | 'svg' | 'ggb';

export interface KindEntry {
  kind: ExportKind;
  variant?: ExportVariant;
}

export const BLOCK_KIND: Readonly<Record<string, KindEntry>> = {
  text: { kind: 'para' },
  math_block: { kind: 'para' },          // 레거시 → text
  bullet: { kind: 'para' },              // 레거시 → text
  list: { kind: 'para' },
  heading: { kind: 'heading' },
  callout: { kind: 'indent' },
  coach_important: { kind: 'admonition', variant: 'tip' },
  coach_caution: { kind: 'admonition', variant: 'tip' },   // 레거시(M2 G) → 같은 'Tip'
  case: { kind: 'case', variant: 'top' },
  subcase: { kind: 'case', variant: 'sub' },
  gana: { kind: 'framed', variant: 'gana' },
  roman: { kind: 'framed', variant: 'roman' },
  box: { kind: 'framed', variant: 'plain' },
  choices: { kind: 'choices' },
  image: { kind: 'figure', variant: 'image' },
  svg: { kind: 'figure', variant: 'svg' },
  ggb: { kind: 'figure', variant: 'ggb' },
};

/** 미지의 type은 조용히 버리지 않고 본문으로 내보낸다(호출부가 warn 1회). */
export const FALLBACK_KIND: KindEntry = { kind: 'para' };

export function kindOf(type: string): { entry: KindEntry; known: boolean } {
  const entry = Object.prototype.hasOwnProperty.call(BLOCK_KIND, type) ? BLOCK_KIND[type] : undefined;
  return entry ? { entry, known: true } : { entry: FALLBACK_KIND, known: false };
}
