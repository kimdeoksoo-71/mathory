'use client';

import { useState, useRef, useEffect } from 'react';
import { MathSnippet, SnippetInput, SnippetKind } from '../../types/snippet';
import { DEFAULT_ABBREVS, SLOT_CHAR } from '../../lib/mathInput';

/* Phase 68 — 스니펫 메뉴. 두 절: 단축키 상용구(현행, `⌃⌥1~9`, 수식 안팎) · 수식 단축어(수식 안에서 약어 뒤 Tab).
   구조 템플릿 3종(Phase 54)은 D3로 삭제. 수식 단축어 클릭은 약어 Tab과 같은 엔진(lib/mathSlots)으로 넣는다(D8). */

interface MathSnippetMenuProps {
  snippets: MathSnippet[];
  /** 기본 8종 + 사용자(사용자 우선) */
  abbrevs: Record<string, string>;
  /** 사용자가 등록한 약어 — 기본 행 "대체됨" 표시·중복 검사 */
  userAbbrevs: Set<string>;
  onInsert: (content: string) => void;
  onInsertAbbrev: (content: string) => void;
  onAdd: (data: SnippetInput) => void;
  onEdit: (snippetId: string, data: Partial<SnippetInput>) => void;
  onDelete: (snippetId: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

type Mode = 'list' | 'pick-kind' | 'add-hotkey' | 'add-abbrev' | 'edit';

/** 기본 수식 단축어의 표시 이름(코드 상수 — 내용은 lib/mathInput.DEFAULT_ABBREVS) */
const DEFAULT_ABBREV_NAMES: Record<string, string> = {
  b1: '선분', b2: '선분 제곱', log: '로그', sq: '근호', root: '거듭제곱근', lim: '극한', int: '적분', sum: '시그마',
};

export const ABBREV_RE = /^[A-Za-z][A-Za-z0-9]{0,9}$/;

// 사용 중인 단축키 번호에서 다음 빈 번호 — ⚠ hotkey만 센다(abbrev 문서에는 번호가 없다)
function getNextAvailableIndex(hotkeys: MathSnippet[]): number {
  const used = new Set(hotkeys.map((s) => s.shortcutIndex));
  for (let i = 1; i <= 9; i++) if (!used.has(i)) return i;
  return hotkeys.length + 1; // 9 초과 시 번호만 증가 (단축키 없음)
}

// OS 감지 (macOS면 ⌃⌥, Windows/Linux면 Ctrl+Alt)
function getModLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+Alt+';
  return navigator.platform?.includes('Mac') ? '⌃⌥' : 'Ctrl+Alt+';
}

const FONT = "'Pretendard', 'Noto Sans KR', sans-serif";
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 10px', border: '1px solid var(--border-primary, #ddd)', borderRadius: 6,
  fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-muted, #888)', display: 'block', marginBottom: 4 };
const smallBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text-faint, #aaa)', padding: '2px 4px', borderRadius: 3,
};
const sectionTitle: React.CSSProperties = { padding: '6px 14px 2px', fontSize: 11, color: 'var(--text-faint, #aaa)' };
const chip: React.CSSProperties = { fontSize: 11, color: 'var(--text-faint, #aaa)', fontFamily: 'monospace', whiteSpace: 'nowrap' };

export default function MathSnippetMenu({
  snippets, abbrevs, userAbbrevs, onInsert, onInsertAbbrev, onAdd, onEdit, onDelete, anchorRef, onClose,
}: MathSnippetMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [editTarget, setEditTarget] = useState<MathSnippet | null>(null);
  const [formName, setFormName] = useState('');
  const [formIndex, setFormIndex] = useState(1);
  const [formAbbrev, setFormAbbrev] = useState('');
  const [formContent, setFormContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const modLabel = getModLabel();
  const hotkeys = snippets.filter((s) => s.kind === 'hotkey');
  const userAbbrevList = snippets.filter((s) => s.kind === 'abbrev');
  const formKind: SnippetKind = mode === 'add-hotkey' ? 'hotkey' : mode === 'add-abbrev' ? 'abbrev' : (editTarget?.kind ?? 'hotkey');

  // 클릭 바깥 감지
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)
        && anchorRef.current && !anchorRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // 메뉴 위치 계산
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.right - 320 });
    }
  }, [anchorRef]);

  const openAddHotkey = () => {
    setFormName(''); setFormIndex(getNextAvailableIndex(hotkeys)); setFormContent(''); setEditTarget(null); setMode('add-hotkey');
  };
  const openAddAbbrev = () => {
    setFormName(''); setFormAbbrev(''); setFormContent(''); setEditTarget(null); setMode('add-abbrev');
  };
  const openEditForm = (s: MathSnippet) => {
    setFormName(s.name); setFormIndex(s.shortcutIndex ?? 1); setFormAbbrev(s.abbrev ?? ''); setFormContent(s.content);
    setEditTarget(s); setMode('edit');
  };

  // 약어 검증(D6) — 형식 + 사용자 약어끼리 중복(수정 중인 자신은 제외). 기본과 같은 것은 허용(D5 사용자 우선)
  const abbrevTrim = formAbbrev.trim();
  const abbrevFormatOk = ABBREV_RE.test(abbrevTrim);
  const abbrevDup = formKind === 'abbrev' && abbrevFormatOk
    && userAbbrevList.some((s) => s.abbrev === abbrevTrim && s.id !== editTarget?.id);
  const abbrevError = formKind !== 'abbrev' || !abbrevTrim ? '' : !abbrevFormatOk ? '영문자로 시작, 영문·숫자 1~10자' : abbrevDup ? '이미 쓰는 약어입니다' : '';
  const canSave = !!formName.trim() && !!formContent.trim()
    && (formKind === 'hotkey' || (abbrevFormatOk && !abbrevDup));

  const handleSave = () => {
    if (!canSave) return;
    const base = { name: formName.trim(), content: formContent };
    const data: SnippetInput = formKind === 'hotkey'
      ? { kind: 'hotkey', ...base, shortcutIndex: formIndex }
      : { kind: 'abbrev', ...base, abbrev: abbrevTrim };
    if (mode === 'edit' && editTarget) onEdit(editTarget.id, data);
    else onAdd(data);
    setMode('list');
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) { onDelete(id); setConfirmDeleteId(null); }
    else setConfirmDeleteId(id);
  };

  /** `▢ 넣기` — textarea 캐럿 위치에 자리 문자를 넣는다 */
  const insertSlotChar = () => {
    const ta = textareaRef.current;
    const start = ta?.selectionStart ?? formContent.length;
    const end = ta?.selectionEnd ?? start;
    const next = formContent.slice(0, start) + SLOT_CHAR + formContent.slice(end);
    setFormContent(next);
    requestAnimationFrame(() => { if (ta) { ta.focus(); ta.setSelectionRange(start + 1, start + 1); } });
  };

  const title = mode === 'list' ? '스니펫'
    : mode === 'pick-kind' ? '새 스니펫 등록'
    : mode === 'add-hotkey' ? '새 단축키 상용구'
    : mode === 'add-abbrev' ? '새 수식 단축어'
    : formKind === 'hotkey' ? '상용구 수정' : '수식 단축어 수정';

  const hoverIn = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.background = '#f5f4f0'; };
  const hoverOut = (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.background = 'none'; };

  /** 사용자 항목 행(두 절 공용) — 이름 · 칩 · 수정 · 삭제 */
  const renderRow = (s: MathSnippet) => (
    <div
      key={s.id}
      style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', cursor: 'pointer', transition: 'background 0.1s', gap: 8 }}
      onMouseEnter={hoverIn} onMouseLeave={hoverOut}
      onClick={() => { if (s.kind === 'abbrev') onInsertAbbrev(s.content); else onInsert(s.content); onClose(); }}
    >
      <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary, #2D2A23)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {s.name}
      </span>
      <span style={chip}>
        {s.kind === 'hotkey' ? ((s.shortcutIndex ?? 99) <= 9 ? `${modLabel}${s.shortcutIndex}` : '') : s.abbrev}
      </span>
      <button
        onClick={(e) => { e.stopPropagation(); openEditForm(s); }}
        style={smallBtn}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-faint, #aaa)'; }}
        title="수정"
      >
        ✎
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
        style={{ ...smallBtn, color: confirmDeleteId === s.id ? 'var(--accent-danger, #C0392B)' : 'var(--text-faint, #aaa)' }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-danger, #C0392B)'; }}
        onMouseLeave={(e) => { if (confirmDeleteId !== s.id) (e.currentTarget as HTMLElement).style.color = 'var(--text-faint, #aaa)'; }}
        title={confirmDeleteId === s.id ? '한번 더 클릭하면 삭제' : '삭제'}
      >
        {confirmDeleteId === s.id ? '삭제?' : '✕'}
      </button>
    </div>
  );

  const kindButton = (label: string, desc: string, onClick: () => void) => (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '10px 14px', border: '1px solid var(--border-light, #eee)', borderRadius: 8,
        background: '#fff', cursor: 'pointer', fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 2,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #F0EBE3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff'; }}
    >
      <span style={{ fontSize: 13, color: 'var(--text-primary, #2D2A23)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-muted, #888)' }}>{desc}</span>
    </button>
  );

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed', top: pos.top, left: Math.max(8, pos.left), zIndex: 1000, width: 320, background: '#fff', borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)', fontFamily: FONT, animation: 'fadeIn 0.1s ease',
        maxHeight: 420, display: 'flex', flexDirection: 'column',
      }}
    >
      {/* ─── 헤더 ─── */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-light, #eee)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary, #2D2A23)' }}>{title}</span>
        {mode !== 'list' && (
          <button onClick={() => setMode(mode === 'add-hotkey' || mode === 'add-abbrev' ? 'pick-kind' : 'list')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-muted, #888)', padding: '2px 6px' }}>
            {mode === 'add-hotkey' || mode === 'add-abbrev' ? '← 종류' : '← 목록'}
          </button>
        )}
      </div>

      {/* ─── 리스트 ─── */}
      {mode === 'list' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {/* 단축키 상용구 */}
            <div style={sectionTitle}>단축키 상용구</div>
            {hotkeys.length === 0
              ? <div style={{ padding: '8px 14px 12px', color: 'var(--text-muted, #999)', fontSize: 12 }}>등록된 상용구가 없습니다</div>
              : hotkeys.map(renderRow)}

            {/* 수식 단축어 */}
            <div style={{ ...sectionTitle, borderTop: '1px solid #f0efe9', marginTop: 4, paddingTop: 8 }}>수식 단축어 <span style={{ opacity: 0.8 }}>· 수식 안에서 약어 뒤 Tab</span></div>
            {userAbbrevList.map(renderRow)}
            {Object.keys(DEFAULT_ABBREVS).map((key) => {
              const replaced = userAbbrevs.has(key);
              return (
                <div
                  key={`default-${key}`}
                  style={{ display: 'flex', alignItems: 'center', padding: '7px 14px', cursor: replaced ? 'default' : 'pointer', gap: 8, opacity: replaced ? 0.45 : 1 }}
                  onMouseEnter={replaced ? undefined : hoverIn} onMouseLeave={replaced ? undefined : hoverOut}
                  onClick={replaced ? undefined : () => { onInsertAbbrev(abbrevs[key]); onClose(); }}
                  title={replaced ? '같은 약어를 등록해 사용자 것이 우선합니다' : DEFAULT_ABBREVS[key]}
                >
                  <span style={{ flex: 1, fontSize: 13, color: 'var(--text-primary, #2D2A23)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {DEFAULT_ABBREV_NAMES[key] ?? key}
                  </span>
                  <span style={chip}>{key}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-faint, #aaa)', whiteSpace: 'nowrap', minWidth: 34, textAlign: 'right' }}>
                    {replaced ? '대체됨' : '기본'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* 하단: 새 스니펫 등록 */}
          <div style={{ borderTop: '1px solid var(--border-light, #eee)', flexShrink: 0 }}>
            <button
              onClick={() => setMode('pick-kind')}
              style={{
                width: '100%', padding: '10px 14px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                color: 'var(--accent-primary)', fontFamily: FONT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover, #F0EBE3)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
            >
              + 새 스니펫 등록
            </button>
          </div>
        </>
      )}

      {/* ─── 종류 선택 ─── */}
      {mode === 'pick-kind' && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {kindButton('단축키 상용구', `${modLabel}1~9로 넣는 문구 — 수식 안팎 어디서나`, openAddHotkey)}
          {kindButton('수식 단축어', '수식 안에서 약어를 치고 Tab — ▢ 자리를 Tab으로 순회', openAddAbbrev)}
        </div>
      )}

      {/* ─── 등록/수정 폼 ─── */}
      {(mode === 'add-hotkey' || mode === 'add-abbrev' || mode === 'edit') && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          <div>
            <label style={labelStyle}>{formKind === 'hotkey' ? '상용구 이름' : '단축어 이름'}</label>
            <input
              value={formName} onChange={(e) => setFormName(e.target.value)}
              placeholder={formKind === 'hotkey' ? '예: 코사인법칙' : '예: 극한'}
              style={inputStyle}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary, #ddd)'; }}
              autoFocus
            />
          </div>

          {formKind === 'hotkey' ? (
            <div>
              <label style={labelStyle}>단축키 ({modLabel}번호)</label>
              <select value={formIndex} onChange={(e) => setFormIndex(Number(e.target.value))} style={{ ...inputStyle, background: '#fff' }}>
                {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
                  const taken = hotkeys.find((s) => s.shortcutIndex === n && s.id !== editTarget?.id);
                  return (
                    <option key={n} value={n} disabled={!!taken}>
                      {modLabel}{n}{taken ? ` (사용 중: ${taken.name})` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div>
              <label style={labelStyle}>약어 (수식 안에서 약어 뒤 Tab)</label>
              <input
                value={formAbbrev} onChange={(e) => setFormAbbrev(e.target.value)}
                placeholder="예: lim"
                spellCheck={false}
                style={{ ...inputStyle, fontFamily: 'var(--font-mono)', borderColor: abbrevError ? 'var(--accent-danger, #C0392B)' : 'var(--border-primary, #ddd)' }}
              />
              {abbrevError
                ? <div style={{ fontSize: 11, color: 'var(--accent-danger, #C0392B)', marginTop: 4 }}>{abbrevError}</div>
                : abbrevTrim && Object.prototype.hasOwnProperty.call(DEFAULT_ABBREVS, abbrevTrim) && !userAbbrevs.has(abbrevTrim)
                  ? <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>기본 단축어 `{abbrevTrim}`을 대체합니다</div>
                  : null}
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>{formKind === 'hotkey' ? '상용구 내용 (LaTeX)' : '내용 (LaTeX · ▢ = 입력 자리)'}</label>
              {formKind === 'abbrev' && (
                <button onClick={insertSlotChar} type="button"
                  style={{ ...smallBtn, color: 'var(--accent-primary)', fontSize: 12, border: '1px solid var(--border-light, #eee)', borderRadius: 4, padding: '1px 8px' }}
                  title="캐럿 위치에 입력 자리 넣기">
                  {SLOT_CHAR} 넣기
                </button>
              )}
            </div>
            <textarea
              ref={textareaRef}
              value={formContent} onChange={(e) => setFormContent(e.target.value)}
              placeholder={formKind === 'hotkey' ? '예: \\overline{AB}' : `예: \\lim_{${SLOT_CHAR} \\to ${SLOT_CHAR}}{${SLOT_CHAR}}`}
              rows={4}
              spellCheck={false}
              style={{ ...inputStyle, padding: '8px 10px', fontFamily: 'var(--font-mono)', resize: 'vertical', lineHeight: '1.6' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary, #ddd)'; }}
            />
            {formKind === 'abbrev' && !formContent.includes(SLOT_CHAR) && formContent.trim() && (
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>▢가 없으면 빈 괄호 안이 입력 자리가 됩니다</div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setMode('list')}
              style={{ padding: '6px 16px', border: '1px solid var(--border-primary, #ddd)', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary, #666)' }}>
              취소
            </button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ padding: '6px 16px', border: 'none', borderRadius: 6, background: canSave ? 'var(--accent-primary)' : '#ccc', color: '#fff', cursor: canSave ? 'pointer' : 'default', fontSize: 13 }}>
              {mode === 'edit' ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
