/* ═══════════════════════════════════════════════════════════════
   Phase 59 — 요약 보기(outline) 모델

   열람 2뷰(ProblemView · ProblemTabContent)만 쓴다. 편집창·FolderView·인쇄는
   항상 전체를 보여주므로 이 모듈을 부르지 않는다 (D4).

   접힌 섹션에 남는 것은 정확히 셋 (D2, Phase 59a 개정):
     ① 제목 블록  ② 경우·하위경우 제목행  ③ 작성자가 '요약에 넣기'로 고른 블록
   그 외는 통째로 숨는다.

   ⚠ Phase 59a 후속 — **경우 제목행을 누르면 '경우 구역' 전체가 열린다.**
     구역 = 그 경우 블록 자신 + 다음 **제목행 있는** 경우 블록 전까지의 모든 블록.
     경우 블록 하나만 열던 이전 방식은, 작성자가 경우 본문의 일부를 들여쓰기 블록
     등으로 떼어내는 순간 그 뒷부분이 요약에서 영영 닿을 수 없게 만들었다
     (= 분리를 하면 요약이 망가지니 분리를 못 한다). 구역 단위로 열면 그 제약이 사라진다.
     경계 정의는 rail의 '런'과 같은 직관이되 **이어짓기는 경계가 아니다**(직전 경우의 연속).

   ⚠ Phase 59a: **`**…**` 발췌를 폐기했다.** 하나의 `**` 마커가 강조·발췌·톤
     트리거 3역을 겸하는 바람에 "강조하고 싶은 범위"와 "요약에 남길 범위"가 같은
     마커에 묶여 있었다. 이제 `**`는 강조 전용이고, 요약 구성은 블록 단위로만 한다.
     → extractKeySentences·joinKeys·kind:'keys'·OutlineItem.keys가 전부 사라졌다.
     되살리지 말 것 — 사용 가이드의 "문장 전체를 감쌀 것" 규칙도 함께 폐기됐다.
   ═══════════════════════════════════════════════════════════════ */

import type { Block } from '../types/problem';
import {
  LEGACY_CASE_RE, LEGACY_SUBCASE_RE,
  blockKeyOf, buildCaseLabels, injectCaseLabel, isCaseBlock, splitCaseTitle,
} from './caseBlock';

/** 스켈레톤 한 줄. */
export interface OutlineItem {
  /** 'case' = 경우 제목행(rail·dot 붙음)
   *  'block' = 작성자가 요약에 남기기로 고른 블록 — 사이트별 renderBlock에 그대로 넘긴다 */
  kind: 'case' | 'block';
  /** 여닫이·React 키. 레거시 항목은 `${blockKey}:${행번호}` */
  itemKey: string;
  /** 하위경우 여부 (렌더 클래스 case-sub) */
  sub?: boolean;
  /** 라벨이 붙는 항목인지 — 없으면 dot이 사라진다(case-cont) */
  labeled?: boolean;
  /** 화면에 그릴 마크다운 (case는 라벨이 주입된 제목행) */
  head: string;
  /** 경우 블록 **자신의** 본문 원문(제목행 다음 줄부터). 레거시 항목은 undefined */
  body?: string;
  /** 이 경우가 거느리는 뒤따르는 블록들 (Phase 59a 후속 — '경우 구역').
   *  경계는 **제목행이 있는 다음 경우 블록**이거나 섹션 끝(제목 블록)이다.
   *  ⚠ 이어짓기(제목행 없는 case)는 경계가 아니라 직전 경우의 일부다 — 원래 정의가
   *    "직전 경우의 연속"이므로 여기에 딸려 들어오는 것이 맞다. */
  segment?: Block[];
  /** segment 중 '요약에 넣기'가 켜진 블록. **접힘 상태에서도** 보인다.
   *  ⚠ 펼치면 segment 전체가 나오므로 렌더 사이트는 둘을 **동시에 그리면 안 된다**
   *    (같은 블록이 두 번 나온다). 접힘 = pinned, 펼침 = segment. */
  pinned?: Block[];
  /** kind === 'block'일 때 원본 블록. 렌더는 사이트가 자기 분기로 처리한다
   *  (앱은 imageTreatment·크기, 공개 뷰어는 자기 스타일 — D16 렌더러 분리 유지) */
  block?: Block;
}

export interface OutlineSection {
  /** 섹션 첫 블록의 block_key ?? id */
  key: string;
  /** null = 전문(前文) 섹션 */
  heading: Block | null;
  /** 접힘 상태에서 보일 것 */
  items: OutlineItem[];
  /** 펼침 상태 원본 (heading 제외) */
  blocks: Block[];
}

