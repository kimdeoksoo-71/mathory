'use client';

/**
 * Phase 61d — 폴더 일괄 검증 다이얼로그 (선택 → 진행 → 요약)
 *
 * ⚠️ **전체 뷰포트 모달이어야 한다 (§3-12).** FolderView는 AppShell의 `view.type === 'folder'`일 때만
 *    렌더되므로 홈·편집·문항으로 이동하면 언마운트되고 배치가 끊긴다. `fixed; inset:0; zIndex:9000`
 *    오버레이가 사이드바 클릭 자체를 막는다(브라우저 이탈은 `beforeunload`가 맡는다 — 실행 중에만).
 *
 * ⚠️ 판정은 전부 `lib/verify/batchPlan.ts`(테스트가 고정), 실행은 `lib/batchVerify.ts`.
 *    이 파일은 화면만 그린다 — verdict 어휘·스킵 문구를 여기서 다시 정의하지 말 것(D61d-13).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Problem, VerifyKind } from '../../types/problem';
import { VERIFY_VERDICT_META } from '../ui/VerifyBadge';
import VerifyBadge from '../ui/VerifyBadge';
import { buildReportMarkdown } from '../comment/VerifyReportCard';
import {
  defaultChecked, estimateMinutes, skipLabel, summarize,
  type RowOutcome,
} from '../../lib/verify/batchPlan';
import { runBatchVerify, type BatchItem, type BatchResult, type BatchRow } from '../../lib/batchVerify';

/* ═══ 스타일 — SheetImportModal의 규격을 그대로 따른다(그 파일의 상수는 export돼 있지 않아 사본).
       치수를 바꾸려면 두 곳을 함께 볼 것: components/import/SheetImportModal.tsx:76-119 ═══ */
const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  modal: {
    background: 'var(--bg-card, #fff)', borderRadius: 10,
    width: 'min(920px, 94vw)', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    fontFamily: 'var(--font-ui)',
  } as React.CSSProperties,
  head: {
    display: 'flex', alignItems: 'center', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderBottom: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  body: { padding: 16, overflowY: 'auto', flex: 1 } as React.CSSProperties,
  foot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderTop: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  th: {
    textAlign: 'left', fontSize: 11.5, fontWeight: 600, color: 'var(--text-muted, #888)',
    padding: '6px 8px', borderBottom: '1px solid var(--border-light, #eee)', whiteSpace: 'nowrap',
  } as React.CSSProperties,
  td: {
    fontSize: 12.5, color: 'var(--text-primary, #222)',
    padding: '7px 8px', borderBottom: '1px solid var(--border-light, #f2f2f2)', verticalAlign: 'middle',
  } as React.CSSProperties,
};

const ACCENT = 'var(--mathory-red-dark, #BC5F3F)';

const btn = (kind: 'primary' | 'ghost', disabled = false): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
  fontFamily: 'var(--font-ui)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  border: kind === 'primary' ? 'none' : '1px solid var(--border-light, #ddd)',
  background: kind === 'primary' ? ACCENT : 'transparent',
  color: kind === 'primary' ? '#fff' : 'var(--text-primary, #222)',
});

const KINDS: VerifyKind[] = ['problem', 'solution'];
const KIND_LABEL: Record<VerifyKind, string> = { problem: '문제', solution: '풀이' };
const keyOf = (problemId: string, kind: VerifyKind) => `${problemId}:${kind}`;

const fmtElapsed = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

type Phase = 'select' | 'running' | 'summary';

