/**
 * Phase 59 Stage 1 검증 — 경우 블록 자동 번호 · 라벨 주입 · 구조 보기 모델.
 *
 * 실행: npm run test:case
 * (lib/solutionOutline.ts를 tsc로 뽑아 Node에서 직접 돌린다. exportMd 하니스와 동일 방식)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCaseLabels, buildCaseGapKeys, injectCaseLabel, splitCaseTitle, letters, caseClassName, convertCaseRefs } from '../.test-build/lib/caseBlock.js';
import { buildOutline, hasOutlineContent } from '../.test-build/lib/solutionOutline.js';

let seq = 0;
const B = (type, raw_text) => ({ id: `b${seq++}`, block_key: `k${seq}`, type, raw_text, order: seq });

/* ═══ 자동 번호 ═══ */

test('경우 3개 + 하위 2개 → C1 · C2 · C2a · C2b · C3', () => {
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
    ['C1', 'C2', 'C2a', 'C2b', 'C3'],
  );
});

test('제목 블록에서 번호가 리셋된다', () => {
  const blocks = [B('case', '가\n'), B('heading', '## 다른 접근'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[0].block_key), 'C1');
  assert.equal(m.get(blocks[2].block_key), 'C1');
});

test('경우 사이에 일반 블록이 끼어도 번호는 이어진다', () => {
  const blocks = [B('case', '가\n'), B('text', '설명'), B('image', '<img src="x">'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[3].block_key), 'C2');
});

test('이어짓기(첫 줄 빈 case)는 번호를 받지 않는다', () => {
  const blocks = [B('case', '가\n본문'), B('image', '<img src="x">'), B('case', '\n이어지는 본문'), B('case', '나\n')];
  const m = buildCaseLabels(blocks);
  assert.equal(m.get(blocks[0].block_key), 'C1');
  assert.equal(m.get(blocks[2].block_key), undefined);   // dot·번호 없음
  assert.equal(m.get(blocks[3].block_key), 'C2');       // 이어짓기가 번호를 소모하지 않는다
});

test('상위 case 없는 subcase는 C1a로 친다 (데이터 불변)', () => {
  const blocks = [B('subcase', '단독\n')];
  assert.equal(buildCaseLabels(blocks).get(blocks[0].block_key), 'C1a');
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
    injectCaseLabel('$a>1$인 경우\n$$x=1$$\n끝', 'C2'),
    '<span class="case-label">C2.</span> $a>1$인 경우\n\n$$x=1$$\n끝',
  );
  // 이미 빈 줄이 있으면 그대로 (빈 줄이 두 개로 늘지 않는다)
  assert.equal(
    injectCaseLabel('제목\n\n본문', 'C1'),
    '<span class="case-label">C1.</span> 제목\n\n본문',
  );
  assert.equal(injectCaseLabel('제목만', 'C1'), '<span class="case-label">C1.</span> 제목만');
  assert.equal(injectCaseLabel('\n본문', 'C1'), '\n본문');   // 이어짓기는 손대지 않는다
});

test('injectCaseLabel은 수식 개수를 바꾸지 않는다 (data-math-id 매핑 보존)', () => {
  const raw = '$a>1$인 경우\n본문 $x$ 와 $y$';
  const count = (s) => (s.match(/\$/g) || []).length;
  assert.equal(count(injectCaseLabel(raw, 'C1')), count(raw));
});

test('caseClassName', () => {
  assert.equal(caseClassName('case', true), 'case-block');
  assert.equal(caseClassName('subcase', true), 'case-block case-sub');
  assert.equal(caseClassName('case', false), 'case-block case-cont');
  assert.equal(caseClassName('case', true, { closed: true }), 'case-block case-closed');
});

/* ═══ Phase 59a — `**` 발췌 폐기 ═══
   Phase 59는 `**…**`를 요약에 따로 뽑아 보여줬다(kind:'keys'). 하나의 마커가
   강조·발췌·톤 트리거 3역을 겸해 "강조 범위"와 "요약 범위"가 묶여 있었기에 폐기했다.
   아래 두 테스트가 그 폐기를 못 박는다 — 되살아나면 여기서 잡힌다. */

