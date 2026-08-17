/**
 * Phase 59 Stage 1 검증 — 경우 블록 자동 번호 · 라벨 주입 · 구조 보기 모델.
 *
 * 실행: npm run test:case
 * (lib/solutionOutline.ts를 tsc로 뽑아 Node에서 직접 돌린다. exportMd 하니스와 동일 방식)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCaseLabels, buildCaseGapKeys, injectCaseLabel, splitCaseTitle, letters, caseClassName } from '../.test-build/lib/caseBlock.js';
import { buildOutline, extractKeySentences, hasOutlineContent } from '../.test-build/lib/solutionOutline.js';

let seq = 0;
const B = (type, raw_text) => ({ id: `b${seq++}`, block_key: `k${seq}`, type, raw_text, order: seq });

/* ═══ 자동 번호 ═══ */

test('경우 3개 + 하위 2개 → C-1 · C-2 · C-2-a · C-2-b · C-3', () => {
  const blocks = [
    B('text', '준비'),
    B('case', '$a>1$인 경우\n본문'),
    B('case', '$a=1$인 경우\n본문'),
    B('subcase', '$b>0$일 때\n본문'),
    B('subcase', '$b<0$일 때\n본문'),
    B('case', '$a<1$인 경우\n본문'),
  ];
  const m = buildCaseLabels(blocks);
  assert.deepEqual(
    blocks.filter((b) => b.type !== 'text').map((b) => m.get(b.block_key)),
    ['C-1', 'C-2', 'C-2-a', 'C-2-b', 'C-3'],
  );
});

test('제목 블록에서 번호가 리셋된다', () => {
  const blocks = [B('case', '가\n'), B('heading', '## 다른 접근'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[0].block_key), 'C-1');
  assert.equal(m.get(blocks[2].block_key), 'C-1');
});

test('경우 사이에 일반 블록이 끼어도 번호는 이어진다', () => {
  const blocks = [B('case', '가\n'), B('text', '설명'), B('image', '<img src="x">'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[3].block_key), 'C-2');
});

test('이어짓기(첫 줄 빈 case)는 번호를 받지 않는다', () => {
  const blocks = [B('case', '가\n본문'), B('image', '<img src="x">'), B('case', '\n이어지는 본문'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[0].block_key), 'C-1');
  assert.equal(m.get(blocks[2].block_key), undefined);   // dot·번호 없음
  assert.equal(m.get(blocks[3].block_key), 'C-2');       // 이어짓기가 번호를 소모하지 않는다
});

test('상위 case 없는 subcase는 C-1-a로 친다 (데이터 불변)', () => {
  const blocks = [B('subcase', '단독\n')];
  assert.equal(buildCaseLabels(blocks).get(blocks[0].block_key), 'C-1-a');
});

test('letters: base-26 (fromCharCode 단독의 { 버그 방지)', () => {
  assert.equal(letters(1), 'a');
  assert.equal(letters(26), 'z');
  assert.equal(letters(27), 'aa');
  assert.equal(letters(28), 'ab');
});

/* ═══ rail 관통 구간 (gap) ═══ */

test('경우 안에 낀 이미지는 gap이 된다 (rail 관통)', () => {
  const blocks = [B('case', '가\n본문'), B('image', '<img src="x">'), B('case', '\n이어짐'), B('case', '나\n')];
  const g = buildCaseGapKeys(blocks);
  assert.equal(g.has(blocks[1].block_key), true);
  assert.equal(g.size, 1);
});

test('첫 경우 앞·마지막 경우 뒤의 블록은 gap이 아니다 (rail은 첫 dot~마지막 dot)', () => {
  const blocks = [B('text', '도입'), B('case', '가\n'), B('image', '<img>'), B('case', '나\n'), B('text', '마무리')];
  const g = buildCaseGapKeys(blocks);
  assert.deepEqual([...g], [blocks[2].block_key]);
});

test('제목 블록은 런을 끊는다 — 섹션마다 따로 계산', () => {
  const blocks = [
    B('case', '가\n'), B('image', '<img>'), B('case', '나\n'),   // 런 1
    B('heading', '## 다른 접근'),
    B('text', '설명'),                                            // 어느 런에도 속하지 않는다
    B('case', '다\n'), B('text', '중간'), B('case', '라\n'),      // 런 2
  ];
  const g = buildCaseGapKeys(blocks);
  assert.equal(g.has(blocks[1].block_key), true);
  assert.equal(g.has(blocks[4].block_key), false);
  assert.equal(g.has(blocks[6].block_key), true);
  assert.equal(g.size, 2);
});

test('경우가 하나뿐이면 gap이 없다', () => {
  const blocks = [B('case', '가\n'), B('image', '<img>'), B('text', '설명')];
  assert.equal(buildCaseGapKeys(blocks).size, 0);
});

test('하위경우도 런의 구성원이다', () => {
  const blocks = [B('case', '가\n'), B('image', '<img>'), B('subcase', '가-1\n')];
  assert.equal(buildCaseGapKeys(blocks).has(blocks[1].block_key), true);
});

/* ═══ 제목행 분리·라벨 주입 ═══ */

test('splitCaseTitle: 첫 줄이 제목, 공백뿐이면 이어짓기', () => {
  assert.deepEqual(splitCaseTitle('제목\n본문1\n본문2'), { title: '제목', body: '본문1\n본문2' });
  assert.deepEqual(splitCaseTitle('제목만'), { title: '제목만', body: '' });
  assert.deepEqual(splitCaseTitle('   \n본문'), { title: '', body: '본문' });
});

