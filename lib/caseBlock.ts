/* ═══════════════════════════════════════════════════════════════
   Phase 59 — '경우(case)' 블록 공용 로직

   렌더 사이트 5곳(EditorView 미리보기 · ProblemView · FolderView ·
   ProblemTabContent · PrintableContent)이 전부 이 모듈을 쓴다.

   설계 요지 (v4 D9·D9′·D10·D15):
   - 첫 줄 = 제목행(조건), 둘째 줄부터 본문. 번호는 raw_text에 넣지 않는다.
   - 번호는 렌더 시 산출한다 → 케이스를 삽입·삭제·이동해도 원문이 깨지지 않는다.
   - 첫 줄이 빈 case/subcase는 "이어짓기"(직전 경우의 연속)다. 번호도 dot도 없고
     레일만 이어진다 — 한 경우 안에 이미지·선택지 블록을 끼워 넣는 유일한 방법이다.
   - 라벨은 마크다운 문자열에 <span>으로 주입한다. 블록을 제목/본문 두 컴포넌트로
     쪼개면 EditorPreview가 인스턴스별로 0부터 매기는 data-math-id가 겹쳐
     편집창의 "미리보기 수식 클릭 → 편집 위치" 매핑이 깨진다(v2 E7).
   ═══════════════════════════════════════════════════════════════ */

/** Phase 54 레거시 케이스 라벨 (lib/locale.ts의 변환 규칙과 같은 문법).
 *  ⚠ locale.ts가 이 상수를 가져다 쓴다 — 사본을 만들지 말 것. */
export const LEGACY_CASE_RE = /^\*\*Case\s+\d+[a-z]?\.\*\*/;
export const LEGACY_SUBCASE_RE = /^-[ \t]+\*\*Case\s+\d+[a-z]\.\*\*/;

/**
 * 본문에서 경우를 가리키는 참조 표기 — `C1` · `C2a` (개선묶음 M1 G).
 *
 * ⚠ 라벨 문법의 단일 원천이다(`buildCaseLabels`가 만드는 `C${n}${letters}`와 같은 모양).
 *   사본을 만들지 말 것 — 표기가 갈리면 "본문의 C1만 강조가 빠지는" 조용한 결함이 된다.
 * ⚠ `\b` 대신 lookaround인 이유: 한글 조사(`C1에서`)는 살리면서 `\mathrm{C}`·`C_1` 같은
 *   LaTeX 잔재와 `AC1`·`C12x` 같은 식별자는 배제해야 한다.
 */
export const CASE_REF_RE = /(?<![A-Za-z0-9_\\])C(\d{1,2})([a-z]?)(?![A-Za-z0-9_])/g;

/**
 * 본문의 `C1`·`C2a`를 `<span class="case-ref">`로 감싼다. 굵기만 올리는 용도다(색·크기 불변).
 *
 * ⚠ **보호는 이 함수가 스스로 한다.** 호출부에 기대면 안 된다 —
 *   `preprocessLocale`은 사본이 둘인데 코드펜스 보호(`protectFences`)는 EditorPreview 쪽에만
 *   있어서, 인쇄 경로에서는 펜스 안의 `C1`이 그대로 바뀐다.
 * ⚠ 순서가 중요하다: `<span class="case-label">C1.</span>`을 **요소 통째로** 먼저 빼야 한다.
 *   단개 태그를 먼저 빼면 span 안의 텍스트 `C1.`이 노출돼 라벨 안에 라벨이 겹친다.
 * ⚠ 수식은 호출 시점에 이미 `⟦MATH_n⟧`로 치환돼 있다(양쪽 사본 공통).
 */