test('Phase 59a: `**`는 요약에 아무 항목도 만들지 않는다', () => {
  const blocks = [B('text', '앞 **핵심이다** 뒤\n**$x=1$일 때 최소**')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items, []);
});

test('Phase 59a: `**`만 있는 풀이는 요약 보기 게이트를 열지 않는다', () => {
  // 제목도 경우도 없으면 보여줄 뼈대가 없다 → 훅이 full로 강제 해제한다
  assert.equal(hasOutlineContent(buildOutline([B('text', '설명 **핵심**')])), false);
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
  assert.equal(s[0].heading, null);             // 첫 제목 앞은 전문 섹션
  assert.equal(s[1].heading.raw_text, '## 1단계');
  assert.equal(s[2].heading.raw_text, '## 2단계');
  // Phase 59a: 본문의 `**`는 항목이 되지 않는다 → 세 섹션 모두 항목 0
  assert.deepEqual(s.map((x) => x.items.length), [0, 0, 0]);
  // 펼침 원본은 그대로 들고 있어야 한다(요약을 끄면 보여줄 것)
  assert.deepEqual(s.map((x) => x.blocks.length), [1, 1, 1]);
});

test('buildOutline: 경우 항목은 제목행 + 펼침용 본문 (Phase 59a: 발췌 없음)', () => {
  const blocks = [B('case', '**$a>1$인 경우**\n본문 **본문 핵심** 이어짐')];
  const [sec] = buildOutline(blocks);
  const item = sec.items[0];
  assert.equal(item.kind, 'case');
  assert.equal(item.head, '<span class="case-label">C1.</span> **$a>1$인 경우**');
  assert.equal(item.body, '본문 **본문 핵심** 이어짐');   // 펼치면 통째로 나온다
  assert.equal(item.keys, undefined);                     // 접으면 제목행만
});

test('buildOutline: 레거시 Case 라벨은 한 블록 안에서 여럿이어도 전부 항목이 된다', () => {
  const blocks = [B('text',
    '**Case 1.** $a>1$\n내용 **중요**\n**Case 2.** $a<1$\n- **Case 2a.** $b>0$\n마무리')];
  const [sec] = buildOutline(blocks);
  const kinds = sec.items.map((i) => `${i.kind}${i.sub ? ':sub' : ''}`);
  // Phase 59a: 라벨 행만 항목이 된다. 사이의 `내용 **중요**`는 더 이상 발췌되지 않는다
  assert.deepEqual(kinds, ['case', 'case', 'case:sub']);
  assert.equal(sec.items[0].head, '**Case 1.** $a>1$');
  assert.equal(sec.items[1].head, '**Case 2.** $a<1$');
  assert.equal(sec.items[2].head, '**Case 2a.** $b>0$');   // 리스트 마커는 떼고 우리 들여쓰기를 쓴다
  assert.equal(sec.items[2].body, undefined);              // 레거시는 여닫이 대상이 아니다
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

test('buildOutline: 이어짓기 블록은 요약에 남지 않는다 (Phase 59a)', () => {
  // 직전 경우의 연속이라 독립 항목이 될 근거가 없다. 요약에 남기려면 그 내용을
  // 경우 '사이 블록'에 두고 그 블록의 showInSummary를 켠다.
  const blocks = [B('case', '가\n본문'), B('case', '\n이어짐 **핵심**')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['case']);
  assert.equal(sec.blocks.length, 2);           // 펼침 원본에는 둘 다 있다
});

test('buildOutline: 작성자가 고른 그림만 요약에 남는다', () => {
  const marked = { ...B('image', '<img src="a">'), showInSummary: true };
  const blocks = [B('heading', '## 접근'), B('image', '<img src="b">'), marked, B('text', '설명')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['block']);      // 표시 안 한 그림은 빠진다
  assert.equal(sec.items[0].block.raw_text, '<img src="a">');
});

test('buildOutline: 고른 그림만 있어도 요약 보기가 활성된다 (D14 게이트)', () => {
  const blocks = [{ ...B('image', '<img src="a">'), showInSummary: true }];
  assert.equal(hasOutlineContent(buildOutline(blocks)), true);
});

test('buildOutline: "요약에 넣기"는 블록 종류를 가리지 않는다 (표를 담은 텍스트·글상자)', () => {
  const table = '| 구간 | 부호 |\n|---|---|\n| $x<0$ | 음 |';
  const blocks = [
    B('text', '앞 문단 **핵심**'),
    { ...B('text', table), showInSummary: true },
    B('text', '| 안 보일 | 표 |\n|---|---|\n| a | b |'),
    { ...B('box', '글상자 요약'), showInSummary: true },
  ];
  const [sec] = buildOutline(blocks);
  // Phase 59a: 앞 문단의 `**핵심**`은 항목이 되지 않는다 → 고른 블록 둘만 남는다
  assert.deepEqual(sec.items.map((i) => i.kind), ['block', 'block']);
  assert.equal(sec.items[0].block.raw_text, table);
  assert.equal(sec.items[1].block.raw_text, '글상자 요약');
});

test('buildOutline: 넣기로 한 블록은 통째로 한 항목이다', () => {
  const blocks = [{ ...B('text', '설명 **핵심이다** 뒤'), showInSummary: true }];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['block']);
});

test('Phase 59a: 경우 블록의 showInSummary는 읽히지 않는다 (스위치 은닉과 짝)', () => {
  // 경우 제목행은 자동으로 항목이 되므로 스위치가 할 일이 없다. 편집창도 case 계열에는
  // 스위치를 노출하지 않는다 → 남아 있는 true 값은 조용히 무시되어야 한다(마이그레이션 0).
  const blocks = [{ ...B('case', '조건\n본문'), showInSummary: true }];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['case']);   // 'block'이 아니라 'case'
  assert.equal(sec.items[0].head, '<span class="case-label">C1.</span> 조건');
});

