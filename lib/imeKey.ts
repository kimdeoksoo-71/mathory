/**
 * Phase 68c D1 — React·DOM 입력창의 Enter(그 밖 확정 키)가 **IME 조합 키인가**. 순수 모듈(**import 0** · `npm run test:imekey`).
 *
 * 세 신호 중 하나라도 참이면 조합 키다:
 *  ① `isComposing` — 네이티브 KeyboardEvent(DOM 리스너)
 *  ② `nativeEvent.isComposing` — React 합성 이벤트(`e.isComposing`이 없다)
 *  ③ `keyCode === 229` — **Safari 꼬리 keydown**: compositionend **뒤에** `isComposing:false`·keyCode 229로 Enter가 한 번 더 온다
 *     (CM도 같은 꼬리를 `compositionPendingKey` 100ms 창으로 거른다 — view dist `ignoreDuringComposition`). 229는 IME 전용 코드라 오탐이 없다.
 *
 * ⚠ React 입력창의 Enter 처리는 **반드시** `if (e.key === 'Enter' && !isImeKey(e))` 꼴로 — 가드가 없으면 한글 조합 중 Enter가
 *   마지막 글자를 날리거나(확정 전 값으로 제출) 두 번 발화한다.
 */
export interface ImeKeyLike {
  isComposing?: boolean;
  keyCode?: number;
  nativeEvent?: { isComposing?: boolean };
}

export function isImeKey(e: ImeKeyLike): boolean {
  return !!(e.isComposing || e.nativeEvent?.isComposing || e.keyCode === 229);
}
