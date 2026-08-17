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
    if (b.type === 'case') {
      n += 1;
      sub = 0;
      out.set(blockKeyOf(b), `C-${n}`);
    } else {
      sub += 1;
      // 상위 case 없이 등장한 subcase는 C-1-a로 친다 (데이터는 손대지 않는다)
      out.set(blockKeyOf(b), `C-${n || 1}-${letters(sub)}`);
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

/** 개재 블록 중 좌측 여백을 주면 안 되는 타입 — 중앙 정렬(이미지)이거나 전폭 뷰어다. */
const GAP_MEDIA_TYPES = new Set(['image', 'svg', 'ggb']);

/**
 * 경우 사이에 낀 블록에 붙일 className.
 * 텍스트 계열은 경우 본문과 같은 좌측 기준(`case-gap-body`)을 받는다 — 안 그러면
 * 목록 불릿·글상자 테두리가 rail(1em) 위에 겹쳐 지나간다.
 */
export function caseGapClassName(type: string): string {
  return GAP_MEDIA_TYPES.has(type) ? 'case-gap' : 'case-gap case-gap-body';
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