/* ═══ Phase 59a 후속 — 경우 구역(segment) ═══
   경우 제목행을 누르면 그 경우 블록 하나가 아니라 '구역' 전체가 열려야 한다.
   구역 = 자기 자신 + 다음 **제목행 있는** 경우 전까지. 그래야 작성자가 경우 본문의
   일부를 들여쓰기 블록 등으로 떼어내도 요약에서 그 뒷부분에 닿을 수 있다. */

test('구역: 경우는 뒤따르는 블록을 거느리고, 다음 경우에서 끊긴다', () => {
  const blocks = [
    B('case', 'C1 조건\nC1 본문'),
    B('callout', '떼어낸 들여쓰기'),
    B('text', 'C1 나머지'),
    B('case', 'C2 조건\nC2 본문'),
    B('text', 'C2 나머지'),
  ];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['case', 'case']);
  assert.deepEqual(sec.items[0].segment.map((b) => b.raw_text), ['떼어낸 들여쓰기', 'C1 나머지']);
  assert.deepEqual(sec.items[1].segment.map((b) => b.raw_text), ['C2 나머지']);   // 마지막은 섹션 끝까지
});

test('구역: 하위 경우도 경계가 된다', () => {
  const blocks = [B('case', 'C1\n본문'), B('text', 'C1 뒤'), B('subcase', 'C1a\n본문'), B('text', 'C1a 뒤')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => `${i.kind}${i.sub ? ':sub' : ''}`), ['case', 'case:sub']);
  assert.deepEqual(sec.items[0].segment.map((b) => b.raw_text), ['C1 뒤']);
  assert.deepEqual(sec.items[1].segment.map((b) => b.raw_text), ['C1a 뒤']);
});

test('구역: 이어짓기는 경계가 아니라 직전 경우에 딸려 들어간다', () => {
  // 이어짓기의 정의가 "직전 경우의 연속"이므로 구역을 끊으면 안 된다.
  // (Stage 3에서 요약에서 사라졌던 이어짓기 내용이 이 경로로 다시 닿는다)
  const blocks = [
    B('case', 'C1\n본문'),
    B('image', '<img src="a">'),
    B('case', '\n이어지는 내용'),
    B('text', '더'),
    B('case', 'C2\n본문'),
  ];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['case', 'case']);
  assert.deepEqual(sec.items[0].segment.map((b) => b.type), ['image', 'case', 'text']);
});

