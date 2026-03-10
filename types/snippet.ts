export interface MathSnippet {
  id: string;
  name: string;           // 상용구 이름 (예: "선분", "코사인법칙")
  shortcutIndex: number;  // 단축키 번호 (1~9) → Ctrl+Alt+1~9
  content: string;        // LaTeX 문구
  order: number;          // 정렬 순서
  created_at: Date;
  updated_at: Date;
}