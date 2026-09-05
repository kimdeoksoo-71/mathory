'use client';

/**
 * Phase 63 S0 — 앱 전역 DnD 공용 장치.
 *
 * 컨텍스트는 AppShell 하나뿐이다(D21). 여기에는 컨텍스트가 공유하는 네 가지가 산다:
 * ① 데이터 계약(D23) — 핸들러는 id를 파싱하지 않고 data로만 대상을 읽는다.
 * ② id 네임스페이스(D34) — 같은 폴더가 칩·트리 등 여러 타깃으로 동시에 등록되므로
 *    id 충돌을 프리픽스로 막는다. ⚠ 사이드바 폴더 sortable만 맨 folder.id를 쓴다
 *    (SortableContext items의 앵커라 프리픽스 불가).
 * ③ 충돌 판정(D22·H1) — folder 드래그는 사이드바 sortable로 필터한 closestCenter,
 *    problem 계열은 pointerWithin(포인터) / rectIntersection(키보드).
 *    ⚠ 분기 기준은 "pointerWithin 결과가 비었나"가 아니라 **pointerCoordinates 유무**다 —
 *    결과 기준이면 포인터가 빈 곳에 있을 때도 폴백이 돌아 "빈 곳 드롭 무동작"이 무너진다(H1).
 * ④ 드래그 종류 컨텍스트(F7) — useDndContext()는 매 move마다 리렌더를 일으키므로 금지.
 *    AppShell이 dragStart/End에서만 갱신하는 React Context로 종류를 내린다.
 */

import { createContext, useContext } from 'react';
import {
  closestCenter, pointerWithin, rectIntersection,
  useDraggable, useDroppable,
  type CollisionDetection,
} from '@dnd-kit/core';
import type { Problem, Folder } from '../../types/problem';

/* ─── ① 데이터 계약 (D23) ─── */
export type DragData =
  | { type: 'problem'; problem: Problem }
  | { type: 'problems'; problems: Problem[] }
  | { type: 'folder'; folder: Folder };

export type DropData =
  | { type: 'folder'; folder: Folder }
  | { type: 'unassigned' }
  | { type: 'trash' };

/* ─── ② id 네임스페이스 (D34) ─── */
export const dndId = {
  /** FolderView 하위 폴더 칩 */
  chip: (folderId: string) => `chip:${folderId}`,
  /** ListView 폴더 행 (S3) */
  folderRow: (folderId: string) => `frow:${folderId}`,
  /** 브레드크럼 상위 폴더 (S3) */
  crumb: (folderId: string) => `crumb:${folderId}`,
  /** 사이드바 미지정 (S3) */
  unassigned: 'drop:unassigned',
  /** 사이드바 휴지통 (S3) */
  trash: 'drop:trash',
  /** FolderView 카드 */
  card: (problemId: string) => `card:${problemId}`,
  /** ListView 문항 행 (S3) */
  problemRow: (problemId: string) => `prow:${problemId}`,
  /** 사이드바 최근 문항 — 현행 표기 유지 */
  recentProblem: (problemId: string) => `problem-${problemId}`,
};

/* ─── ③ 충돌 판정 (D22 · H1) ─── */
export const appCollisionDetection: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'folder') {
    // 폴더 정렬: 사이드바 SortableContext 소속(useSortable이 data.sortable을 병합)만 후보.
    // 필터 없이는 본문 칩·행이 over가 되어 정렬 미리보기가 흔들린다(E7).
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.sortable
      ),
    });
  }
  // problem 계열: 포인터 = 타깃 안에 있어야만(빈 곳 드롭 = 무동작) /
  // 키보드 = pointerCoordinates가 없어 pointerWithin이 항상 []이므로 rectIntersection.
  return args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);
};

/* ─── ④ 드래그 종류 컨텍스트 (F7) ─── */
export type DragKind = 'problem' | 'problems' | 'folder' | null;
export const DragKindContext = createContext<DragKind>(null);
export const useDragKind = (): DragKind => useContext(DragKindContext);

/** problem 계열 드래그 중인가 — 드롭 타깃 하이라이트의 공통 게이트(D27) */
export function isProblemDrag(kind: DragKind): boolean {
  return kind === 'problem' || kind === 'problems';
}

/* ─── 하이라이트 한 문법 (D27) — 링 + 틴트, border 불변 ───
   사이드바 현행 조건부 2px border는 over 순간 행이 자라는 결함이라 철거했다(F6). */
export const DROP_RING = '0 0 0 2px rgba(91, 106, 191, 0.25)';
export const DROP_TINT = 'rgba(91, 106, 191, 0.12)';

/* ─── DnD 렌더프롭 래퍼 (FolderView에서 이주) ─── */
export function Draggable({ id, data, disabled, children }: {
  id: string;
  data: DragData;
  disabled?: boolean;
  // attributes/listeners는 dnd-kit 내부 타입 → 스프레드용으로 느슨하게 받음
  children: (p: { setNodeRef: (el: HTMLElement | null) => void; attributes: any; listeners: any; isDragging: boolean }) => React.ReactNode;
}) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id, data, disabled });
  return <>{children({ setNodeRef, attributes, listeners, isDragging })}</>;
}

/** 드롭 타깃. isOver는 problem 계열 드래그일 때만 참이 된다(D27 게이트 내장) —
 *  folder 정렬 드래그가 본문·특수 타깃을 물들이지 않는다. */
export function Droppable({ id, data, children }: {
  id: string;
  data: DropData;
  children: (p: { setNodeRef: (el: HTMLElement | null) => void; isOver: boolean }) => React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data });
  const kind = useDragKind();
  return <>{children({ setNodeRef, isOver: isOver && isProblemDrag(kind) })}</>;
}
