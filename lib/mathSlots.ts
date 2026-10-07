/**
 * Phase 68 — 수식 단축어의 **입력 자리(slot)** 상태. CodeMirror `@codemirror/state`만 import한다(`npm run test:mathslots`가
 * Node에서 단독 실행 — `EditorView`가 필요 없도록 대상은 `{ state, dispatch }`).
 *
 * ⚠ CM `snippet()`·`snippetKeymap`을 쓰지 않는 이유(착수판 §0-1 N1): `Snippet.parse`의 `\{`·`\}` 이스케이프 제거가
 *   치환 전 index와 이미 감소된 필드 위치를 비교해, 이스케이프가 둘 이상 앞서면 자리가 1~2자 밀린다(프로브 실측 —
 *   `\int_{▢}^{▢}{▢ dx}` 자리 9·13·15, 정답 9·12·14). LaTeX는 `\{`·`\\{`가 흔해 템플릿 이스케이프 자체가 함정이다.
 *   여기서는 `parseSlots`(lib/mathInput)가 준 오프셋을 그대로 쓴다 — 이스케이프 0.
 *
 * 갱신 규칙(CM snippetState 선례, dist 1538-1547):
 *   ① `setSlots` 효과가 있으면 **그 값을 매핑 없이 즉시 반환** — 효과의 좌표는 같은 트랜잭션의 변경 **뒤** 좌표다
 *   ② undo·redo면 해제(접힌 자리가 남아 Tab이 그리로 가는 것을 막는다)
 *   ③ 문서 변경은 `from: mapPos(-1)` · `to: mapPos(+1)` — 빈 자리에 친 글자가 자리에 포함된다
 *   ④ 선택이 활성 자리 밖으로 나가면 해제(마우스·화살표 이탈 = 해제)
 */

import { EditorSelection, EditorState, StateEffect, StateField, Transaction } from '@codemirror/state';
import { parseSlots } from './mathInput';

export interface SlotRange { from: number; to: number }
export interface SlotState { ranges: SlotRange[]; active: number }

/** `EditorView` 없이도 돌릴 수 있게 최소 인터페이스만 받는다 */
export interface SlotTarget { state: EditorState; dispatch: (tr: Transaction) => void }

export const setSlots = StateEffect.define<SlotState | null>();

export const slotsField = StateField.define<SlotState | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setSlots)) return e.value;            // ①
    if (!value) return null;
    if (tr.isUserEvent('undo') || tr.isUserEvent('redo')) return null;        // ②
    if (tr.docChanged) {                                                       // ③
      value = {
        active: value.active,
        ranges: value.ranges.map((r) => ({ from: tr.changes.mapPos(r.from, -1), to: tr.changes.mapPos(r.to, 1) })),
      };
    }
    if (tr.selection) {                                                        // ④
      const a = value.ranges[value.active];
      const m = tr.selection.main;
      if (!a || m.from < a.from || m.to > a.to) return null;
    }
    return value;
  },
});

/**
 * `[from, to)`를 단축어 내용으로 바꾸고 첫 자리에 커서를 둔다. 한 트랜잭션 = undo 1단계.
 * 자리가 탈출 하나뿐이면(`\alpha` 같은 내용) 자리 상태 없이 커서만 끝에.
 * `scrollIntoView: true`는 CM 타자 경로(`applyDefaultInsert`)와 같은 플래그 — 새 스크롤 경로가 아니다.
 */
export function insertWithSlots(target: SlotTarget, from: number, to: number, content: string): void {
  const { text, slots } = parseSlots(content);
  const ranges: SlotRange[] = slots.map((p) => ({ from: from + p, to: from + p }));
  const first = ranges[0];
  target.dispatch(target.state.update({
    changes: { from, to, insert: text },
    selection: EditorSelection.cursor(first.from),
    effects: ranges.length > 1 ? [setSlots.of({ ranges, active: 0 })] : [],
    scrollIntoView: true,
    userEvent: 'input.complete',
  }));
}

function moveSlot(target: SlotTarget, dir: 1 | -1): boolean {
  const v = target.state.field(slotsField, false);
  if (!v) return false;
  const next = v.active + dir;
  if (next < 0 || next >= v.ranges.length) return false;
  const r = v.ranges[next];
  const last = next === v.ranges.length - 1;                                   // 마지막 = 탈출 자리 → 해제
  target.dispatch(target.state.update({
    selection: EditorSelection.range(r.from, r.to),
    effects: setSlots.of(last ? null : { ranges: v.ranges, active: next }),
    scrollIntoView: true,
  }));
  return true;
}

/** 다음 자리. 활성 자리가 없으면 false(호출부가 다음 규칙으로) */
export const nextSlotCmd = (target: SlotTarget): boolean => moveSlot(target, 1);
/** 이전 자리. 첫 자리거나 활성 자리가 없으면 false */
export const prevSlotCmd = (target: SlotTarget): boolean => moveSlot(target, -1);

/** 활성 자리가 있는가(Tab 순서 ③ 판정용) */
export const hasActiveSlots = (state: EditorState): boolean => !!state.field(slotsField, false);
