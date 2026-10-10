'use client';

/**
 * Phase 69 D10·D12·D13 — iPad 필기 수신 카드(데스크톱 편집창 전용).
 *
 * `users/{uid}/ink_jobs`의 `ready`를 구독해 가장 오래된 것부터 **하단 도킹 비모달 3단 카드**로 띄운다:
 * 좌 원본 PNG · 중 KaTeX 렌더 · 우 `LatexInputEditor`(블록 편집기와 같은 수식 입력 — 작업 규칙 9).
 * 확인 = 활성 블록 커서(선택이면 대체)에 `insertPlainText` → `inserted`(= 그 문항의 필기 첨부). 취소 = 확인창 → 문서·파일 삭제.
 *
 * ⚠ 카드는 **포커스를 가져가지 않는다**(블록에서 한글 조합 중이면 조합이 깨진다 — 68c가 막은 종류). 고치려면 카드 편집창을 누른다.
 * ⚠ **transform 금지** — 카드 안 CM 자동완성 툴팁은 position:fixed라 transform 조상 밑에서 좌표를 잃는다(가운데 정렬은 margin auto).
 * ⚠ z 10300 = 블록 CM 툴팁 호스트(10200) 위 · 말풍선(10400)·confirmDialog(10500) 아래.
 * ⚠ 루트의 `data-ink-card` — EditorView window 단축키(⌘B 분할·⌘J …)가 카드 안 키를 건너뛰는 표식(D12′). 지우지 말 것.
 * ⚠ `viewing` 같은 중간 상태를 두지 않는다 — 카드가 열린 채 새로고침·kick이 나면 job이 영영 안 뜬다(v2 E3).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import EditorPreview from './EditorPreview';
import LatexInputEditor, { type LatexInputEditorHandle } from '../comment/LatexInputEditor';
import type { MarkdownEditorHandle } from './MarkdownEditor';
import { dialogBody, dialogBtn, dialogFoot, dialogHead, Z_DIALOG } from '../ui/dialogStyles';
import { alertDialog, confirmDialog } from '../../lib/dialogs';
import { normalizeAndFix } from '../../lib/ocr';
import { probeInsertionRegion } from '../../lib/mathRegions';
import { composeInkText, shapeInkPayload, singleMathInner } from '../../lib/ink/payload';
import type { PresenceReason } from '../../lib/ink/presence';
import { discardJob, markInserted, subscribeReadyJobs, type InkJob } from '../../lib/inkJobs';

export const Z_INK_CARD = Z_DIALOG - 200;

const REASON_TEXT: Record<PresenceReason, string> = {
  'no-block': '편집창에서 텍스트 블록을 선택하세요',
  'not-text': '텍스트 블록을 선택하세요 — 그림·도형 블록에는 넣을 수 없습니다',
  collapsed: '접힌 블록입니다 — 펼친 뒤 넣으세요',
};

export interface InkInboxProps {
  uid: string;
  problemId: string;
  tabId: string;
  tabLabel: string;
  blockId: string | null;
  /** 0부터 */
  blockIndex: number;
  canInsert: boolean;
  reason?: PresenceReason;
  /** 확인 순간의 활성 블록 편집기(접힘·미디어면 null) */
  getEditor: () => MarkdownEditorHandle | null;
}

export default function InkInbox(props: InkInboxProps) {
  const { uid } = props;
  const [jobs, setJobs] = useState<InkJob[]>([]);
  const handled = useRef(new Set<string>());
  const [, bump] = useState(0);

  useEffect(() => {
    handled.current = new Set();
    return subscribeReadyJobs(uid, setJobs, (e) => console.error('[ink] 수신 구독 오류', e));
  }, [uid]);

  // 처리한 job은 스냅샷이 반영되기 전에도 곧바로 빠진다(handled는 ref — bump로 다시 그린다)
  const queue = jobs.filter((j) => !handled.current.has(j.id));
  const job = queue[0];
  const done = useCallback((id: string) => { handled.current.add(id); bump((n) => n + 1); }, []);

  if (!job || typeof document === 'undefined') return null;
  return createPortal(
    <InkCard key={job.id} job={job} total={queue.length} {...props} onDone={done} />,
    document.body,
  );
}

