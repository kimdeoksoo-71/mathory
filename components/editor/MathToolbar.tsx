'use client';

/**
 * 수식 카테고리 풀다운만 렌더. (Phase 25 Step 2)
 * 진입 버튼($, $$), Snippet, 원문자 등 부가 항목은 UnifiedToolbar가 담당.
 * Step 3에서 커스터마이징 가능한 그룹 시스템으로 교체될 예정 — 그 시점에 이 파일 제거.
 */

import { useState, useRef, useEffect } from 'react';

interface MathToolbarProps {
  onInsert: (template: string, cursorOffset: number) => void;
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
      { label: '→v', title: '벡터', template: '\\overrightarrow{}', cursorOffset: 5 },
      { label: 'txt', title: '텍스트', template: '\\text{}', cursorOffset: 6 },
      { label: 'rm', title: '로만체', template: '\\mathrm{}', cursorOffset: 8 },
    ],
  },
  {
    name: '미적분',
    icon: '∫',
    items: [
      { label: 'd/dx', title: '미분', template: '\\frac{d}{dx}', cursorOffset: 12 },
      { label: '∫', title: '정적분', template: '\\int_{}^{} \\, dx', cursorOffset: 6 },
      { label: 'Σ', title: '합', template: '\\sum_{}^{} ', cursorOffset: 6 },
      { label: 'lim', title: '극한', template: '\\lim_{\\to } ', cursorOffset: 6 },
    ],
  },
  {
    name: '순열조합',
    icon: 'P',
    items: [
      { label: 'ₙPᵣ', title: '순열', template: '{}_{}\\mathrm{P}_{}', cursorOffset: 1 },
      { label: 'ₙCᵣ', title: '조합', template: '{}_{}\\mathrm{C}_{}', cursorOffset: 1 },
      { label: 'ₙHᵣ', title: '중복조합', template: '{}_{}\\mathrm{H}_{}', cursorOffset: 1 },
      { label: 'ₙΠᵣ', title: '중복순열', template: '{}_{}\\Pi_{}', cursorOffset: 1 },
      { label: 'n!', title: '팩토리얼', template: '!', cursorOffset: 1 },
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
    ],
  },
  {
    name: '기호',
    icon: '≤',
    items: [
      { label: '≤', title: '이하', template: '\\leq ', cursorOffset: 5 },
      { label: '≥', title: '이상', template: '\\geq ', cursorOffset: 5 },
      { label: '≠', title: '같지 않음', template: '\\neq ', cursorOffset: 5 },
      { label: '∞', title: '무한대', template: '\\infty ', cursorOffset: 7 },
      { label: '→', title: '화살표', template: '\\to ', cursorOffset: 4 },
      { label: '⇒', title: '이중화살표', template: '\\Rightarrow ', cursorOffset: 12 },
      { label: '⇔', title: '동치', template: '\\Leftrightarrow ', cursorOffset: 16 },
      { label: '±', title: '플마', template: '\\pm ', cursorOffset: 4 },
      { label: '×', title: '곱하기', template: '\\times ', cursorOffset: 7 },
      { label: '·', title: '가운뎃점', template: '\\cdot ', cursorOffset: 6 },
      { label: '⋯', title: '세 점', template: '\\cdots ', cursorOffset: 7 },
      { label: '∈', title: '원소', template: '\\in ', cursorOffset: 4 },
      { label: '⊂', title: '부분집합', template: '\\subset ', cursorOffset: 8 },
      { label: '∩', title: '교집합', template: '\\cap ', cursorOffset: 5 },
      { label: '∪', title: '합집합', template: '\\cup ', cursorOffset: 5 },
      { label: '∅', title: '공집합', template: '\\emptyset ', cursorOffset: 10 },
      { label: '∴', title: '따라서', template: '\\therefore ', cursorOffset: 11 },
      { label: '∵', title: '왜냐하면', template: '\\because ', cursorOffset: 9 },
      { label: '⊥', title: '수직', template: '\\perp ', cursorOffset: 6 },
      { label: '∠', title: '각도', template: '\\angle ', cursorOffset: 7 },
    ],
  },
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

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        title={category.name}
        style={{
          padding: '4px 8px',
          fontSize: '13px',
          fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', monospace",
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
            minWidth: 160,
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

          {category.items.map((item, idx) => (
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
                fontFamily: "'JetBrains Mono', 'Menlo', 'Monaco', 'Apple SD Gothic Neo', 'Malgun Gothic', '맑은 고딕', monospace",
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
              <span style={{ minWidth: 32, fontSize: 14, textAlign: 'center' }}>
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
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ 메인 툴바 ═══
export default function MathToolbar({ onInsert }: MathToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'nowrap',
        gap: '4px',
        alignItems: 'center',
      }}
    >
      {CATEGORIES.map((cat) => (
        <DropdownCategory key={cat.name} category={cat} onInsert={onInsert} />
      ))}
    </div>
  );
}