test('injectCaseLabel: 첫 줄 앞에 span + 제목행 뒤 빈 줄 보장', () => {
  // 빈 줄이 없으면 $$…$$가 제목행 문단에 흡수돼 인라인으로 렌더된다 → 렌더 시 정규화
  assert.equal(
    injectCaseLabel('$a>1$인 경우\n$$x=1$$\n끝', 'C-2'),
    '<span class="case-label">C-2.</span> $a>1$인 경우\n\n$$x=1$$\n끝',
  );
  // 이미 빈 줄이 있으면 그대로 (빈 줄이 두 개로 늘지 않는다)
  assert.equal(
    injectCaseLabel('제목\n\n본문', 'C-1'),
    '<span class="case-label">C-1.</span> 제목\n\n본문',
  );
  assert.equal(injectCaseLabel('제목만', 'C-1'), '<span class="case-label">C-1.</span> 제목만');
  assert.equal(injectCaseLabel('\n본문', 'C-1'), '\n본문');   // 이어짓기는 손대지 않는다
});

test('injectCaseLabel은 수식 개수를 바꾸지 않는다 (data-math-id 매핑 보존)', () => {
  const raw = '$a>1$인 경우\n본문 $x$ 와 $y$';
  const count = (s) => (s.match(/\$/g) || []).length;
  assert.equal(count(injectCaseLabel(raw, 'C-1')), count(raw));
});

test('caseClassName', () => {
  assert.equal(caseClassName('case', true), 'case-block');
  assert.equal(caseClassName('subcase', true), 'case-block case-sub');
  assert.equal(caseClassName('case', false), 'case-block case-cont');
  assert.equal(caseClassName('case', true, { closed: true }), 'case-block case-closed');
});

/* ═══ key 발췌 ═══ */

test('extractKeySentences: 마커를 포함해 뽑는다', () => {
  assert.deepEqual(extractKeySentences('앞 **핵심이다** 뒤'), ['**핵심이다**']);
  assert.deepEqual(extractKeySentences('**$x=1$일 때 최소**'), ['**$x=1$일 때 최소**']);
  assert.deepEqual(extractKeySentences('강조 없음'), []);
});

test('extractKeySentences: Phase 54 레거시 라벨 행은 통째로 제외', () => {
  assert.deepEqual(extractKeySentences('**Case 1.** 조건'), []);
  assert.deepEqual(extractKeySentences('- **Case 1a.** 조건'), []);
  // 라벨 행이 아닌 곳의 강조는 그대로 살린다
  assert.deepEqual(extractKeySentences('**Case 1.** 조건\n**진짜 핵심**'), ['**진짜 핵심**']);
});

/* ═══ 구조 보기 ═══ */

test('buildOutline: 제목이 섹션 경계, 첫 제목 앞은 전문 섹션', () => {
  const blocks = [
    B('text', '전문 **한 줄**'),
    B('heading', '## 1단계'),
    B('text', '설명 **핵심 A**'),
    B('heading', '## 2단계'),
    B('text', '설명'),
  ];
  const s = buildOutline(blocks);
  assert.equal(s.length, 3);
  assert.equal(s[0].heading, null);
  assert.equal(s[0].items[0].head, '**한 줄**');
  assert.equal(s[1].heading.raw_text, '## 1단계');
  assert.equal(s[1].items[0].head, '**핵심 A**');
  assert.equal(s[2].items.length, 0);           // 발췌 없는 섹션은 제목만 남는다
});

test('buildOutline: 경우 항목은 제목행 + 본문 발췌, 제목행 자체는 발췌에서 제외', () => {
  const blocks = [B('case', '**$a>1$인 경우**\n본문 **본문 핵심** 이어짐')];
  const [sec] = buildOutline(blocks);
  const item = sec.items[0];
  assert.equal(item.kind, 'case');
  assert.equal(item.head, '<span class="case-label">C-1.</span> **$a>1$인 경우**');
  assert.equal(item.keys, '**본문 핵심**');     // 제목행의 강조는 중복 표시하지 않는다
  assert.equal(item.body, '본문 **본문 핵심** 이어짐');
});

test('buildOutline: 레거시 Case 라벨은 한 블록 안에서 여럿이어도 전부 항목이 된다', () => {
  const blocks = [B('text',
    '**Case 1.** $a>1$\n내용 **중요**\n**Case 2.** $a<1$\n- **Case 2a.** $b>0$\n마무리')];
  const [sec] = buildOutline(blocks);
  const kinds = sec.items.map((i) => `${i.kind}${i.sub ? ':sub' : ''}`);
  assert.deepEqual(kinds, ['case', 'keys', 'case', 'case:sub']);
  assert.equal(sec.items[0].head, '**Case 1.** $a>1$');
  assert.equal(sec.items[1].head, '**중요**');
  assert.equal(sec.items[3].head, '**Case 2a.** $b>0$');   // 리스트 마커는 떼고 우리 들여쓰기를 쓴다
  assert.equal(sec.items[3].body, undefined);              // 레거시는 여닫이 대상이 아니다
});

test('buildOutline: 이미지·선택지는 스켈레톤에 남지 않는다', () => {
  const blocks = [B('image', '<img src="x">'), B('choices', '① 1\n② 2'), B('svg', 'https://x')];
  const [sec] = buildOutline(blocks);
  assert.equal(sec.items.length, 0);
  assert.equal(hasOutlineContent(buildOutline(blocks)), false);   // D14 게이트
});

test('hasOutlineContent: 제목만 있어도 true', () => {
  assert.equal(hasOutlineContent(buildOutline([B('heading', '## 접근')])), true);
  assert.equal(hasOutlineContent(buildOutline([B('text', '강조 없는 문단')])), false);
});

test('buildOutline: 이어짓기 블록은 발췌만 남긴다', () => {
  const blocks = [B('case', '가\n본문'), B('case', '\n이어짐 **핵심**')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['case', 'keys']);
  assert.equal(sec.items[1].head, '**핵심**');
});