/** 카드 한 장. Firestore 동작은 `actions`로 바꿔 끼울 수 있다(기본 = 실제 — 하니스가 Firestore 없이 카드를 띄우는 자리) */
export function InkCard({
  job, total, uid, problemId, tabId, tabLabel, blockId, blockIndex, canInsert, reason, getEditor, onDone,
  actions = { markInserted, discardJob },
}: InkInboxProps & {
  job: InkJob; total: number; onDone: (id: string) => void;
  actions?: { markInserted: typeof markInserted; discardJob: typeof discardJob };
}) {
  const initial = useMemo(() => {
    const raw = composeInkText({ ocrLatex: job.ocrLatex, ocrText: job.ocrText });
    return raw ? normalizeAndFix(raw) : '';
  }, [job.ocrLatex, job.ocrText]);
  const [text, setText] = useState(initial);
  const textRef = useRef(initial);
  const edRef = useRef<LatexInputEditorHandle>(null);
  const [busy, setBusy] = useState(false);

  const onChange = (v: string) => { textRef.current = v; setText(v); };

  // 커서가 수식 안인데 넣을 것이 수식 하나가 아니면 경고(넣기는 막지 않는다 — 사용자 책임)
  let inMathWarn = false;
  const ed = canInsert ? getEditor() : null;
  if (ed && ed.isSelectionEmpty() && text.trim()) {
    const pos = ed.getCursorPosition();
    if (probeInsertionRegion(ed.getContent(), pos).region && singleMathInner(text) === null) inMathWarn = true;
  }

  const confirm = async () => {
    if (busy) return;
    edRef.current?.commitComposition();                // 카드 편집창에서 조합 중이면 확정
    const editor = getEditor();
    const body = textRef.current;
    if (!editor || !blockId || !canInsert || !body.trim()) return;
    let ctx: { prev?: string; next?: string; inMath: boolean };
    const doc = editor.getContent();
    const pos = editor.getCursorPosition();
    const inMath = !!probeInsertionRegion(doc, pos).region;
    if (editor.isSelectionEmpty()) ctx = { prev: pos > 0 ? doc[pos - 1] : undefined, next: pos < doc.length ? doc[pos] : undefined, inMath };
    else ctx = { inMath };
    const payload = shapeInkPayload(body, ctx);
    if (!payload) return;
    setBusy(true);
    editor.insertPlainText(payload);                     // 삽입 먼저(서버 왕복을 클릭과 삽입 사이에 넣지 않는다)
    onDone(job.id);
    try {
      await actions.markInserted(uid, job.id, { problemId, tabId, blockId, finalText: body.trim() });
    } catch (e) {
      console.error('[ink] inserted 기록 실패', e);
      await alertDialog('편집창에는 넣었지만 필기 기록을 갱신하지 못했습니다. 편집창을 다시 열면 같은 필기가 다시 뜰 수 있습니다.');
    }
  };

  const cancel = async () => {
    if (busy) return;
    const ok = await confirmDialog({
      message: '이 필기를 버릴까요? 원본 이미지도 함께 지워집니다.',
      danger: true,
      confirmLabel: '버리기',
    });
    if (!ok) return;
    setBusy(true);
    onDone(job.id);
    try { await actions.discardJob(uid, job); }
    catch (e) { console.error('[ink] 버리기 실패', e); }
  };

  const confidence = typeof job.confidence === 'number' ? Math.round(job.confidence * 100) : null;
  const where = canInsert && blockId ? `${tabLabel} · 블록 ${blockIndex + 1}` : null;
  const disabled = busy || !canInsert || !text.trim();

  return (
    <div
      data-ink-card=""
      role="dialog"
      aria-label="iPad 필기 확인"
      style={{
        ...dialogBody,
        position: 'fixed', bottom: 16, left: 0, right: 0, margin: '0 auto',
        width: 'min(1100px, calc(100vw - 32px))', maxWidth: 'none', maxHeight: '45vh',
        zIndex: Z_INK_CARD, border: '1px solid var(--border-content)',
      }}
    >
      <div style={dialogHead}>
        <span style={{ flex: 1 }}>iPad 필기{total > 1 ? ` · 1/${total}` : ''}</span>
        {job.ocrError && <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--accent-danger)' }}>인식 실패 — 직접 입력하거나 취소</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr', gap: 12, padding: 12, overflow: 'hidden' }}>
        {/* 좌: 원본 */}
        <button
          type="button"
          title="원본 크게 보기"
          onClick={() => job.imageUrl && window.open(job.imageUrl, '_blank', 'noopener')}
          style={{ minHeight: 0, border: '0.5px solid var(--border-content)', borderRadius: 6, background: '#fff', padding: 4, cursor: 'zoom-in', overflow: 'hidden' }}
        >
          {job.imageUrl && <img src={job.imageUrl} alt="iPad 필기 원본" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />}
        </button>
        {/* 중: 렌더 */}
        <div style={{ minHeight: 0, overflow: 'auto', border: '0.5px solid var(--border-light)', borderRadius: 6, padding: '6px 10px', background: 'var(--bg-functional)' }}>
          {text.trim()
            ? <EditorPreview content={text} borderless autoHeight />
            : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>미리보기</span>}
        </div>
        {/* 우: LaTeX 편집(블록 편집기와 같은 수식 입력) */}
        <div style={{ minHeight: 0, overflow: 'auto', border: '0.5px solid var(--border-content)', borderRadius: 6, padding: '4px 6px', background: 'var(--bg-card, #fff)' }}>
          <LatexInputEditor
            ref={edRef}
            initialValue={initial}
            onChange={onChange}
            onSubmit={confirm}
            fontSize={14}
            minHeight={120}
            placeholder="인식 결과를 고치거나 직접 입력하세요 (⌘Enter 넣기)"
          />
        </div>
      </div>
      <div style={{ ...dialogFoot, justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          {confidence !== null && <span>인식 신뢰도 {confidence}%</span>}
          {where
            ? <span>삽입 위치 · {where}</span>
            : <span style={{ color: 'var(--mathory-red-dark)' }}>{REASON_TEXT[reason ?? 'no-block']}</span>}
          {inMathWarn && <span style={{ color: 'var(--mathory-red-dark)' }}>수식 안에 문장이 들어갑니다</span>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={dialogBtn('ghost', busy)} disabled={busy} onClick={cancel}>취소</button>
          <button type="button" style={dialogBtn('primary', disabled)} disabled={disabled} onClick={confirm}>확인</button>
        </div>
      </div>
    </div>
  );
}