export default function BatchVerifyDialog({
  folderName, problems, user, onClose,
}: {
  folderName: string;
  /** 폴더 직속 문항 — 현재 정렬 순서 그대로 (하위폴더 문항은 이미 걸러져 있다, §3-6) */
  problems: Problem[];
  user: User;
  /** didChange = 성공 1건 이상 → 호출부가 목록을 1회 리프레시한다(W5) */
  onClose: (didChange: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>('select');
  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const p of problems) {
      const ownable = !!p.authorUid && p.authorUid === user.uid;
      for (const kind of KINDS) {
        init[keyOf(p.id, kind)] = ownable && defaultChecked(p.verification?.[kind]);
      }
    }
    return init;
  });

  const [outcomes, setOutcomes] = useState<Record<string, RowOutcome>>({});
  const [runKeys, setRunKeys] = useState<string[]>([]);
  const [usdTotal, setUsdTotal] = useState(0);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [stopping, setStopping] = useState(false);
  const stopRef = useRef(false);   // ⚠ ref 객체 자체가 {current:boolean} — 그대로 넘긴다

  /** 오너가 아닌 문항은 규칙상 AI 댓글을 쓸 수 없다 → 체크 자체를 막는다(§3-5) */
  const isOwn = useCallback(
    (p: Problem) => !!p.authorUid && p.authorUid === user.uid,
    [user.uid],
  );

  const selectedCount = useMemo(
    () => problems.reduce(
      (n, p) => n + KINDS.filter((k) => checked[keyOf(p.id, k)]).length, 0),
    [problems, checked],
  );

  /* 경과 시간 — 실행 중에만 돈다. (백그라운드 탭에서는 브라우저가 타이머를 늦춘다: 표시만 영향) */
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 1000);
    return () => clearInterval(t);
  }, [phase, startedAt]);

  /* ⚠ beforeunload는 **실행 중에만** 등록한다(V3) — 요약 화면에서 새로고침까지 막으면 안 된다 */
  useEffect(() => {
    if (phase !== 'running') return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [phase]);

  const run = useCallback(async (items: BatchItem[]) => {
    if (items.length === 0) return;
    const keys = items.flatMap((it) => it.kinds.map((k) => keyOf(it.problemId, k)));
    stopRef.current = false;
    setStopping(false);
    setRunKeys(keys);
    // ⚠ 통째로 갈아엎지 않는다 — [실패 항목만 다시 실행] 뒤에도 앞선 성공 결과가 표에 남아야 한다
    setOutcomes((prev) => ({
      ...prev,
      ...Object.fromEntries(keys.map((k) => [k, { state: 'pending' } as RowOutcome])),
    }));
    setUsdTotal(0);
    setResult(null);
    const started = Date.now();
    setStartedAt(started);
    setElapsed(0);
    setPhase('running');

    const applyRow = (row: BatchRow) =>
      setOutcomes((prev) => ({ ...prev, [keyOf(row.problemId, row.kind)]: row.outcome }));

    const res = await runBatchVerify({
      items,
      uid: user.uid,
      getIdToken: () => user.getIdToken(),
      buildMarkdown: buildReportMarkdown,
      stopRef,
      callbacks: {
        onPlan: (rows) => rows.forEach(applyRow),
        onRow: applyRow,
        onUsage: (u) => setUsdTotal(u.costUsd),
      },
    });
    setResult(res);
    setElapsed(Date.now() - started);
    setPhase('summary');
  }, [user]);

  const startSelected = () => run(
    problems
      .map((p) => ({
        problemId: p.id,
        title: p.title || '(제목 없음)',
        kinds: KINDS.filter((k) => checked[keyOf(p.id, k)]),
      }))
      .filter((it) => it.kinds.length > 0),
  );

  const retryFailed = () => {
    const byProblem = new Map<string, BatchItem>();
    for (const row of result?.rows || []) {
      if (row.outcome.state !== 'failed') continue;
      const cur = byProblem.get(row.problemId)
        ?? { problemId: row.problemId, title: row.title, kinds: [] as VerifyKind[] };
      cur.kinds.push(row.kind);
      byProblem.set(row.problemId, cur);
    }
    run([...byProblem.values()]);
  };

  const summary = useMemo(
    () => summarize(runKeys.map((k) => outcomes[k] ?? { state: 'pending' })),
    [runKeys, outcomes],
  );
  const doneCount = summary.ok + summary.check + summary.fail + summary.skip;
  const finishedCount = doneCount + summary.failed + summary.skipped;
  const successCount = doneCount;

  const [estLo, estHi] = estimateMinutes(selectedCount);

  /* ─── 셀 ─── */
  const renderCell = (p: Problem, kind: VerifyKind) => {
    const key = keyOf(p.id, kind);
    if (phase === 'select') {
      const ownable = isOwn(p);
      return (
        <input
          type="checkbox"
          checked={!!checked[key]}
          disabled={!ownable}
          title={ownable ? undefined : '내 문항이 아닙니다 (AI 리포트를 저장할 수 없습니다)'}
          onChange={(e) => setChecked((prev) => ({ ...prev, [key]: e.target.checked }))}
          style={{ cursor: ownable ? 'pointer' : 'not-allowed' }}
        />
      );
    }
    const known = outcomes[key];
    if (!known) return <span style={{ color: 'var(--text-faint, #bbb)' }}>—</span>;
    const o = known;
    if (o.state === 'pending') return <span style={{ color: 'var(--text-faint, #bbb)' }}>대기</span>;
    if (o.state === 'running') return <span style={{ color: ACCENT, fontWeight: 600 }}>검증 중…</span>;
    if (o.state === 'skipped') {
      return <span style={{ color: 'var(--text-muted, #888)' }}>건너뜀 · {skipLabel(o.reason)}</span>;
    }
    if (o.state === 'failed') {
      return <span style={{ color: 'var(--accent-danger, #c0392b)' }} title={o.message}>실패</span>;
    }
    const m = VERIFY_VERDICT_META[o.verdict] ?? VERIFY_VERDICT_META.check;
    return <span style={{ color: m.color, fontWeight: 600 }}>{m.icon} {m.label}</span>;
  };

  const allOn = selectedCount > 0
    && problems.every((p) => !isOwn(p) || KINDS.every((k) => checked[keyOf(p.id, k)]));
  const toggleAll = () => {
    setChecked(() => {
      const next: Record<string, boolean> = {};
      for (const p of problems) {
        for (const kind of KINDS) next[keyOf(p.id, kind)] = !allOn && isOwn(p);
      }
      return next;
    });
  };

  return (
    <div style={S.overlay}>
      <div style={S.modal} role="dialog" aria-modal="true">
        <div style={S.head}>
          <span style={{ fontSize: 15, fontWeight: 600 }}>일괄 검증</span>
          <span style={{ fontSize: 12.5, color: 'var(--text-muted, #888)' }}>
            {folderName} · 문항 {problems.length}개
          </span>
          <div style={{ flex: 1 }} />
          {phase === 'running' ? (
            <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
              {finishedCount} / {runKeys.length} 완료 · 누적 비용(2차 Claude 기준) ${usdTotal.toFixed(2)} · {fmtElapsed(elapsed)}
            </span>
          ) : (
            <button
              onClick={() => onClose(successCount > 0)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--text-muted, #888)' }}
              title="닫기"
            >✕</button>
          )}
        </div>

        <div style={S.body}>
          {phase === 'summary' && result && (
            <div style={{
              marginBottom: 12, padding: 12, borderRadius: 6,
              background: 'var(--bg-functional, #faf8f5)', fontSize: 12.5, lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {result.aborted ? `중단됨 — ${result.abortMessage}` : '완료'}
              </div>
              <div>
                {VERIFY_VERDICT_META.ok.icon} 이상 없음 {summary.ok} ·{' '}
                {VERIFY_VERDICT_META.check.icon} 확인 필요 {summary.check} ·{' '}
                {VERIFY_VERDICT_META.fail.icon} 결함 확인 {summary.fail} ·{' '}
                {VERIFY_VERDICT_META.skip.icon} 검증 안 함 {summary.skip} ·{' '}
                실패 {summary.failed} · 건너뜀 {summary.skipped}
                {summary.remaining > 0 ? ` · 미실행 ${summary.remaining}` : ''}
              </div>
              <div style={{ color: 'var(--text-muted, #888)' }}>
                소요 {fmtElapsed(elapsed)} · 비용(2차 Claude 기준) ${result.usage.costUsd.toFixed(2)}
              </div>
            </div>
          )}

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={S.th}>문항</th>
                <th style={{ ...S.th, width: 150 }}>문제 검증</th>
                <th style={{ ...S.th, width: 150 }}>풀이 검증</th>
                <th style={{ ...S.th, width: 110 }}>현재 상태</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...S.td, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.title || '(제목 없음)'}
                    {!isOwn(p) && (
                      <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted, #888)' }}>
                        (내 문항 아님)
                      </span>
                    )}
                  </td>
                  <td style={S.td}>{renderCell(p, 'problem')}</td>
                  <td style={S.td}>{renderCell(p, 'solution')}</td>
                  <td style={S.td}>
                    <span style={{ display: 'inline-flex', gap: 6 }}><VerifyBadge problem={p} size={11} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.foot}>
          {phase === 'select' && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                검증 {selectedCount}회 · 종류당 1~4분 ·{' '}
                <span style={selectedCount > 30 ? { color: ACCENT, fontWeight: 600 } : undefined}>
                  예상 {estLo}~{estHi}분
                </span>
                {' '}· API 비용 발생
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                <button onClick={toggleAll} style={btn('ghost')}>
                  {allOn ? '전체 해제' : '전체 선택'}
                </button>
                <button
                  onClick={startSelected}
                  disabled={selectedCount === 0}
                  style={btn('primary', selectedCount === 0)}
                >실행</button>
              </span>
            </>
          )}

          {phase === 'running' && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                {stopping
                  ? '현재 종류를 마친 뒤 멈춥니다 — 이미 시작한 검증은 저장까지 마칩니다'
                  : '진행 중에는 창을 닫을 수 없습니다. 완료된 문항은 이미 저장돼 있습니다'}
              </span>
              <button
                onClick={() => { stopRef.current = true; setStopping(true); }}
                disabled={stopping}
                style={btn('ghost', stopping)}
              >중단</button>
            </>
          )}

          {phase === 'summary' && (
            <>
              <span style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
                {summary.failed > 0 ? `실패 ${summary.failed}건은 다시 실행할 수 있습니다` : ''}
              </span>
              <span style={{ display: 'flex', gap: 8 }}>
                {summary.failed > 0 && (
                  <button onClick={retryFailed} style={btn('ghost')}>실패 항목만 다시 실행</button>
                )}
                <button onClick={() => onClose(successCount > 0)} style={btn('primary')}>닫기</button>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
