'use client';

import { useState, useRef, useEffect } from 'react';
import { MathSnippet } from '../../types/snippet';
import MathSnippetMenu from './MathSnippetMenu';

interface MathToolbarProps {
  onInsert: (template: string, cursorOffset: number) => void;
  // 상용구 관련 props (optional — 없으면 상용구 버튼 숨김)
  snippets?: MathSnippet[];
  onSnippetInsert?: (content: string) => void;
  onSnippetAdd?: (data: { name: string; shortcutIndex: number; content: string }) => void;
  onSnippetEdit?: (snippetId: string, data: Partial<{ name: string; shortcutIndex: number; content: string }>) => void;
  onSnippetDelete?: (snippetId: string) => void;
}

interface ToolbarItem {
  label: string;
  title: string;
  template: string;
  cursorOffset: number;
}

interface ToolbarCategory {
  name: string;
  icon: string;
  items: ToolbarItem[];
}

// ═══ 카테고리별 버튼 정의 ═══

const CATEGORIES: ToolbarCategory[] = [
  {
    name: '기본',
    icon: 'f',
    items: [
      { label: 'f', title: '분수', template: '\\frac{}{}', cursorOffset: 6 },
      { label: 'df', title: '큰 분수', template: '\\dfrac{}{}', cursorOffset: 7 },
      { label: '√', title: '제곱근', template: '\\sqrt{}', cursorOffset: 6 },
      { label: 'ⁿ√', title: 'n제곱근', template: '\\sqrt[]{}', cursorOffset: 6 },
      { label: 'x²', title: '거듭제곱', template: '^{}', cursorOffset: 2 },
      { label: 'x₂', title: '아래첨자', template: '_{}', cursorOffset: 2 },
      { label: 'ō', title: '윗줄', template: '\\overline{}', cursorOffset: 10 },
      { label: '→v', title: '벡터', template: '\\vec{}', cursorOffset: 5 },
      { label: 'txt', title: '텍스트', template: '\\text{}', cursorOffset: 6 },
      { label: 'rm', title: '로만체', template: '\\mathrm{}', cursorOffset: 8 },
    ],
  },
  {
    name: '미적분',
    icon: '∫',
    items: [
      { label: '∫', title: '정적분', template: '\\int_{}^{} \\, dx', cursorOffset: 6 },
      { label: '∫∫', title: '이중적분', template: '\\iint ', cursorOffset: 6 },
      { label: 'Σ', title: '합', template: '\\sum_{}^{} ', cursorOffset: 6 },
      { label: 'Π', title: '곱', template: '\\prod_{}^{} ', cursorOffset: 7 },
      { label: 'lim', title: '극한', template: '\\lim_{\\to } ', cursorOffset: 6 },
      { label: '∂', title: '편미분', template: '\\partial ', cursorOffset: 9 },
      { label: '∇', title: '나블라', template: '\\nabla ', cursorOffset: 7 },
      { label: 'd/dx', title: '미분', template: '\\frac{d}{dx}', cursorOffset: 12 },
    ],
  },
  {
    name: '괄호',
    icon: '()',
    items: [
      { label: '( )', title: '소괄호', template: '\\left( \\right)', cursorOffset: 7 },
      { label: '[ ]', title: '대괄호', template: '\\left[ \\right]', cursorOffset: 7 },
      { label: '{ }', title: '중괄호', template: '\\left\\{ \\right\\}', cursorOffset: 8 },
      { label: '| |', title: '절댓값', template: '\\left| \\right|', cursorOffset: 7 },
      { label: '‖ ‖', title: '이중선', template: '\\left\\| \\right\\|', cursorOffset: 8 },
      { label: '⌊ ⌋', title: '바닥함수', template: '\\left\\lfloor \\right\\rfloor', cursorOffset: 13 },
      { label: '⌈ ⌉', title: '천장함수', template: '\\left\\lceil \\right\\rceil', cursorOffset: 12 },
    ],
  },
  {
    name: '기호',
    icon: '≤',
    items: [
      { label: '≤', title: '이하', template: '\\leq ', cursorOffset: 5 },
      { label: '≥', title: '이상', template: '\\geq ', cursorOffset: 5 },
      { label: '≠', title: '같지 않음', template: '\\neq ', cursorOffset: 5 },
      { label: '≈', title: '근사', template: '\\approx ', cursorOffset: 8 },
      { label: '∞', title: '무한대', template: '\\infty ', cursorOffset: 7 },
      { label: '→', title: '화살표', template: '\\to ', cursorOffset: 4 },
      { label: '⇒', title: '이중화살표', template: '\\Rightarrow ', cursorOffset: 12 },
      { label: '⇔', title: '동치', template: '\\Leftrightarrow ', cursorOffset: 16 },
      { label: '×', title: '곱하기', template: '\\times ', cursorOffset: 7 },
      { label: '·', title: '가운뎃점', template: '\\cdot ', cursorOffset: 6 },
      { label: '±', title: '플마', template: '\\pm ', cursorOffset: 4 },
      { label: '∈', title: '원소', template: '\\in ', cursorOffset: 4 },
      { label: '⊂', title: '부분집합', template: '\\subset ', cursorOffset: 8 },
      { label: '∩', title: '교집합', template: '\\cap ', cursorOffset: 5 },
      { label: '∪', title: '합집합', template: '\\cup ', cursorOffset: 5 },
      { label: '∅', title: '공집합', template: '\\emptyset ', cursorOffset: 10 },
      { label: '∴', title: '따라서', template: '\\therefore ', cursorOffset: 11 },
      { label: '∵', title: '왜냐하면', template: '\\because ', cursorOffset: 9 },
      { label: '⊥', title: '수직', template: '\\perp ', cursorOffset: 6 },
      { label: '∥', title: '평행', template: '\\parallel ', cursorOffset: 10 },
      { label: '∠', title: '각도', template: '\\angle ', cursorOffset: 7 },
      { label: '△', title: '삼각형', template: '\\triangle ', cursorOffset: 10 },
      { label: '⋯', title: '가운데 점', template: '\\cdots ', cursorOffset: 7 },
    ],
  },
  {
    name: '원문자',
    icon: '①',
    items: [
      { label: '①', title: '원문자 1', template: '①', cursorOffset: 1 },
      { label: '②', title: '원문자 2', template: '②', cursorOffset: 1 },
      { label: '③', title: '원문자 3', template: '③', cursorOffset: 1 },
      { label: '④', title: '원문자 4', template: '④', cursorOffset: 1 },
      { label: '⑤', title: '원문자 5', template: '⑤', cursorOffset: 1 },
      { label: '⑥', title: '원문자 6', template: '⑥', cursorOffset: 1 },
      { label: '⑦', title: '원문자 7', template: '⑦', cursorOffset: 1 },
      { label: '⑧', title: '원문자 8', template: '⑧', cursorOffset: 1 },
      { label: '⑨', title: '원문자 9', template: '⑨', cursorOffset: 1 },
      { label: '⑩', title: '원문자 10', template: '⑩', cursorOffset: 1 },
      { label: '---', title: '', template: '', cursorOffset: 0 },
      { label: '❶', title: '검정 1', template: '❶', cursorOffset: 1 },
      { label: '❷', title: '검정 2', template: '❷', cursorOffset: 1 },
      { label: '❸', title: '검정 3', template: '❸', cursorOffset: 1 },
      { label: '❹', title: '검정 4', template: '❹', cursorOffset: 1 },
      { label: '❺', title: '검정 5', template: '❺', cursorOffset: 1 },
      { label: '---', title: '', template: '', cursorOffset: 0 },
      { label: '㉠', title: '한글 ㄱ', template: '㉠', cursorOffset: 1 },
      { label: '㉡', title: '한글 ㄴ', template: '㉡', cursorOffset: 1 },
      { label: '㉢', title: '한글 ㄷ', template: '㉢', cursorOffset: 1 },
      { label: '㉣', title: '한글 ㄹ', template: '㉣', cursorOffset: 1 },
      { label: '㉤', title: '한글 ㅁ', template: '㉤', cursorOffset: 1 },
      { label: '㉥', title: '한글 ㅂ', template: '㉥', cursorOffset: 1 },
      { label: '㉦', title: '한글 ㅅ', template: '㉦', cursorOffset: 1 },
      { label: '㉧', title: '한글 ㅇ', template: '㉧', cursorOffset: 1 },
    ],
  },
  {
    name: '순열조합',
    icon: 'P',
    items: [
      { label: 'ₙPᵣ', title: '순열', template: '{}_{}\\ \\mathrm{P}_{}', cursorOffset: 1 },
      { label: 'ₙCᵣ', title: '조합', template: '{}_{}\\ \\mathrm{C}_{}', cursorOffset: 1 },
      { label: 'ₙHᵣ', title: '중복조합', template: '{}_{}\\ \\mathrm{H}_{}', cursorOffset: 1 },
      { label: 'ₙΠᵣ', title: '중복순열', template: '{}_{}\\ \\Pi_{}', cursorOffset: 1 },
      { label: 'n!', title: '팩토리얼', template: '!', cursorOffset: 1 },
      { label: '(ⁿᵣ)', title: '이항계수', template: '\\binom{}{}', cursorOffset: 7 },
    ],
  },
];

