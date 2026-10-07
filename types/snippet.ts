/** Phase 68 — 스니펫 종류. 저장값이 없는 옛 문서는 'hotkey'(이관 없음) */
export type SnippetKind = 'hotkey' | 'abbrev';

export interface MathSnippet {
  id: string;
  kind: SnippetKind;
  name: string;           // 이름 (예: "선분", "코사인법칙")
  shortcutIndex?: number; // hotkey만: 단축키 번호 (1~9) → Ctrl+Alt+1~9. 9 초과는 단축키 없음(현행)
  abbrev?: string;        // abbrev만: Tab 트리거 약어 (/^[A-Za-z][A-Za-z0-9]{0,9}$/)
  content: string;        // LaTeX 문구. abbrev는 `▢`(입력 자리) 포함 가능
  order: number;          // 정렬 순서 — hotkey = shortcutIndex · abbrev = 생성 시각 ms
  created_at: Date;
  updated_at: Date;
}

/** 등록·수정 폼이 넘기는 값. kind별로 shortcutIndex / abbrev 중 하나만 의미가 있다 */
export interface SnippetInput {
  kind: SnippetKind;
  name: string;
  content: string;
  shortcutIndex?: number;
  abbrev?: string;
}
