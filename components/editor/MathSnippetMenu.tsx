'use client';

import { useState, useRef, useEffect } from 'react';
import { MathSnippet } from '../../types/snippet';

interface MathSnippetMenuProps {
  snippets: MathSnippet[];
  onInsert: (content: string) => void;
  onAdd: (data: { name: string; shortcutIndex: number; content: string }) => void;
  onEdit: (snippetId: string, data: Partial<{ name: string; shortcutIndex: number; content: string }>) => void;
  onDelete: (snippetId: string) => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}

// 사용 중인 단축키 번호 목록에서 다음 빈 번호 찾기
function getNextAvailableIndex(snippets: MathSnippet[]): number {
  const used = new Set(snippets.map((s) => s.shortcutIndex));
  for (let i = 1; i <= 9; i++) {
    if (!used.has(i)) return i;
  }
  return snippets.length + 1; // 9 초과 시 번호만 증가 (단축키 없음)
}

// OS 감지 (macOS면 ⌃⌥, Windows/Linux면 Ctrl+Alt)
function getModLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl+Alt+';
  return navigator.platform?.includes('Mac') ? '⌃⌥' : 'Ctrl+Alt+';
}

export default function MathSnippetMenu({
  snippets,
  onInsert,
  onAdd,
  onEdit,
  onDelete,
  anchorRef,
  onClose,
}: MathSnippetMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editTarget, setEditTarget] = useState<MathSnippet | null>(null);
  const [formName, setFormName] = useState('');
  const [formIndex, setFormIndex] = useState(1);
  const [formContent, setFormContent] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const modLabel = getModLabel();

  // 클릭 바깥 감지
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
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

  // 새 상용구 등록 폼 초기화
  const openAddForm = () => {
    setFormName('');
    setFormIndex(getNextAvailableIndex(snippets));
    setFormContent('');
    setEditTarget(null);
    setMode('add');
  };

  // 수정 폼 초기화
  const openEditForm = (snippet: MathSnippet) => {
    setFormName(snippet.name);
    setFormIndex(snippet.shortcutIndex);
    setFormContent(snippet.content);
    setEditTarget(snippet);
    setMode('edit');
  };

  const handleSave = () => {
    if (!formName.trim() || !formContent.trim()) return;
    if (mode === 'add') {
      onAdd({ name: formName.trim(), shortcutIndex: formIndex, content: formContent });
    } else if (mode === 'edit' && editTarget) {
      onEdit(editTarget.id, { name: formName.trim(), shortcutIndex: formIndex, content: formContent });
    }
    setMode('list');
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: Math.max(8, pos.left),
        zIndex: 1000,
        width: 320,
        background: '#fff',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)',
        fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
        animation: 'fadeIn 0.1s ease',
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── 헤더 ─── */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: '#3D3929' }}>
          {mode === 'list' ? '수식 상용구' : mode === 'add' ? '새 상용구 등록' : '상용구 수정'}
        </span>
        {mode !== 'list' && (
          <button
            onClick={() => setMode('list')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              color: '#888',
              padding: '2px 6px',
            }}
          >
            ← 목록
          </button>
        )}
      </div>

      {/* ─── 리스트 모드 ─── */}
      {mode === 'list' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
            {snippets.length === 0 ? (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: '#999', fontSize: 13 }}>
                등록된 상용구가 없습니다
              </div>
            ) : (
              snippets.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '7px 14px',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#f5f4f0';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'none';
                  }}
                  onClick={() => {
                    onInsert(s.content);
                    onClose();
                  }}
                >
                  {/* 왼쪽: 이름 */}
                  <span style={{ flex: 1, fontSize: 13, color: '#3D3929', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.name}
                  </span>

                  {/* 우측: 단축키 + 편집/삭제 */}
                  <span style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {s.shortcutIndex <= 9 ? `${modLabel}${s.shortcutIndex}` : ''}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditForm(s);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#aaa',
                      padding: '2px 4px',
                      borderRadius: 3,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = '#4285f4';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = '#aaa';
                    }}
                    title="수정"
                  >
                    ✎
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(s.id);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: confirmDeleteId === s.id ? '#e53935' : '#aaa',
                      padding: '2px 4px',
                      borderRadius: 3,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.color = '#e53935';
                    }}
                    onMouseLeave={(e) => {
                      if (confirmDeleteId !== s.id) {
                        (e.currentTarget as HTMLElement).style.color = '#aaa';
                      }
                    }}
                    title={confirmDeleteId === s.id ? '한번 더 클릭하면 삭제' : '삭제'}
                  >
                    {confirmDeleteId === s.id ? '삭제?' : '✕'}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* 하단: 새 상용구 등록 */}
          <div style={{ borderTop: '1px solid #eee', flexShrink: 0 }}>
            <button
              onClick={openAddForm}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 13,
                color: '#4285f4',
                fontFamily: "'Pretendard', 'Noto Sans KR', sans-serif",
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = '#f0f4ff';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'none';
              }}
            >
              + 새 상용구 등록
            </button>
          </div>
        </>
      )}

      {/* ─── 등록/수정 폼 ─── */}
      {(mode === 'add' || mode === 'edit') && (
        <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* 상용구 이름 */}
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
              상용구 이름
            </label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="예: 코사인법칙"
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#4285f4';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
              }}
              autoFocus
            />
          </div>

          {/* 단축키 번호 */}
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
              단축키 ({modLabel}번호)
            </label>
            <select
              value={formIndex}
              onChange={(e) => setFormIndex(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 13,
                outline: 'none',
                boxSizing: 'border-box',
                background: '#fff',
              }}
            >
              {Array.from({ length: 9 }, (_, i) => i + 1).map((n) => {
                const taken = snippets.find(
                  (s) => s.shortcutIndex === n && s.id !== editTarget?.id
                );
                return (
                  <option key={n} value={n} disabled={!!taken}>
                    {modLabel}{n}{taken ? ` (사용 중: ${taken.name})` : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 상용구 내용 (LaTeX) */}
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>
              상용구 내용 (LaTeX)
            </label>
            <textarea
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              placeholder={'예: \\overline{AB}'}
              rows={4}
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #ddd',
                borderRadius: 6,
                fontSize: 13,
                fontFamily: "'Menlo', 'Monaco', monospace",
                outline: 'none',
                resize: 'vertical',
                boxSizing: 'border-box',
                lineHeight: '1.6',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = '#4285f4';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = '#ddd';
              }}
            />
          </div>

          {/* 저장/취소 버튼 */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setMode('list')}
              style={{
                padding: '6px 16px',
                border: '1px solid #ddd',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                color: '#666',
              }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!formName.trim() || !formContent.trim()}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: 6,
                background:
                  formName.trim() && formContent.trim() ? '#4285f4' : '#ccc',
                color: '#fff',
                cursor: formName.trim() && formContent.trim() ? 'pointer' : 'default',
                fontSize: 13,
              }}
            >
              {mode === 'add' ? '등록' : '수정'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}