// ═══ 수식 모드 진입 버튼 (항상 표시) ═══
const MODE_BUTTONS: ToolbarItem[] = [
  { label: '$', title: '인라인 수식', template: '$$', cursorOffset: 1 },
  { label: '$$', title: '블록 수식', template: '$$\n\n$$', cursorOffset: 3 },
];

// ═══ 풀다운 메뉴 컴포넌트 ═══
function DropdownCategory({
  category,
  onInsert,
}: {
  category: ToolbarCategory;
  onInsert: (template: string, cursorOffset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isGrid = category.name === '원문자';

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={category.name}
        style={{
          padding: '4px 8px',
          fontSize: '13px',
          fontFamily: "'Menlo', 'Monaco', monospace",
          backgroundColor: open ? '#e0e0e0' : '#fff',
          border: '1px solid #ccc',
          borderRadius: '4px',
          cursor: 'pointer',
          lineHeight: '1.4',
          display: 'flex',
          alignItems: 'center',
          gap: '3px',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = '#f0f0f0';
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.backgroundColor = '#fff';
        }}
      >
        <span>{category.icon}</span>
        <span style={{ fontSize: '9px', opacity: 0.5 }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: isGrid ? 'auto' : 160,
            padding: '4px 0',
            animation: 'fadeIn 0.1s ease',
          }}
        >
          <div
            style={{
              padding: '4px 12px 6px',
              fontSize: 11,
              fontWeight: 600,
              color: '#999',
              letterSpacing: 0.5,
              fontFamily: 'var(--font-ui, sans-serif)',
            }}
          >
            {category.name}
          </div>

          {isGrid ? (
            <div style={{ padding: '0 8px 8px' }}>
              {(() => {
                const groups: ToolbarItem[][] = [];
                let current: ToolbarItem[] = [];
                category.items.forEach((item) => {
                  if (item.label === '---') {
                    if (current.length > 0) groups.push(current);
                    current = [];
                  } else {
                    current.push(item);
                  }
                });
                if (current.length > 0) groups.push(current);

                return groups.map((group, gi) => (
                  <div key={gi}>
                    {gi > 0 && (
                      <div style={{ height: 1, backgroundColor: '#eee', margin: '6px 0' }} />
                    )}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(5, 1fr)',
                        gap: 3,
                      }}
                    >
                      {group.map((item, idx) => (
                        <button
                          key={idx}
                          title={item.title}
                          onClick={() => {
                            onInsert(item.template, item.cursorOffset);
                            setOpen(false);
                          }}
                          style={{
                            padding: '6px',
                            fontSize: 16,
                            backgroundColor: '#fff',
                            border: '1px solid #eee',
                            borderRadius: 4,
                            cursor: 'pointer',
                            lineHeight: 1,
                            textAlign: 'center',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#f0f0f0';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = '#fff';
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          ) : (
            category.items.map((item, idx) =>
              item.label === '---' ? (
                <div
                  key={idx}
                  style={{ height: 1, backgroundColor: '#eee', margin: '4px 8px' }}
                />
              ) : (
                <button
                  key={idx}
                  onClick={() => {
                    onInsert(item.template, item.cursorOffset);
                    setOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    width: '100%',
                    padding: '6px 12px',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontFamily: "'Menlo', 'Monaco', monospace",
                    color: '#333',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <span
                    style={{
                      minWidth: 32,
                      fontSize: 14,
                      textAlign: 'center',
                    }}
                  >
                    {item.label}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      color: '#999',
                      fontFamily: 'var(--font-ui, sans-serif)',
                    }}
                  >
                    {item.title}
                  </span>
                </button>
              )
            )
          )}
        </div>
      )}
    </div>
  );
}

// ═══ 메인 툴바 ═══
export default function MathToolbar({
  onInsert,
  snippets,
  onSnippetInsert,
  onSnippetAdd,
  onSnippetEdit,
  onSnippetDelete,
}: MathToolbarProps) {
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);
  const snippetBtnRef = useRef<HTMLButtonElement>(null);

  const hasSnippetSupport =
    snippets !== undefined &&
    onSnippetInsert !== undefined &&
    onSnippetAdd !== undefined &&
    onSnippetEdit !== undefined &&
    onSnippetDelete !== undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        alignItems: 'center',
      }}
    >
      {/* 카테고리별 풀다운 */}
      {CATEGORIES.map((cat) => (
        <DropdownCategory
          key={cat.name}
          category={cat}
          onInsert={onInsert}
        />
      ))}

      {/* 구분선 */}
      <div
        style={{
          width: 1,
          height: 24,
          backgroundColor: '#ddd',
          margin: '0 4px',
        }}
      />

      {/* 수식 모드 진입 버튼 (항상 표시) */}
      {MODE_BUTTONS.map((btn) => (
        <button
          key={btn.template}
          title={btn.title}
          onClick={() => onInsert(btn.template, btn.cursorOffset)}
          style={{
            padding: '4px 10px',
            fontSize: '14px',
            fontFamily: "'Menlo', 'Monaco', monospace",
            backgroundColor: '#fff',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            minWidth: '36px',
            lineHeight: '1.4',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e8e8e8';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#fff';
          }}
        >
          {btn.label}
        </button>
      ))}

      {/* ─── 수식 상용구 버튼 (맨 마지막) ─── */}
      {hasSnippetSupport && (
        <>
          <div style={{ width: 1, height: 24, backgroundColor: '#ddd', margin: '0 4px' }} />
          <button
            ref={snippetBtnRef}
            title="수식 상용구"
            onClick={() => setSnippetMenuOpen((prev) => !prev)}
            style={{
              padding: '4px 8px',
              fontSize: '13px',
              fontFamily: 'var(--font-ui, sans-serif)',
              backgroundColor: snippetMenuOpen ? '#e0e0e0' : '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer',
              lineHeight: '1.4',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              if (!snippetMenuOpen) e.currentTarget.style.backgroundColor = '#f0f0f0';
            }}
            onMouseLeave={(e) => {
              if (!snippetMenuOpen) e.currentTarget.style.backgroundColor = '#fff';
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            상용구
          </button>

          {snippetMenuOpen && (
            <MathSnippetMenu
              snippets={snippets}
              onInsert={onSnippetInsert}
              onAdd={onSnippetAdd}
              onEdit={onSnippetEdit}
              onDelete={onSnippetDelete}
              anchorRef={snippetBtnRef}
              onClose={() => setSnippetMenuOpen(false)}
            />
          )}
        </>
      )}
    </div>
  );
}