test('구역: 제목 블록에서 끊긴다', () => {
  const blocks = [B('case', 'C1\n본문'), B('text', 'C1 뒤'), B('heading', '## 다음'), B('text', '새 섹션')];
  const s = buildOutline(blocks);
  assert.equal(s.length, 2);
  assert.deepEqual(s[0].items[0].segment.map((b) => b.raw_text), ['C1 뒤']);
  assert.equal(s[1].items.length, 0);            // 새 섹션의 텍스트는 어느 구역에도 안 든다
});

test('구역: 첫 경우보다 위의 블록은 어느 구역에도 들지 않는다', () => {
  const blocks = [{ ...B('text', '머리말'), showInSummary: true }, B('case', 'C1\n본문'), B('text', 'C1 뒤')];
  const [sec] = buildOutline(blocks);
  assert.deepEqual(sec.items.map((i) => i.kind), ['block', 'case']);   // 머리말은 독립 항목
  assert.deepEqual(sec.items[1].segment.map((b) => b.raw_text), ['C1 뒤']);
});

test('구역: 요약에 넣은 블록은 pinned에도, segment에도 들어간다 (접힘/펼침 배타 렌더)', () => {
  // 접힘 = pinned만, 펼침 = segment만 그린다. 동시에 그리면 같은 블록이 두 번 나온다.
  const pin = { ...B('callout', '핵심 조건'), showInSummary: true };
  const blocks = [B('case', 'C1\n본문'), pin, B('text', '평범한 뒷부분')];
  const [sec] = buildOutline(blocks);
  const it = sec.items[0];
  assert.deepEqual(it.pinned.map((b) => b.raw_text), ['핵심 조건']);
  assert.deepEqual(it.segment.map((b) => b.raw_text), ['핵심 조건', '평범한 뒷부분']);
});

test('구역: 본문이 비어도 거느린 블록이 있으면 여닫이 대상이다', () => {
  // 제목행만 쓰고 내용을 전부 다음 블록들로 뺀 구성 — 이때도 눌러서 열려야 한다.
  const blocks = [B('case', '조건만 적은 경우'), B('text', '실제 내용')];
  const [sec] = buildOutline(blocks);
  assert.equal(sec.items[0].body, '');
  assert.equal(sec.items[0].segment.length, 1);
});

/* ═══ 개선묶음 M1 G — 본문 C1 참조 강조 ═══ */

test('본문의 C1 · C2a 는 case-ref span으로 감싸진다 (조사가 붙어도)', () => {
  assert.equal(convertCaseRefs('C1에서 보았듯'), '<span class="case-ref" data-reftype="case">C1</span>에서 보았듯');
  assert.equal(convertCaseRefs('C2a 와 C10'),
    '<span class="case-ref" data-reftype="case">C2a</span> 와 <span class="case-ref" data-reftype="case">C10</span>');
});

test('LaTeX 잔재·식별자는 건드리지 않는다', () => {
  // ⚠ 'C12x'는 제외 — letters(24)='x'라 C12x는 **실제로 가능한 라벨**이다(하위 경우 24번째)
  for (const src of ['\\mathrm{C}1', 'C_1', 'AC1', 'C123', 'C1x2']) {
    assert.equal(convertCaseRefs(src), src, src);
  }
});

test('수식 placeholder · 인라인 코드 · 코드펜스 안은 보호', () => {
  assert.equal(convertCaseRefs('`C1` 은 코드'), '`C1` 은 코드');
  assert.equal(convertCaseRefs('```\nC1\n```'), '```\nC1\n```');
});

test('제목행 라벨(case-label span) 안은 이중으로 감싸지 않는다', () => {
  const src = '<span class="case-label">C1.</span> a>1인 경우';
  assert.equal(convertCaseRefs(src), src);
});

test('라벨 span 뒤 본문의 참조는 그대로 잡힌다', () => {
  const src = '<span class="case-label">C2.</span> C1과 같은 방식';
  assert.equal(convertCaseRefs(src),
    '<span class="case-label">C2.</span> <span class="case-ref" data-reftype="case">C1</span>과 같은 방식');
});

test('C+숫자가 없으면 원문 그대로 (빠른 통과)', () => {
  const src = '경우를 나누어 생각하자';
  assert.equal(convertCaseRefs(src), src);
});
