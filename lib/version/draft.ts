import type { VersionContent } from '../../types/version';

/**
 * Phase 55 계층1 — localStorage 드래프트(크래시 안전망).
 * Firestore 상시 저장은 하지 않는다(D2) — ⚠ M7 D12(2026-09-12)가 개정: **30분 자동 저장**(silent · 스냅샷 없음,
 * 기준점 = 마지막 저장)이 EditorView에 있다. 드래프트는 그대로 크래시 직전 500ms 안전망이고, 두 계층은 별개다.
 * 드래프트는 미저장 편집을 보관하고, 다음 진입 시 서버본과 다르면 복구 배너로 노출.
 */

const KEY = (problemId: string) => `mathory:draft:${problemId}`;

export interface DraftRecord {
  v: 1;
  content: VersionContent;
  savedAt: number;
}

export function writeDraft(problemId: string, content: VersionContent): void {
  try {
    const rec: DraftRecord = { v: 1, content, savedAt: Date.now() };
    localStorage.setItem(KEY(problemId), JSON.stringify(rec));
  } catch {
    /* 용량 초과/접근 실패는 무시 — 안전망일 뿐 */
  }
}

export function readDraft(problemId: string): DraftRecord | null {
  try {
    const raw = localStorage.getItem(KEY(problemId));
    if (!raw) return null;
    const rec = JSON.parse(raw) as DraftRecord;
    if (rec?.v !== 1 || !rec.content?.tabs) return null;
    return rec;
  } catch {
    return null;
  }
}

export function clearDraft(problemId: string): void {
  try {
    localStorage.removeItem(KEY(problemId));
  } catch {
    /* noop */
  }
}
