'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Block } from '../types/problem';
import { buildOutline, hasOutlineContent } from '../lib/solutionOutline';

/* ═══════════════════════════════════════════════════════════════
   Phase 59 — 요약 보기 상태 (D3)

   비영속이다. URL·localStorage에 남기지 않는다 — 열람 중 시야 조절용 뷰 상태이지
   문서의 속성이 아니다. 기본값은 full이라 기존 문항의 첫 화면은 변화 0 (D5).

   여닫이 키는 block_key ?? id다. doc id는 저장마다 재발급되므로 id만 쓰면
   다른 창에서 저장이 일어난 뒤 열림 상태가 엉뚱한 블록으로 옮겨간다 (v2 E9).
   ═══════════════════════════════════════════════════════════════ */

/** 토글 후에도 클릭한 줄이 화면의 같은 높이에 있도록 스크롤을 보정한다.
 *  콘텐츠 높이가 급변하는 기능이라 이게 없으면 누를 때마다 시야가 튄다 (v2 E20). */
function scrollParentOf(el: HTMLElement | null): HTMLElement | null {
  let p = el?.parentElement ?? null;
  while (p) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    p = p.parentElement;
  }
  return null;
}

/** 공개 뷰어는 서버에서도 렌더될 수 있다 — useLayoutEffect는 SSR에서 경고를 낸다. */
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export type OutlineMode = 'full' | 'outline';

export function useOutlineState(blocks: Block[]) {
  const [mode, setMode] = useState<OutlineMode>('full');
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());
  const [openCases, setOpenCases] = useState<Set<string>>(new Set());

  const sections = useMemo(() => buildOutline(blocks), [blocks]);
  const available = useMemo(() => hasOutlineContent(sections), [sections]);

  // 다음 커밋에서 되돌릴 스크롤 앵커. setState는 비동기라 rAF가 커밋보다 먼저
  // 돌 수 있으므로 useLayoutEffect(= DOM 반영 직후, 페인트 직전)에서 처리한다.
  const anchor = useRef<{ el: HTMLElement; top: number } | null>(null);
  useIsoLayoutEffect(() => {
    const a = anchor.current;
    if (!a) return;
    anchor.current = null;
    const container = scrollParentOf(a.el);
    if (!container) return;
    const delta = a.el.getBoundingClientRect().top - a.top;
    if (delta) container.scrollTop += delta;
  });

  const keepAnchor = useCallback((el: HTMLElement | null) => {
    if (el) anchor.current = { el, top: el.getBoundingClientRect().top };
  }, []);

  const toggleMode = useCallback(() => {
    setMode((m) => {
      if (m === 'full') {
        // 요약 보기 진입은 "전부 닫힘"에서 시작한다 — 직전 세션의 여닫이가
        // 남아 있으면 "한눈에 보기"가 성립하지 않는다.
        setOpenSections(new Set());
        setOpenCases(new Set());
        return 'outline';
      }
      return 'full';
    });
    // 모드 전환은 앵커를 잡지 않는다 — 기준으로 삼을 줄이 없고,
    // 높이가 크게 줄어드는 쪽은 브라우저가 알아서 clamp한다.
  }, []);

  const toggleSection = useCallback((key: string, el: HTMLElement | null) => {
    keepAnchor(el);
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, [keepAnchor]);

  const toggleCase = useCallback((key: string, el: HTMLElement | null) => {
    keepAnchor(el);
    setOpenCases((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }, [keepAnchor]);

  return { mode, setMode, toggleMode, sections, available, openSections, openCases, toggleSection, toggleCase };
}