export function convertCaseRefs(text: string): string {
  if (!/C\d/.test(text)) return text;                 // 흔한 경우를 빨리 통과

  const holds: string[] = [];
  const keep = (m: string) => {
    holds.push(m);
    return `\u0000REF${holds.length - 1}\u0000`;      // 본문에 나타날 수 없는 표지
  };

  let out = text
    .replace(/```[\s\S]*?```/g, keep)                  // 코드펜스
    .replace(/~~~[\s\S]*?~~~/g, keep)
    .replace(/<span class="case-label">[\s\S]*?<\/span>/g, keep)   // ← 요소 통째 (먼저)
    .replace(/<[^>\n]+>/g, keep)                       // 남은 단개 태그
    .replace(/(`+)[^`\n]*\1/g, keep);                  // 인라인 코드(백틱 런)

  out = out.replace(CASE_REF_RE, (m) => `<span class="case-ref">${m}</span>`);

  return out.replace(/\u0000REF(\d+)\u0000/g, (_, i) => holds[parseInt(i, 10)]);
}

export function isCaseBlock(type: string): boolean {
  return type === 'case' || type === 'subcase';
}

interface CaseBlockLike {
  id: string;
  block_key?: string;
  type: string;
  raw_text: string;
}

/** 상태·라벨 맵의 키. doc id는 저장마다 재발급되므로 block_key를 우선한다 (v2 E9). */
export function blockKeyOf(b: { id: string; block_key?: string }): string {
  return b.block_key || b.id;
}

/** 1 → 'a', 26 → 'z', 27 → 'aa'.
 *  ⚠ String.fromCharCode(96 + n)만 쓰면 27번째가 '{'가 된다 (v2 E5). */
export function letters(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(97 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** 첫 줄(제목행) / 나머지(본문). 첫 줄이 공백뿐이면 title === '' (이어짓기). */
export function splitCaseTitle(raw: string): { title: string; body: string } {
  const nl = raw.indexOf('\n');
  const first = nl === -1 ? raw : raw.slice(0, nl);
  const rest = nl === -1 ? '' : raw.slice(nl + 1);
  return { title: first.trim() ? first : '', body: rest };
}

/**
 * blockKey → 표시 라벨('C-2' · 'C-2-a'). 이어짓기 블록은 항목이 없다.
 *
 * 규칙 (D10):
 *   heading           → n = 0, sub = 0 (섹션 단위 리셋)
 *   case    제목행 有  → n++, sub = 0
 *   subcase 제목행 有  → sub++
 *   그 외 블록         → 상태 불변 (경우 사이 설명 문단이 번호를 끊지 않는다)
 */
export function buildCaseLabels(blocks: CaseBlockLike[]): Map<string, string> {
  const out = new Map<string, string>();
  let n = 0;
  let sub = 0;
  for (const b of blocks) {
    if (b.type === 'heading') {
      n = 0;
      sub = 0;
      continue;
    }
    if (!isCaseBlock(b.type)) continue;
    const { title } = splitCaseTitle(b.raw_text || '');
    if (!title) continue;                       // 이어짓기 — 번호 없음
    // 표기는 대시 없이 붙여 쓴다(C1 · C1a) — 대시가 있으면 수식·부호와 섞여 읽기 나쁘다
    if (b.type === 'case') {
      n += 1;
      sub = 0;
      out.set(blockKeyOf(b), `C${n}`);
    } else {
      sub += 1;
      // 상위 case 없이 등장한 subcase는 C1a로 친다 (데이터는 손대지 않는다)
      out.set(blockKeyOf(b), `C${n || 1}${letters(sub)}`);
    }
  }
  return out;
}

/**
 * 제목행 앞에 라벨 span을 끼운 마크다운 문자열.
 * 행 선두 인라인 <span> 주입은 marker-gana·marker-circled·marker-case-sub가
 * 쓰는 확립된 방식이고 rehypeRaw가 파싱한다. raw_text는 불변이다.
 */
export function injectCaseLabel(raw: string, label: string | null): string {
  const nl = raw.indexOf('\n');
  const first = nl === -1 ? raw : raw.slice(0, nl);
  if (!first.trim()) return raw;                    // 이어짓기 — 제목행이 없다
  const rest = nl === -1 ? '' : raw.slice(nl + 1);
  const head = label ? `<span class="case-label">${label}.</span> ${first}` : first;
  if (!rest.trim()) return head;
  // 제목행 뒤에 빈 줄을 보장한다.
  // ⚠ 이게 없으면 둘째 줄의 `$$…$$`·리스트가 제목행 문단에 흡수돼 인라인으로 렌더된다
  //   ("C-1. a>1인 경우 x=1"처럼 한 줄로 붙는다). 사용자가 빈 줄을 넣어야만 제대로
  //   나오는 규약은 제목행 규약(D9)과 어긋나므로 렌더 시점에 정규화한다.
  //   Phase 54의 normalizeCaseBoundaries가 Case 라벨 앞에 빈 줄을 넣는 것과 같은 처방이다.
  // ⚠ 수식의 개수·순서는 바뀌지 않으므로 편집창의 data-math-id 매핑은 그대로다.
  const sep = rest.startsWith('\n') ? '\n' : '\n\n';
  return `${head}${sep}${rest}`;
}

/**
 * 경우 사이에 낀 블록(이미지·설명 문단 등)의 키 집합 (Phase 59 D20/A).
 *
 * "런(run)" = 한 섹션 안에서 **첫 경우 블록부터 마지막 경우 블록까지**. 그 사이의
 * 비-경우 블록은 rail이 관통해야 한다 — 경우 안에 이미지를 끼운 구성(D9′ 이어짓기)에서
 * 선이 끊기면 구조가 무너져 보이기 때문이다. 제목(heading)은 번호와 마찬가지로 런도 끊는다.
 *
 * 렌더 사이트는 이 키에 해당하는 블록을 `.case-gap`으로 감싸기만 하면 된다.
 * ⚠ 감쌀 때도 형제 관계가 유지되어야 한다 — rail 연결이 인접 셀렉터로 이뤄진다.
 */
export function buildCaseGapKeys(blocks: CaseBlockLike[]): Set<string> {
  const gaps = new Set<string>();
  let sectionStart = 0;

  const flush = (end: number) => {
    let first = -1;
    let last = -1;
    for (let i = sectionStart; i < end; i++) {
      if (isCaseBlock(blocks[i].type)) {
        if (first < 0) first = i;
        last = i;
      }
    }
    if (first < 0) return;
    for (let i = first + 1; i < last; i++) {
      if (!isCaseBlock(blocks[i].type)) gaps.add(blockKeyOf(blocks[i]));
    }
  };

  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'heading') {
      flush(i);
      sectionStart = i + 1;
    }
  }
  flush(blocks.length);
  return gaps;
}

