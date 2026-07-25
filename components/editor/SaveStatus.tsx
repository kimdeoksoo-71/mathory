'use client';

import React from 'react';

export type SaveStatusKind = 'saved' | 'saving' | 'unsaved' | 'error';

function relTime(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5) return '방금 전';
  if (s < 60) return `${s}초 전`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

/**
 * Phase 55 계층1 — 저장 상태 표시.
 * "저장됨"의 기준은 Firestore 확정(명시 저장/이탈). localStorage 드래프트는 보이지 않는 안전망.
 */
export default function SaveStatus({
  status,
  lastSavedAt,
}: {
  status: SaveStatusKind;
  lastSavedAt: number | null;
}) {
  let text: string;
  let color = 'var(--text-muted, #888)';

  switch (status) {
    case 'saving':
      text = '저장 중…';
      break;
    case 'error':
      text = '저장 실패';
      color = 'var(--danger, #c0392b)';
      break;
    case 'unsaved':
      text = '미저장 변경';
      break;
    default:
      text = lastSavedAt ? `저장됨 · ${relTime(lastSavedAt)}` : '저장됨';
  }

  return (
    <span style={{ fontSize: 12, color, whiteSpace: 'nowrap', userSelect: 'none' }}>
      {text}
    </span>
  );
}
