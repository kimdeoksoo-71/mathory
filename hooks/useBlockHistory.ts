import { useCallback, useRef, useReducer } from 'react';
import type { VersionContent } from '../types/version';

/**
 * Phase 55a — 블록 구조 Undo/Redo 히스토리 스택 (세션 인메모리).
 * capture = collectCurrentContent 래핑(EditorView), apply = applyVersionContent(EditorView).
 * VCS 스냅샷과 무관. 문항 전환 시 reset()(C9).
 */
export interface HistoryEntry {
  content: VersionContent;
  activeTab: string;
  activeBlockKey: string | null;   // id는 세대마다 바뀌므로 block_key로 저장
}

const CAP = 100;

export function useBlockHistory(
  capture: () => HistoryEntry | null,
  apply: (entry: HistoryEntry) => void,
) {
  // 매 렌더 최신 클로저를 ref로 (스택 콜백은 stable)
  const captureRef = useRef(capture); captureRef.current = capture;
  const applyRef = useRef(apply); applyRef.current = apply;
  const pastRef = useRef<HistoryEntry[]>([]);
  const futureRef = useRef<HistoryEntry[]>([]);
  const [, force] = useReducer((x: number) => x + 1, 0);

  // 구조 조작 직전: 현재 상태를 past에 push, future 비움 (C3: 검증 후 mutate 직전 호출)
  const pushUndo = useCallback(() => {
    const cur = captureRef.current();
    if (!cur) return;                        // C4: 로드 실패 등 → 스킵
    pastRef.current = [...pastRef.current, cur].slice(-CAP);
    futureRef.current = [];
    force();
  }, []);

  const undo = useCallback(() => {
    if (!pastRef.current.length) return;
    const cur = captureRef.current();
    if (!cur) return;
    const target = pastRef.current[pastRef.current.length - 1];
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, cur];
    applyRef.current(target);
    force();
  }, []);

  const redo = useCallback(() => {
    if (!futureRef.current.length) return;
    const cur = captureRef.current();
    if (!cur) return;
    const target = futureRef.current[futureRef.current.length - 1];
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, cur];
    applyRef.current(target);
    force();
  }, []);

  const reset = useCallback(() => {
    pastRef.current = [];
    futureRef.current = [];
    force();
  }, []);

  return {
    pushUndo, undo, redo, reset,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
