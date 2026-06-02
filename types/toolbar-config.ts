/**
 * Phase 40 — 수식 툴바 타입 정의
 *
 * MathSymbol: 기호 1개의 데이터 레지스트리 레코드.
 *   - latex/unicode/mathClass/katexSupported = KaTeX(MIT) 시드에서 자동 추출 (검증됨)
 *   - field/tier/name = 수작업 큐레이션 (분야·교육과정 등급·다국어 이름)
 * 출처/파이프라인: docs/phasedocs/Phase40_기호설정화면_설계_최신.md §18
 */

/** 수학 분야 (분류축 B — 사용자 표시용). KaTeX mathClass(축 A)와 별개. */
export type MathField =
  | 'arithmetic'      // 기본 연산
  | 'algebra'         // 대수
  | 'analysis'        // 해석 (극한·연속·급수)
  | 'calculus'        // 미적분
  | 'geometry'        // 기하
  | 'set'             // 집합
  | 'logic'           // 논리
  | 'probability'     // 확률·통계
  | 'statistics'      // 통계
  | 'discrete'        // 이산 (순열·조합)
  | 'vector'          // 벡터
  | 'linear-algebra'  // 선형대수
  | 'greek'           // 그리스 문자
  | 'bracket';        // 괄호·구분자

/** 교육과정 등급. 1=중·고, 2=대학기초, 3=대학전공, 4=연구. */
export type Tier = 1 | 2 | 3 | 4;

/** KaTeX atom class (분류축 A — 구조적). symbols.js의 group. */
export type MathClass =
  | 'rel' | 'bin' | 'op-token' | 'open' | 'close' | 'punct'
  | 'inner' | 'accent-token' | 'mathord' | 'textord' | 'spacing'
  | 'structured';     // 구조형 오버레이(\frac 등)

export interface SymbolName {
  ko: string;          // 한국어 (필수)
  en: string;          // 영어 (필수)
  ja?: string;         // 일본어 (후속)
  zh?: string;         // 중국어 (후속)
}

export interface SymbolVariant {
  region: 'kr' | 'jp' | 'cn' | 'en' | 'iso';
  note: string;
}

export interface MathSymbol {
  id: number;
  latex: string;              // 삽입용 LaTeX (예: "\\leq", "\\frac{}{}")
  symbol: string;             // 표시용 유니코드 (예: "≤"). 없으면 "" → displayLatex 사용
  displayLatex?: string;      // 미리보기용 (구조형, 예: "\\frac{a}{b}")
  cursorOffset?: number;      // 삽입 후 커서 위치
  mathClass: MathClass;
  field: MathField;
  tier: Tier;
  name: SymbolName;
  katexSupported: boolean;
  variants?: SymbolVariant[];
}

/** 사용 팔레트의 표시 카테고리 (기본 4개 + 확장). */
export interface PaletteCategory {
  id: string;
  label: string;              // 탭 라벨 (ko)
  fields: MathField[];        // 이 탭에 묶을 분야
}

// ───── 사용자 커스터마이징 설정 (Firestore) ─────

export type PresetId = 'high-school' | 'university-basic' | 'university-major' | 'all';

export interface ToolbarGroup {
  id: string;
  name: string;
  order: number;
  symbolIds: number[];
}

export interface ToolbarConfig {
  schemaVersion: number;
  preset: PresetId | null;
  maxTier: Tier;
  groups: ToolbarGroup[];
  recentSymbolIds: number[];
}
