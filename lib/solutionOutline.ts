/* ═══════════════════════════════════════════════════════════════
   Phase 59 — 구조 보기(outline) 모델

   열람 2뷰(ProblemView · ProblemTabContent)만 쓴다. 편집창·FolderView·인쇄는
   항상 전체를 보여주므로 이 모듈을 부르지 않는다 (D4).

   접힌 섹션에 남는 것은 정확히 셋 (D2):
     ① 제목 블록  ② `**…**` 발췌  ③ 경우·하위경우 제목행
   그 외(이미지·SVG·GGB·선택지·발췌 없는 텍스트)는 통째로 숨는다.
   ═══════════════════════════════════════════════════════════════ */

import type { Block } from '../types/problem';
import { KEY_STRONG_RE_GLOBAL } from './keyTone';
import {
  LEGACY_CASE_RE, LEGACY_SUBCASE_RE,
  blockKeyOf, buildCaseLabels, injectCaseLabel, isCaseBlock, splitCaseTitle,
} from './caseBlock';

/** 스켈레톤 한 줄. */
export interface OutlineItem {
  /** 'case' = 경우 제목행(rail·dot 붙음) · 'keys' = key 발췌 묶음 */
  kind: 'case' | 'keys';
  /** 여닫이·React 키. 레거시 항목은 `${blockKey}:${행번호}` */
  itemKey: string;
  /** 하위경우 여부 (렌더 클래스 case-sub) */
  sub?: boolean;
  /** 라벨이 붙는 항목인지 — 없으면 dot이 사라진다(case-cont) */
  labeled?: boolean;
  /** 화면에 그릴 마크다운 (case는 라벨 주입된 제목행, keys는 발췌 합성) */
  head: string;
  /** 경우 본문 원문. undefined면 펼칠 것이 없어 여닫이 대상이 아니다(레거시 항목) */
  body?: string;
  /** 접힌 경우 안에서 보여줄 본문 발췌. 없으면 제목행만 */
  keys?: string;
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

/** 텍스트 계열 — 여기서만 key·레거시 라벨을 찾는다.
 *  ⚠ EditorView의 TEXT_BASED_TYPES와 목적이 다르다(저 상수는 CodeMirror 사용 여부).
 *    image/svg/ggb의 raw_text는 URL이라 `**`가 없어 실질 오탐도 없다. */
const SCANNED_TYPES = new Set([
  'text', 'math_block', 'bullet', 'list', 'callout', 'gana', 'roman', 'box',
]);

/**
 * `**…**` 발췌. 마커를 **포함해** 돌려준다 — 그래야 기존 파이프라인에서
 * <strong>이 되고 Phase 58의 key 복귀 규칙(색 primary + 굵기 600)이 그대로 걸린다.
 *
 * 행 단위로 훑는 이유 둘:
 *   ① Phase 54 레거시 라벨 행(`**Case 1.**`)을 통째로 건너뛰기 위해 — 그 행은
 *      발췌가 아니라 구조 항목으로 승격된다(D2′). 안 거르면 outline이 라벨로 도배된다.
 *   ② 문단을 넘나드는 `**`는 대부분 마커가 아니라 오탐이다.
 */
export function extractKeySentences(raw: string): string[] {
  const out: string[] = [];
  for (const line of raw.split('\n')) {
    if (LEGACY_CASE_RE.test(line) || LEGACY_SUBCASE_RE.test(line)) continue;
    const re = new RegExp(KEY_STRONG_RE_GLOBAL.source, 'g');   // lastIndex 격리
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const inner = m[0].slice(2, -2).trim();
      if (/^Case\s+\d+[a-z]?\.$/.test(inner)) continue;        // 이중 안전망
      out.push(m[0]);
    }
  }
  return out;
}

function joinKeys(keys: string[]): string | undefined {
  return keys.length ? keys.join('\n\n') : undefined;
}

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

  for (const b of blocks) {
    const key = blockKeyOf(b);
    if (b.type === 'heading') {
      open(b, key);
      continue;
    }
    const sec: OutlineSection = cur ?? open(null, key);
    sec.blocks.push(b);

    if (isCaseBlock(b.type)) {
      const label = labels.get(key) ?? null;
      const { title, body } = splitCaseTitle(b.raw_text || '');
      if (title) {
        sec.items.push({
          kind: 'case',
          itemKey: key,
          sub: b.type === 'subcase',
          labeled: !!label,
          head: injectCaseLabel(title, label),
          body,
          keys: joinKeys(extractKeySentences(body)),
        });
      } else {
        // 이어짓기 — 제목행이 없으니 발췌만 남긴다
        const keys = joinKeys(extractKeySentences(b.raw_text || ''));
        if (keys) sec.items.push({ kind: 'keys', itemKey: key, head: keys });
      }
      continue;
    }

    if (!SCANNED_TYPES.has(b.type)) continue;

    // 텍스트 계열: 레거시 케이스 라벨(Phase 54)은 구조 항목으로 승격하고
    // 나머지 행에서만 key를 발췌한다. 라벨은 한 블록에 여럿 들어가는 것이 표준
    // 형태이므로 반드시 행 단위로 훑어야 한다 (v3 F3).
    const pending: string[] = [];
    let group = 0;
    const flush = () => {
      const keys = joinKeys(pending.splice(0));
      if (keys) sec.items.push({ kind: 'keys', itemKey: `${key}:k${group++}`, head: keys });
    };
    (b.raw_text || '').split('\n').forEach((line, i) => {
      const isCase = LEGACY_CASE_RE.test(line);
      const isSub = LEGACY_SUBCASE_RE.test(line);
      if (isCase || isSub) {
        flush();
        sec.items.push({
          kind: 'case',
          itemKey: `${key}:${i}`,
          sub: isSub,
          labeled: true,               // 라벨이 원문에 이미 있다 → dot을 그린다
          head: isSub ? line.replace(/^-[ \t]+/, '') : line,
          // body 없음 = 여닫이 대상 아님 (레거시 본문은 뒤따르는 자유 텍스트라 경계가 없다)
        });
        return;
      }
      pending.push(...extractKeySentences(line));
    });
    flush();
  }

  return sections;
}

/** 토글 활성 조건 (D14) — 제목도 key도 경우도 없으면 보여줄 스켈레톤이 없다. */
export function hasOutlineContent(sections: OutlineSection[]): boolean {
  return sections.some((s) => s.heading !== null || s.items.length > 0);
}
