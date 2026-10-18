/**
 * M10 J — `lib/blockEdges.ts` 회귀. 앞뒤 빈 줄 제거의 단일 원천 · 경우 이어짓기 보호(P26) · `edgeChanges` ≡ `trimBlockEdges`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const E = await import('../.test-build/lib/blockEdges.js');

const apply = (s, ch) => {
  let o = s;
  for (const c of [...ch].sort((a, b) => b.from - a.from)) o = o.slice(0, c.from) + c.insert + o.slice(c.to);
  return o;
};

test('일반 블록: 앞뒤 빈 줄(공백 줄 포함) 제거 · 들여쓰기·중간 빈 줄 보존', () => {
  assert.equal(E.trimBlockEdges('\n\n본문\n\n'), '본문');
  assert.equal(E.trimBlockEdges('  \n \n  x\n \n'), '  x');
  assert.equal(E.trimBlockEdges('a\n\n\nb'), 'a\n\n\nb');
  assert.equal(E.trimBlockEdges('## '), '## ');
  assert.equal(E.trimBlockEdges(''), '');
  assert.equal(E.trimBlockEdges('\n\n'), '');
});

test('저장 정규화의 옛 정규식과 같은 결과(일반 블록)', () => {
  const old = (t) => t.replace(/^\s*\n/, '').replace(/\n\s*$/, '');
  for (const s of ['\n\na\n\n', 'a', '  \n x\n \n', '\n\n\n', '', 'a\n\n', '  \n  \nbody', '$$\nx\n$$\n']) {
    for (const ty of [undefined, 'text', 'heading', 'list', 'choices']) assert.equal(E.trimBlockEdges(s, ty), old(s), JSON.stringify([s, ty]));
  }
});

test('경우 이어짓기(P26): case·subcase의 빈 첫 줄은 하나만 남긴다', () => {
  for (const ty of ['case', 'subcase']) {
    assert.equal(E.trimBlockEdges('\n본문', ty), '\n본문');
    assert.equal(E.trimBlockEdges('\n\n\n본문\n\n', ty), '\n본문');
    assert.equal(E.trimBlockEdges('  \n본문', ty), '\n본문');
    assert.equal(E.trimBlockEdges('\n\n', ty), '');
    assert.equal(E.trimBlockEdges('조건\n본문\n', ty), '조건\n본문');   // 제목 있는 경우는 일반 규칙
  }
  assert.equal(E.isContinuationLead('\n본문', 'case'), true);
  assert.equal(E.isContinuationLead('\n본문', 'text'), false);
  assert.equal(E.isContinuationLead('조건\n본문', 'case'), false);
});

test('edgeChanges ≡ trimBlockEdges (표본 × 타입) · 통째 교체 없음', () => {
  const S = ['\n\na\n\n', 'a', '\nbody', '\n\nbody\n', '  \n x\n \n', '\n\n\n', '', 'a\n\n', '  \n  \nbody', '\n$$\nx\n$$\n\n'];
  for (const s of S) {
    for (const ty of [undefined, 'text', 'case', 'subcase']) {
      const ch = E.edgeChanges(s, ty);
      assert.equal(apply(s, ch), E.trimBlockEdges(s, ty), JSON.stringify([s, ty]));
      if (E.trimBlockEdges(s, ty) === s) assert.equal(ch.length, 0, 'no-op이면 changes 0');
      // 내용이 남는 한 본문 구간은 건드리지 않는다(앞·뒤 두 구간뿐)
      if (E.trimBlockEdges(s, ty)) for (const c of ch) assert.ok(c.from === 0 || c.to === s.length, JSON.stringify(c));
    }
  }
});
