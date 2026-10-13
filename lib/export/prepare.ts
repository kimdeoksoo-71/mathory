/**
 * Phase 70 D7′ — 내보내기 구조 전처리: raw_text → 렌더 파서(remark)에 넣을 문자열.
 *
 * 목표는 **화면과 같은 문단 구조**다. IR은 렌더와 같은 파서(remark-parse + remark-math + remark-gfm)를
 * 주입받아 쓰므로, 구조 동치는 "이 함수가 렌더 전처리와 같은 줄 구조를 만드는가"로 환원된다.
 * 그래서 렌더 전처리 중 **줄·문단 구조를 바꾸는 단계만** 같은 함수로 재사용하고, 화면 전용
 * 장식(span 주입·`\tag*`·`\displaystyle`·katexMacros·`**Case**` 변환)은 하지 않는다.
 *
 *   stripInvisibles(Q18) → 코드펜스 보호 → preventSetextHeadings → [ko] protectMath →
 *   insertMarkerLineBreaks → normalizeCaseBoundaries → 텍스트 행 끝 `\tag{n}`·`\ref{n}` → 표지 →
 *   Fig/Table 라벨 → restoreMath → 펜스 복원 → normalizeMathDelimiters(`\[`→`$$` · `\(`→`$`)
 *
 * ⚠ 화면(EditorPreview 사본)과 다른 점은 둘이다 — 알고 둔다:
 *   ① `\[`·`\(` 정규화는 `(?<!\\)` 뒤돌아보기가 있는 판(chatExtract)이다. 렌더 사본 두 벌엔 없다
 *     (행바꿈 `\\[4pt]`의 `\[`를 여는 구분자로 먹는 잠복 버그 — v4 R10, prelaunch 후보). 갈리면 화면이 틀린 것
 *   ② Fig/Table 라벨은 인쇄 쪽 `convertFigureLabels`(`Figure 3`·대소문자 무시)를 쓴다(화면은 `Fig.3`만)
 * ⚠ 표지(⟦TAG:…⟧)는 파서를 그대로 통과해 텍스트 노드에 남는다 — ir.ts가 떼어 문단 속성으로 옮긴다.
 */

import { insertMarkerLineBreaks, normalizeCaseBoundaries, protectMath, restoreMath, convertFigureLabels, convertTableLabels } from '../locale';
import { preventSetextHeadings } from '../preprocess';
import { normalizeMathDelimiters } from '../chatExtract';
import { stripInvisibles } from '../invisibles';

export type ExportLocale = 'ko' | 'international';

/** 텍스트 행 끝 `\tag{n}` 표지 — 렌더 `convertTextTags`와 같은 조건(숫자만 · `[ \t]*$`) */
export const TAG_MARK_OPEN = '⟦TAG:';
export const TAG_MARK_CLOSE = '⟧';
export const TAG_MARK_RE = /⟦TAG:([^⟧]*)⟧/g;

/** 코드펜스 보호 — EditorPreview.protectFences와 같은 정규식(``` 만; ~~~는 remark가 안다) */
function protectFences(text: string): { text: string; fences: string[] } {
  const fences: string[] = [];
  const out = text.replace(/^```[^\n]*\n[\s\S]*?\n```[ \t]*$/gm, (m) => {
    fences.push(m);
    return `⟦FENCE_${fences.length - 1}⟧`;
  });
  return { text: out, fences };
}

function restoreFences(text: string, fences: string[]): string {
  return text.replace(/⟦FENCE_(\d+)⟧/g, (_, i) => fences[parseInt(i, 10)]);
}

/** 텍스트(수식 밖) 단계 — 수식은 이미 ⟦MATH_n⟧ 자리표시자다 */
function textStage(text: string, locale: ExportLocale): string {
  let t = text;
  if (locale === 'ko') {
    t = insertMarkerLineBreaks(t);
    t = normalizeCaseBoundaries(t);
    // ⚠ `\s*$` 금지 — 개행을 삼켜 뒤 빈 줄을 먹는다(Phase 57 · M1 규약)
    t = t.replace(/\\tag\{(\d+)\}[ \t]*$/gm, (_, n) => `${TAG_MARK_OPEN}(${n})${TAG_MARK_CLOSE}`);
    // 텍스트 `\ref{n}` → `(n)` (렌더는 ref-marker span — 말풍선용 장식이라 내보내기엔 글자만)
    t = t.replace(/\\ref\{(\d+)\}/g, (_, n) => `(${n})`);
    t = convertFigureLabels(t);
    t = convertTableLabels(t);
  }
  return t;
}

/**
 * raw_text 한 덩어리 → 파서 입력 문자열.
 * locale `international`이면 렌더(`preprocessLocale` 게이트)처럼 텍스트 단계를 건너뛴다.
 */
export function prepareMarkdown(raw: string, locale: ExportLocale = 'ko'): string {
  const clean = stripInvisibles(String(raw == null ? '' : raw));
  const { text: shielded, fences } = protectFences(clean);
  const safe = preventSetextHeadings(shielded);
  const { cleaned, placeholders } = protectMath(safe);
  const staged = textStage(cleaned, locale);
  const restored = restoreMath(staged, placeholders);
  return normalizeMathDelimiters(restoreFences(restored, fences));
}