/**
 * 경우 사이에 낀 블록에 붙일 className.
 *
 * Phase 59a: rail이 본문 바깥(거터)으로 나가면서 타입 분기가 사라졌다. Phase 59는
 * 텍스트 계열에만 `case-gap-body`(3em)를 붙여 목록 불릿·글상자 테두리가 rail(1em)
 * 위를 지나가지 않게 막았는데, 이제 rail이 본문과 겹칠 일 자체가 없다.
 *
 * ⚠ 인자를 남겨 둔 것은 호출 5곳(EditorView·TabBody·FolderView·ProblemTabContent·
 *   PrintableContent)을 건드리지 않기 위해서다. 타입별 처리가 다시 필요해지면
 *   여기서 분기를 되살릴 수 있다.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function caseGapClassName(type: string): string {
  return 'case-gap';
}

/** 렌더 사이트가 최상위 블록 요소에 붙일 className (D15′).
 *  ⚠ 편집창·인쇄는 블록마다 래퍼 div가 이미 있다. 그 안에 새 div를 만들면
 *    .case-block끼리 형제가 아니게 되어 rail 브리징이 통째로 죽는다 (v3 F1). */
export function caseClassName(
  type: string,
  hasLabel: boolean,
  opts?: { closed?: boolean },
): string {
  return [
    'case-block',
    type === 'subcase' ? 'case-sub' : '',
    hasLabel ? '' : 'case-cont',
    opts?.closed ? 'case-closed' : '',
  ].filter(Boolean).join(' ');
}
