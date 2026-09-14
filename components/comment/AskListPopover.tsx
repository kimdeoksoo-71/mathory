'use client';

/**
 * Phase 66a — 문답 검증 질문 리스트 (agent 대화창 입력 상단)
 *
 * 1단 목록(선택·수정·복제·삭제) → 2단 전송 → 편집 모달. 질문의 진실은 Firestore이고
 * 씨앗(`lib/ask/seed.ts`)은 최초 1회 복사본이다.
 *
 * ⚠ 이 컴포넌트에 `position: relative`를 두지 말 것 — 팝오버의 기준 상자는 **컴포저 래퍼**
 *   (`CommentPanel.tsx:1100-1104`)여야 한다. 여기에 두면 기준이 "칩 묶음"이 되어 패널 밖으로 넘친다
 *   (`VerifyChips`의 같은 주석 `:1458-1460`). 그래서 팝오버는 `left:0; right:0`로 래퍼 폭을 그대로 쓴다 —
 *   `width:250` 리터럴을 베끼지 말 것(패널 420에서 내용이 잘린다).
 * ⚠ 전송은 **전체를 try/catch**한다(D21) — `CommentEditor.handleSubmit`은 `try/finally`뿐이라
 *   타이핑 경로는 실패가 조용히 사라진다. 문답은 그 경로를 타지 않으므로 스스로 잡아야 한다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AIModelConfig } from '../../types/problem';
import {
  buildAskMessage, nextOrder, triggerWarnings, validateQuestion,
  type AskQuestion, type AskTarget,
} from '../../lib/ask/seed';
import {
  listAskQuestions, createAskQuestion, updateAskQuestion, setAskQuestionEnabled,
  duplicateAskQuestion, deleteAskQuestion, ensureSeeded,
} from '../../lib/askQuestions';
import { alertDialog, confirmDialog } from '../../lib/dialogs';
import {
  dialogOverlay, dialogBody, dialogHead, dialogContent, dialogFoot, dialogInput, dialogBtn,
} from '../ui/dialogStyles';
import { IconQuestionList, IconDots } from '../ui/Icons';
import { AIBrandIcon } from './AIBrandIcon';

/** D9 — 모델 선택만 기억한다(질문은 매번 고르는 것이 목적이다). */
const LS_KEY = 'mathory.ask.v1';

function loadRememberedModels(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw);
    return Array.isArray(v?.modelIds) ? v.modelIds.filter((x: unknown) => typeof x === 'string') : [];
  } catch { return []; }
}
function rememberModels(modelIds: string[]): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ modelIds })); } catch { /* 사파리 프라이빗 등 */ }
}

/** D8 — 기억값 → 없으면 anthropic 중 order가 가장 작은 문서(실험 문서를 order로 앞세운다). */
function defaultModelIds(models: AIModelConfig[]): string[] {
  const remembered = loadRememberedModels().filter((id) => models.some((m) => m.modelId === id));
  if (remembered.length) return remembered;
  const claude = models.filter((m) => m.provider === 'anthropic').sort((a, b) => a.order - b.order)[0];
  return claude ? [claude.modelId] : [];
}

interface Props {
  uid: string;
  models: AIModelConfig[];
  /** 같은 세션에 응답 대기 중인 항목이 있는가 (연타 차단) */
  busy: boolean;
  /** 보낼 세션이 있는가 (`!!activeSessionId`) */
  canSend: boolean;
  /** CommentPanel이 D15′(히스토리 미첨부)·D17(답글 해제)을 담당한다 */
  onSend: (message: string, modelIds: string[]) => Promise<void>;
  /** D12″ — 편집창이면 저장 먼저. **실패는 throw**한다 */
  onBeforeSend?: () => Promise<void>;
}