/** 텍스트 계열 — 여기서만 Phase 54 레거시 라벨을 찾는다.
 *  ⚠ EditorView의 TEXT_BASED_TYPES와 목적이 다르다(저 상수는 CodeMirror 사용 여부). */
const SCANNED_TYPES = new Set([
  'text', 'math_block', 'bullet', 'list', 'callout', 'coach_important', 'coach_caution',
  'gana', 'roman', 'box',
]);

/** 블록 배열 → 섹션 목록. heading 블록이 경계, 첫 제목 앞은 전문 섹션 (D1). */
export function buildOutline(blocks: Block[]): OutlineSection[] {
  const labels = buildCaseLabels(blocks);
  const sections: OutlineSection[] = [];
  let cur: OutlineSection | null = null;

  function open(heading: Block | null, key: string): OutlineSection {
    const s: OutlineSection = { key, heading, items: [], blocks: [] };
    sections.push(s);
    cur = s;
    return s;
  }

  // 지금 열려 있는 '경우 구역'의 주인. 제목 블록에서 끊긴다.
  let curCase: OutlineItem | null = null;

  for (const b of blocks) {
    const key = blockKeyOf(b);
    if (b.type === 'heading') {
      open(b, key);
      curCase = null;             // 제목은 번호·rail과 마찬가지로 구역도 끊는다
      continue;
    }
    const sec: OutlineSection = cur ?? open(null, key);
    sec.blocks.push(b);

    if (isCaseBlock(b.type)) {
      const label = labels.get(key) ?? null;
      const { title, body } = splitCaseTitle(b.raw_text || '');
      if (title) {
        const item: OutlineItem = {
          kind: 'case',
          itemKey: key,
          sub: b.type === 'subcase',
          labeled: !!label,
          head: injectCaseLabel(title, label),
          body,
          segment: [],
          pinned: [],
        };
        sec.items.push(item);
        curCase = item;           // 여기서부터 다음 제목 있는 경우까지가 이 항목의 구역
      } else if (curCase) {
        // 이어짓기 — 경계가 아니라 직전 경우의 연속이다. 구역에 딸려 들어간다.
        curCase.segment!.push(b);
        if (b.showInSummary) curCase.pinned!.push(b);
      }
      continue;
    }

    // 경우 아래에 놓인 블록은 그 경우가 거느린다. 작성자가 경우 본문의 일부를
    // 들여쓰기 블록 등으로 떼어내도 제목을 눌러 그 전부를 열 수 있어야 하기 때문이다
    // (떼어낸 순간 요약에서 사라지면 분리 자체가 불가능해진다).
    if (curCase) {
      curCase.segment!.push(b);
      if (b.showInSummary) curCase.pinned!.push(b);
      continue;
    }

    // ── 여기부터는 '첫 경우보다 위' 또는 '경우가 없는 섹션' ──
    // 작성자가 고른 블록은 스켈레톤에도 남긴다 (자동 포함 외의 유일한 경로).
    if (b.showInSummary) {
      sec.items.push({ kind: 'block', itemKey: key, head: '', block: b });
      continue;
    }

    if (!SCANNED_TYPES.has(b.type)) continue;

    // 텍스트 계열: Phase 54 레거시 케이스 라벨만 구조 항목으로 승격한다.
    // 라벨은 한 블록에 여럿 들어가는 것이 표준 형태이므로 반드시 행 단위로 훑는다 (v3 F3).
    (b.raw_text || '').split('\n').forEach((line, i) => {
      const isSub = LEGACY_SUBCASE_RE.test(line);
      if (!LEGACY_CASE_RE.test(line) && !isSub) return;
      sec.items.push({
        kind: 'case',
        itemKey: `${key}:${i}`,
        sub: isSub,
        labeled: true,               // 라벨이 원문에 이미 있다 → dot을 그린다
        head: isSub ? line.replace(/^-[ \t]+/, '') : line,
        // body 없음 = 여닫이 대상 아님 (레거시 본문은 뒤따르는 자유 텍스트라 경계가 없다)
      });
    });
  }

  return sections;
}

/** 토글 활성 조건 (D14) — 제목도 경우도 고른 블록도 없으면 보여줄 스켈레톤이 없다.
 *  ⚠ Phase 59a로 발췌가 사라지면서 이 게이트가 닫히는 문항이 늘었다("`**`만 있던
 *    풀이"가 전부 해당). 그래서 OutlineToggle의 disabled 툴팁 문구도 함께 고쳤다. */
export function hasOutlineContent(sections: OutlineSection[]): boolean {
  return sections.some((s) => s.heading !== null || s.items.length > 0);
}
