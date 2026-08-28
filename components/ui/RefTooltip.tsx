'use client';

import { useEffect } from 'react';
import { normalizeRefText } from '../../lib/locale';
import { Z_TOOLTIP } from './dialogStyles';

/* ═══════════════════════════════════════════════════════════════
   개선묶음 M2 C — 참조 인용 hover 말풍선 (D13′~D18′ · D42′)

   길고 복잡한 풀이에서 `(가)`·`①`·`ㄱ`·`(3)`·`C1`을 다시 인용할 때, 그 원본이
   무엇이었는지 기억하지 못하는 불편을 없앤다. 참조 위에 1초 머물면 원문 문단이
   말풍선으로 뜬다 — 원문의 인덱스까지 함께.

   ⚠ **React 상태를 쓰지 않는다.** 이 컴포넌트는 리스너를 달고 body에 노드를 붙일 뿐이다.
     프리뷰 쪽에 상태가 생기면 리렌더가 innerHTML을 다시 써서 드래그 선택이 죽는다
     (globals.css:857 규약 · Phase 61c 실측). 여기도 같은 이유로 순수 DOM이다.
   ⚠ 마크업(.ref-marker)은 5개 렌더 사이트 전부에 생기지만, 이 리스너는
     **`[data-ref-tooltip]` 조상이 있을 때만** 반응한다(D16′) — 편집 미리보기·인쇄·
     폴더뷰 카드에서는 마크업이 있어도 아무 일도 일어나지 않는다.
   ⚠ 복제 단위는 `.katex-display` **이상**이어야 한다(D42′) — `\tag` 정렬 규칙이
     `.katex-display > .katex > .katex-html > .tag`라는 정확한 조상 체인을 요구한다.
   ⚠ 말풍선 안을 `.preview-content tone-baseline`으로 감싸고 `--content-font-size`를
     복사한다. 안 하면 본문 24px에서 번호가 폴백 15px로 떨어진다(v2 C-14 실측).
   ═══════════════════════════════════════════════════════════════ */

/** 메모 사양: "아이콘이 ?로 바뀌고 1초간 지속 → 말풍선" */
const DELAY_MS = 1000;
/** 마커 → 말풍선으로 마우스가 건너가는 동안의 유예 */
const GRACE_MS = 120;

/** reftype별 정의부 선택자. `tag`만 둘이다(텍스트 행 꼬리표 · 수식 안 KaTeX 태그). */
const DEF_SELECTOR: Record<string, string> = {
  gana: '.marker-gana',
  giyeok: '.marker-giyeok',
  circled: '.marker-circled',
  case: '.case-label',
  tag: '.tag-marker, .katex-html > .tag',
};

/** 정의부가 속한 "원문 한 덩어리". 가장 가까운 것이 이긴다(closest의 성질). */
const HOST_SELECTOR = '.katex-display, p, li, blockquote, td, th';

export default function RefTooltip() {
  useEffect(() => {
    let timer: number | null = null;
    let closeTimer: number | null = null;
    let box: HTMLDivElement | null = null;
    let anchor: HTMLElement | null = null;

    const clearTimers = () => {
      if (timer) { window.clearTimeout(timer); timer = null; }
      if (closeTimer) { window.clearTimeout(closeTimer); closeTimer = null; }
    };

    const close = () => {
      clearTimers();
      anchor = null;
      if (box) { box.remove(); box = null; }
    };

    /** 참조보다 앞선 것 중 가장 가까운 정의부 → 없으면 문서 첫 번째 → 없으면 null (D15′·Q7) */
    const findDefinition = (root: HTMLElement, el: HTMLElement): HTMLElement | null => {
      const type = el.dataset.reftype || '';
      const sel = DEF_SELECTOR[type];
      if (!sel) return null;
      const want = normalizeRefText(el.textContent || '');
      if (!want) return null;

      const hits = Array.from(root.querySelectorAll<HTMLElement>(sel))
        .filter((d) => d !== el && !el.contains(d) && normalizeRefText(d.textContent || '') === want);
      if (hits.length === 0) return null;

      // DOCUMENT_POSITION_PRECEDING(2) = 후보가 참조보다 앞에 있다
      const before = hits.filter((d) => el.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_PRECEDING);
      return before.length ? before[before.length - 1] : hits[0];
    };

    const show = (el: HTMLElement, root: HTMLElement) => {
      const def = findDefinition(root, el);
      if (!def) return;                                   // 미발견 = 무음 (D15′)
      const host = def.closest<HTMLElement>(HOST_SELECTOR) ?? def.parentElement;
      if (!host) return;

      const fs = getComputedStyle(def).getPropertyValue('--content-font-size').trim() || '15px';

      box = document.createElement('div');
      box.className = 'ref-tooltip';
      box.style.zIndex = String(Z_TOOLTIP);
      box.style.setProperty('--content-font-size', fs);

      // D42′ — 스코프를 복원해야 크기·색·\tag 앵커가 원본과 같아진다
      const inner = document.createElement('div');
      inner.className = 'preview-content tone-baseline';
      inner.style.fontSize = fs;
      inner.appendChild(host.cloneNode(true));
      box.appendChild(inner);
      document.body.appendChild(box);

      // 마우스가 말풍선 위로 건너오면 유지 (D13′)
      box.addEventListener('mouseenter', clearTimers);
      box.addEventListener('mouseleave', close);

      // 위치: 마커 아래 → 넘치면 위. 좌우는 뷰포트 클램프 (SelectionInsertPopup 전례)
      const r = el.getBoundingClientRect();
      const bw = box.offsetWidth;
      const bh = box.offsetHeight;
      const M = 8;
      let top = r.bottom + 6;
      if (top + bh > window.innerHeight - M) top = Math.max(M, r.top - bh - 6);
      let left = r.left;
      if (left + bw > window.innerWidth - M) left = window.innerWidth - bw - M;
      box.style.top = `${Math.round(top)}px`;
      box.style.left = `${Math.round(Math.max(M, left))}px`;
    };

    const onOver = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      if (box && box.contains(t)) return;                 // 말풍선 내부 이동
      const el = t.closest<HTMLElement>('[data-reftype]');
      if (!el) return;
      const root = el.closest<HTMLElement>('[data-ref-tooltip]');
      if (!root) return;                                  // 게이트: 열람 2뷰에서만 (D16′)
      if (el === anchor) { clearTimers(); return; }
      close();
      anchor = el;
      timer = window.setTimeout(() => show(el, root), DELAY_MS);
    };

    const onOut = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== 'function') return;
      if (!t.closest('[data-reftype]')) return;
      clearTimers();
      // 말풍선으로 건너가는 중일 수 있다 — 유예를 준다
      closeTimer = window.setTimeout(close, GRACE_MS);
    };

    // 스크롤하면 즉시 닫는다(C-6 전례). capture여야 내부 스크롤 컨테이너도 잡힌다.
    const onScroll = () => close();

    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      close();
    };
  }, []);

  return null;
}