export default function AskListPopover({ uid, models, busy, canSend, onSend, onBeforeSend }: Props) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState<AskQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<AskQuestion | null>(null);
  const [sendModelIds, setSendModelIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<{ id: string | null; rev: number; label: string; target: AskTarget; text: string; enabled: boolean } | null>(null);
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  const reload = useCallback(async () => {
    setQuestions(await listAskQuestions(uid));
  }, [uid]);

  /* D4 — 씨앗은 **팝오버 첫 열기**에서 만든다(패널 마운트가 아니다).
     ⚠ 실패(규칙 미배포 등)는 빈 목록 + 안내로 흘린다 — 크래시 금지. */
  const openPopover = useCallback(async () => {
    setOpen(true);
    setSendTarget(null);
    setMenuFor(null);
    if (questions.length || loading) return;
    setLoading(true);
    setLoadError(null);
    try {
      setQuestions(await ensureSeeded(uid));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : '질문 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }, [uid, questions.length, loading]);

  // 바깥 클릭으로 닫기 (편집 모달이 떠 있으면 두지 않는다 — 모달이 위를 덮는다)
  useEffect(() => {
    if (!open || editing) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) { setOpen(false); setMenuFor(null); }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open, editing]);

  const resolved = sendModelIds.map((id) => models.find((m) => m.modelId === id)).filter(Boolean);
  const canActuallySend = resolved.length > 0 && canSend && !busy && !sending;

  const startSend = (q: AskQuestion) => {
    setSendTarget(q);
    setMenuFor(null);
    setSendModelIds((prev) => (prev.length ? prev : defaultModelIds(models)));
  };

  /* D21 — 전송 전체를 잡는다. `onBeforeSend`의 throw(저장 실패·대기 초과)와
     `onSend`의 throw(댓글 저장 실패)를 **둘 다** 안내로 바꾼다. */
  const doSend = async () => {
    if (!sendTarget || !canActuallySend) return;
    setSending(true);
    try {
      await onBeforeSend?.();
    } catch (e) {
      setSending(false);
      await alertDialog(e instanceof Error ? e.message : '저장에 실패해 전송을 중단했습니다');
      return;   // 팝오버는 열어 둔다 — 고친 뒤 다시 누를 수 있게
    }
    const ids = [...sendModelIds];
    const message = buildAskMessage(sendTarget);
    rememberModels(ids);
    setOpen(false);
    setSendTarget(null);
    try {
      await onSend(message, ids);
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : '전송에 실패했습니다');
    } finally {
      setSending(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const bad = validateQuestion(editing);
    if (bad) { await alertDialog(bad); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await updateAskQuestion(uid, editing.id, {
          label: editing.label.trim(), target: editing.target,
          text: editing.text, enabled: editing.enabled,
        }, editing.rev);
      } else {
        await createAskQuestion(uid, {
          label: editing.label.trim(), target: editing.target, text: editing.text,
          order: nextOrder(questions), enabled: editing.enabled, rev: 1,
        });
      }
      await reload();
      setEditing(null);
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : '저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const onDuplicate = async (q: AskQuestion) => {
    setMenuFor(null);
    try {
      const newId = await duplicateAskQuestion(uid, q);
      const fresh = await listAskQuestions(uid);
      setQuestions(fresh);
      // 방금 만든 사본을 곧바로 고칠 수 있게 연다(D6 — 복제는 "조금 바꿔 비교"가 목적이다)
      const made = fresh.find((x) => x.id === newId);
      if (made) setEditing({ id: made.id, rev: made.rev, label: made.label, target: made.target, text: made.text, enabled: made.enabled });
    } catch (e) {
      await alertDialog(e instanceof Error ? e.message : '복제에 실패했습니다');
    }
  };

  const onDelete = async (q: AskQuestion) => {
    setMenuFor(null);
    const ok = await confirmDialog({
      title: '질문 삭제',
      message: [`"${q.label}"을 삭제할까요?`, '되돌릴 수 없습니다. 보관만 하려면 "사용 안 함"으로 두세요.'],
      danger: true, confirmLabel: '삭제',
    });
    if (!ok) return;
    try { await deleteAskQuestion(uid, q.id); await reload(); }
    catch (e) { await alertDialog(e instanceof Error ? e.message : '삭제에 실패했습니다'); }
  };

  const onToggleEnabled = async (q: AskQuestion) => {
    setMenuFor(null);
    try { await setAskQuestionEnabled(uid, q.id, !q.enabled); await reload(); }
    catch (e) { await alertDialog(e instanceof Error ? e.message : '변경에 실패했습니다'); }
  };

  // 사용 안 함은 맨 아래 흐리게(완전히 숨기면 되살릴 길이 없다)
  const ordered = [...questions].sort((a, b) => (Number(b.enabled) - Number(a.enabled)) || (a.order - b.order));
  const editWarnings = editing ? triggerWarnings(editing.text) : [];

  return (
    <span ref={rootRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
      <button
        onClick={() => (open ? setOpen(false) : openPopover())}
        title="문답 검증 질문 목록"
        aria-label="문답 검증 질문 목록"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          border: `1px solid ${open ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
          background: open ? 'var(--accent-soft)' : 'transparent',
          color: 'var(--text-secondary)',
          borderRadius: 12, padding: '2px 8px', fontSize: 11,
          cursor: 'pointer', fontFamily: 'var(--font-ui)', whiteSpace: 'nowrap',
        }}
      >
        <IconQuestionList size={13} />질문
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 20,
          maxHeight: 320, overflowY: 'auto',
          borderRadius: 8, border: '1px solid var(--border-primary)',
          background: 'var(--bg-card)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          fontSize: 12, color: 'var(--text-secondary)',
        }}>
          {sendTarget ? (
            /* ── 2단: 전송 ── */
            <div style={{ padding: 12 }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {sendTarget.label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>r{sendTarget.rev}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {models.map((m) => {
                  const on = sendModelIds.includes(m.modelId);
                  return (
                    <button
                      key={m.modelId}
                      onClick={() => setSendModelIds((prev) => (on ? prev.filter((x) => x !== m.modelId) : [...prev, m.modelId]))}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        border: `1px solid ${on ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
                        background: on ? 'var(--accent-soft)' : 'transparent',
                        color: on ? 'var(--text-primary)' : 'var(--text-muted)',
                        borderRadius: 12, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      <AIBrandIcon provider={m.provider} fallbackEmoji={m.avatarEmoji} size={12} />{m.nickname}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 8 }}>
                문제와 풀이 탭만 지적합니다. AI 풀이 등 다른 탭은 참고로만 보냅니다. 이전 대화는 참조하지 않습니다.
              </div>
              {triggerWarnings(sendTarget.text).map((w) => (
                <div key={w} style={{
                  fontSize: 11, lineHeight: 1.5, marginBottom: 8, padding: '6px 8px', borderRadius: 4,
                  background: 'var(--bg-warn)', color: 'var(--text-primary)',
                }}>⚠ {w}</div>
              ))}
              {!canSend && (
                <div style={{ fontSize: 11, color: 'var(--accent-danger)', marginBottom: 8 }}>
                  먼저 세션을 만들어 주세요.
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button onClick={() => setSendTarget(null)} style={{
                  border: '1px solid var(--border-primary)', background: 'transparent',
                  borderRadius: 4, padding: '3px 10px', fontSize: 11, cursor: 'pointer',
                  color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
                }}>취소</button>
                <button
                  onClick={doSend}
                  disabled={!canActuallySend}
                  style={{
                    border: 'none',
                    background: canActuallySend ? 'var(--accent-primary)' : 'var(--border-primary)',
                    color: '#fff', borderRadius: 4, padding: '3px 10px', fontSize: 11,
                    cursor: canActuallySend ? 'pointer' : 'default',
                    fontFamily: 'var(--font-ui)', fontWeight: 600,
                  }}
                >{sending ? '보내는 중…' : '보내기'}</button>
              </div>
            </div>
          ) : (
            /* ── 1단: 목록 ── */
            <div>
              {loading && <div style={{ padding: 12, color: 'var(--text-muted)' }}>불러오는 중…</div>}
              {loadError && (
                <div style={{ padding: 12, color: 'var(--accent-danger)', lineHeight: 1.5 }}>
                  {loadError}
                </div>
              )}
              {!loading && !loadError && ordered.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)' }}>질문이 없습니다.</div>
              )}
              {ordered.map((q) => {
                const warn = triggerWarnings(q.text).length > 0;
                const first = q.text.split('\n').find((l) => l.trim()) || '';
                return (
                  <div key={q.id} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 6,
                    padding: '8px 10px', borderBottom: '1px solid var(--border-light, #eee)',
                    opacity: q.enabled ? 1 : 0.45,
                  }}>
                    <button
                      onClick={() => startSend(q)}
                      style={{
                        flex: 1, minWidth: 0, textAlign: 'left', border: 'none',
                        background: 'transparent', cursor: 'pointer', padding: 0,
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                        {q.label} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>r{q.rev}</span>
                        {warn && <span title="서버 트리거 낱말이 있습니다" style={{ color: 'var(--mathory-red)' }}> ⚠</span>}
                      </div>
                      <div style={{
                        fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{first}</div>
                    </button>
                    <span style={{ position: 'relative', flexShrink: 0 }}>
                      <button
                        onClick={() => setMenuFor((p) => (p === q.id ? null : q.id))}
                        aria-label="질문 메뉴"
                        style={{
                          border: 'none', background: 'transparent', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '0 2px', lineHeight: 1,
                        }}
                      ><IconDots size={14} /></button>
                      {menuFor === q.id && (
                        <div style={{
                          position: 'absolute', right: 0, top: '100%', zIndex: 2, minWidth: 110,
                          borderRadius: 6, border: '1px solid var(--border-primary)',
                          background: 'var(--bg-card)', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                          padding: 4,
                        }}>
                          {[
                            { label: '수정', run: () => { setMenuFor(null); setEditing({ id: q.id, rev: q.rev, label: q.label, target: q.target, text: q.text, enabled: q.enabled }); } },
                            { label: '복제', run: () => onDuplicate(q) },
                            { label: q.enabled ? '사용 안 함' : '사용', run: () => onToggleEnabled(q) },
                            { label: '삭제', run: () => onDelete(q), danger: true },
                          ].map((it) => (
                            <button
                              key={it.label}
                              onClick={it.run}
                              style={{
                                display: 'block', width: '100%', textAlign: 'left', border: 'none',
                                background: 'transparent', cursor: 'pointer', padding: '5px 8px',
                                fontSize: 11.5, fontFamily: 'var(--font-ui)', borderRadius: 4,
                                color: it.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                              }}
                            >{it.label}</button>
                          ))}
                        </div>
                      )}
                    </span>
                  </div>
                );
              })}
              <div style={{ padding: 8 }}>
                <button
                  onClick={() => setEditing({ id: null, rev: 1, label: '', target: 'solution', text: '', enabled: true })}
                  style={{
                    border: '1px dashed var(--border-primary)', background: 'transparent',
                    borderRadius: 4, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
                    color: 'var(--text-secondary)', fontFamily: 'var(--font-ui)', width: '100%',
                  }}
                >+ 새 질문</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 편집 모달 (Z_DIALOG 10500 — 팝오버 위에 뜬다) ── */}
      {editing && (
        <div style={dialogOverlay} onPointerDown={(e) => e.stopPropagation()}>
          <div style={{ ...dialogBody, width: 560 }}>
            <div style={dialogHead}>{editing.id ? '질문 수정' : '새 질문'}</div>
            <div style={{ ...dialogContent, whiteSpace: 'normal' }}>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>라벨</label>
              <input
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                style={{ ...dialogInput, marginBottom: 12 }}
              />
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>대상</label>
              <select
                value={editing.target}
                onChange={(e) => setEditing({ ...editing, target: e.target.value as AskTarget })}
                style={{ ...dialogInput, marginBottom: 12 }}
              >
                <option value="solution">해설</option>
                <option value="problem">문제</option>
              </select>
              <label style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>질문 본문</label>
              <textarea
                value={editing.text}
                onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                rows={14}
                style={{ ...dialogInput, fontSize: 13, lineHeight: 1.6, resize: 'vertical', marginBottom: 8 }}
              />
              {editWarnings.map((w) => (
                <div key={w} style={{
                  fontSize: 11.5, lineHeight: 1.5, marginBottom: 8, padding: '6px 8px', borderRadius: 4,
                  background: 'var(--bg-warn)', color: 'var(--text-primary)',
                }}>⚠ {w}</div>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <input
                  type="checkbox"
                  checked={editing.enabled}
                  onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                />
                사용
              </label>
            </div>
            <div style={dialogFoot}>
              <button onClick={() => setEditing(null)} style={dialogBtn('ghost')}>취소</button>
              <button onClick={saveEdit} disabled={saving} style={dialogBtn('primary', saving)}>
                {saving ? '저장 중…' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
