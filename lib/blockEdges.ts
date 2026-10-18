/**
 * M10 J — 블록 앞뒤 빈 줄 제거의 **단일 원천** (import 0 · `npm run test:edges`).
 *
 * 소비처: 저장 정규화 `toPersistedBlock`(lib/blocks/normalize.ts) · 정돈 R4(lib/blockTidy.ts) ·
 * 편집창(로드 `toLocal` · 분할 · 블록 이탈 · 탭 전환 — `MarkdownEditor.trimEdges`가 `edgeChanges`를 쓴다).
 * ⚠ 정규식 사본을 다시 만들지 말 것 — 셋이 갈리면 화면·저장·정돈이 서로 다른 블록을 만든다.
 * ⚠ import 0 — `test:tidy`가 blockTidy.ts를 단독 tsc한다. normalize.ts(nanoid·preprocess)에 두면 그 그래프가 오염된다.
 *
 * ⚠ **경우 이어짓기 예외(M10 P26)**: case·subcase의 빈 첫 줄은 "이어짓기"(직전 경우의 연속 — lib/caseBlock.ts
 *   `splitCaseTitle`)라는 **의미**다. 일반 규칙으로 지우면 본문 첫 줄이 제목행이 된다. M10 이전의 저장 정규화가 바로
 *   그렇게 이어짓기를 파괴하고 있었다(`"\n본문"` → `"본문"`). 그래서 빈 첫 줄은 **하나만** 남기고 나머지 앞 빈 줄을 지운다.
 */

const CASE_TYPES = new Set(['case', 'subcase']);

/** case·subcase의 첫 줄이 공백뿐인가(= 이어짓기 꼴). 다른 변환(예: `normalizeDisplayMathSpacing`은 맨 앞 수식 앞 공백을
 *  지운다)을 거치기 **전에** 판정해 두고 결과에 `\n`을 되붙일 때 쓴다 — lib/blocks/normalize.ts. */
export function isContinuationLead(t: string, type?: string): boolean {
  return !!type && CASE_TYPES.has(type) && /^[ \t]*\n/.test(t);
}

/** 앞 빈 줄 제거. case·subcase에서 첫 줄이 비어 있으면(이어짓기) `\n` 하나를 남긴다(내용이 전부 공백이면 ''). */
export function trimLeadingBlankLines(t: string, type?: string): string {
  if (isContinuationLead(t, type)) {
    const rest = t.replace(/^\s*\n/, '');
    return rest ? '\n' + rest : '';
  }
  return t.replace(/^\s*\n/, '');
}

/** 뒤 빈 줄 제거 */
export function trimTrailingBlankLines(t: string): string {
  return t.replace(/\n\s*$/, '');
}

/** 앞뒤 빈 줄 제거(저장 정규화·정돈 R4·편집창 공용) */
export function trimBlockEdges(t: string, type?: string): string {
  return trimTrailingBlankLines(trimLeadingBlankLines(t, type));
}

export interface EdgeChange { from: number; to: number; insert: string }

/**
 * `trimBlockEdges`와 **같은 결과**를 내는 최소 changes — 앞·뒤 두 구간(CodeMirror dispatch용).
 * 문서 통째 교체는 커서·Tab 자리 매핑·CM undo를 망가뜨리므로 쓰지 않는다. 결과가 같지 않으면 `test:edges`가 깨진다.
 * ⚠ "공통 접두·접미를 뺀 1구간" 치환으로 바꾸지 말 것 — 앞뒤를 둘 다 지우면 공통 부분이 0이라 통째 교체가 된다.
 */
export function edgeChanges(s: string, type?: string): EdgeChange[] {
  const rest = s.replace(/^\s*\n/, '');
  const head = s.length - rest.length;
  const keep = isContinuationLead(s, type) && rest ? '\n' : '';
  if (rest === '') return s ? [{ from: 0, to: s.length, insert: '' }] : [];
  const out: EdgeChange[] = [];
  if (head && !(keep && head === 1 && s[0] === '\n')) out.push({ from: 0, to: head, insert: keep });
  const m = rest.match(/\n\s*$/);
  const tail = m ? m[0].length : 0;
  if (tail) out.push({ from: s.length - tail, to: s.length, insert: '' });
  return out;
}
