/**
 * Phase 68 — `lib/mathSlots.ts` 회귀. 기본 8종 "확장 → 자리마다 입력 → Tab" 왕복으로 **최종 문서와 각 단계 선택 범위**를
 * 고정한다(N1 — CM snippet() 위치 버그의 재발 방지). `@codemirror/state`만으로 Node에서 돈다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
/* ⚠ 컴파일된 lib는 CJS로 @codemirror/state를 require한다. 여기서 ESM으로 import하면 **다른 복사본**이 되어
   StateField가 "Field is not present"로 거절된다(dual package hazard) — 같은 CJS 인스턴스를 쓴다. */
const { EditorState, EditorSelection } = createRequire(import.meta.url)('@codemirror/state');

const { slotsField, setSlots, insertWithSlots, nextSlotCmd, prevSlotCmd, hasActiveSlots } = await import('../.test-build/lib/mathSlots.js');
const { DEFAULT_ABBREVS } = await import('../.test-build/lib/mathInput.js');

function editor(doc, cursor = doc.length) {
  const target = {
    state: EditorState.create({ doc, selection: EditorSelection.cursor(cursor), extensions: [slotsField] }),
    dispatch(tr) { target.state = tr.state; },
  };
  return target;
}
const sel = (t) => { const m = t.state.selection.main; return [m.from, m.to]; };
const type = (t, text) => {
  const { from, to } = t.state.selection.main;
  t.dispatch(t.state.update({ changes: { from, to, insert: text }, selection: EditorSelection.cursor(from + text.length), userEvent: 'input.type' }));
};

test('8종: 확장 → 자리마다 입력 → Tab 끝까지 — 최종 문서·각 단계 선택 고정', () => {
  const fills = ['A', 'bb', 'ccc', 'dddd'];
  const want = {
    b1: '\\overline{\\mathrm{A}}',
    b2: '{\\overline{\\mathrm{A}}}^{2}',
    log: '\\log_{A}{bb}',
    sq: '\\sqrt{A}',
    root: '\\sqrt[A]{bb}',
    lim: '\\lim_{A \\to bb}{ccc}',
    int: '\\int_{A}^{bb}{ccc dx}',
    sum: '\\sum_{k=A}^{bb}{ccc}',
  };
  for (const [k, content] of Object.entries(DEFAULT_ABBREVS)) {
    const t = editor('$' + k + '$', 1 + k.length);            // `$lim|$`
    insertWithSlots(t, 1, 1 + k.length, content);
    const nSlots = (content.match(/▢/g) || []).length;
    let i = 0;
    for (;;) {
      assert.ok(hasActiveSlots(t.state), `${k}: 자리 ${i} 활성`);
      const [f, to] = sel(t);
      assert.equal(f, to, `${k}: 빈 자리는 커서`);
      type(t, fills[i]);
      assert.ok(hasActiveSlots(t.state), `${k}: 입력 뒤에도 활성`);
      const moved = nextSlotCmd(t);
      assert.ok(moved, `${k}: Tab ${i}`);
      i++;
      if (i === nSlots) break;
    }
    assert.equal(hasActiveSlots(t.state), false, `${k}: 탈출 자리로 가며 해제`);
    assert.equal(t.state.doc.toString(), '$' + want[k] + '$', k);
    assert.deepEqual(sel(t), [t.state.doc.length - 1, t.state.doc.length - 1], `${k}: 커서 = 닫는 $ 앞`);
    assert.equal(nextSlotCmd(t), false);
  }
});

test('자리 1개(탈출뿐)면 상태 없음 · 커서 끝', () => {
  const t = editor('$x$', 2);
  insertWithSlots(t, 2, 2, '\\alpha');
  assert.equal(t.state.doc.toString(), '$x\\alpha$');
  assert.equal(hasActiveSlots(t.state), false);
  assert.deepEqual(sel(t), [8, 8]);
});

test('선택 대체 · undo 1단계(한 트랜잭션)', () => {
  const t = editor('$abc$', 4);
  t.dispatch(t.state.update({ selection: EditorSelection.range(1, 4) }));
  insertWithSlots(t, 1, 4, DEFAULT_ABBREVS.sq);
  assert.equal(t.state.doc.toString(), '$\\sqrt{}$');
  assert.deepEqual(sel(t), [7, 7]);
});

test('Shift+Tab: 채운 자리로 돌아가면 그 텍스트가 선택된다 · 첫 자리에서 false', () => {
  const t = editor('$$', 1);
  insertWithSlots(t, 1, 1, DEFAULT_ABBREVS.log);
  assert.equal(prevSlotCmd(t), false);
  type(t, '2');
  nextSlotCmd(t);
  type(t, '8');
  assert.ok(prevSlotCmd(t));
  assert.deepEqual(sel(t), [7, 8]);                           // `\log_{2}` 의 `2`
  assert.equal(t.state.doc.toString(), '$\\log_{2}{8}$');
});

test('활성 자리 밖으로 선택이 나가면 해제 · 자리 안 이동은 유지', () => {
  const t = editor('$$', 1);
  insertWithSlots(t, 1, 1, DEFAULT_ABBREVS.lim);
  type(t, 'xy');
  const [f] = sel(t);
  t.dispatch(t.state.update({ selection: EditorSelection.cursor(f - 1) }));   // 자리 안 왼쪽으로
  assert.ok(hasActiveSlots(t.state));
  t.dispatch(t.state.update({ selection: EditorSelection.cursor(0) }));       // 밖
  assert.equal(hasActiveSlots(t.state), false);
});

test('undo·redo userEvent → 해제', () => {
  const t = editor('$$', 1);
  insertWithSlots(t, 1, 1, DEFAULT_ABBREVS.sq);
  assert.ok(hasActiveSlots(t.state));
  t.dispatch(t.state.update({ changes: { from: 1, to: t.state.doc.length - 1, insert: 'sq' }, selection: EditorSelection.cursor(3), userEvent: 'undo' }));
  assert.equal(hasActiveSlots(t.state), false);
});

test('효과 트랜잭션은 매핑하지 않는다(변경 뒤 좌표를 그대로) · 중첩 확장은 옛 자리를 대체', () => {
  const t = editor('$$', 1);
  insertWithSlots(t, 1, 1, DEFAULT_ABBREVS.int);               // 자리 7·10·12 (문서 `$\int_{}^{}{ dx}$`)
  const v1 = t.state.field(slotsField);
  assert.deepEqual(v1.ranges.map((r) => r.from), [7, 10, 12, 16]);
  nextSlotCmd(t); nextSlotCmd(t);                               // 셋째 자리(피적분함수)
  type(t, 'sq');
  const [f, to] = sel(t);
  insertWithSlots(t, f - 2, to, DEFAULT_ABBREVS.sq);           // 중첩 확장(② 약어)
  const v2 = t.state.field(slotsField);
  assert.equal(v2.active, 0);
  assert.equal(v2.ranges.length, 2);
  assert.equal(t.state.doc.toString(), '$\\int_{}^{}{\\sqrt{} dx}$');
  assert.deepEqual(sel(t), [18, 18]);
  type(t, 'x');
  assert.ok(nextSlotCmd(t));                                    // 탈출 자리(= `\sqrt{x}` 뒤)
  assert.equal(hasActiveSlots(t.state), false);
  assert.deepEqual(sel(t), [20, 20]);
});
