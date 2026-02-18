'use client';

interface MathToolbarProps {
  onInsert: (template: string, cursorOffset: number) => void;
}

const MATH_BUTTONS = [
  { label: 'f', title: '분수', template: '\\frac{}{}', cursorOffset: 6 },
  { label: '√', title: '제곱근', template: '\\sqrt{}', cursorOffset: 6 },
  { label: 'x²', title: '거듭제곱', template: '^{}', cursorOffset: 2 },
  { label: 'x₂', title: '아래첨자', template: '_{}', cursorOffset: 2 },
  { label: '∫', title: '정적분', template: '\\int_{}^{} \\, dx', cursorOffset: 6 },
  { label: 'Σ', title: '합', template: '\\sum_{}^{} ', cursorOffset: 6 },
  { label: 'lim', title: '극한', template: '\\lim_{\\to } ', cursorOffset: 6 },
  { label: '()', title: '괄호', template: '\\left( \\right)', cursorOffset: 7 },
  { label: '||', title: '절댓값', template: '\\left| \\right|', cursorOffset: 7 },
  { label: '≤', title: '이하', template: '\\leq ', cursorOffset: 5 },
  { label: '≥', title: '이상', template: '\\geq ', cursorOffset: 5 },
  { label: '≠', title: '같지 않음', template: '\\neq ', cursorOffset: 5 },
  { label: '∞', title: '무한대', template: '\\infty ', cursorOffset: 7 },
  { label: '→', title: '화살표', template: '\\to ', cursorOffset: 4 },
  { label: '$', title: '인라인 수식', template: '$$', cursorOffset: 1 },
  { label: '$$', title: '블록 수식', template: '$$\n\n$$', cursorOffset: 3 },
];

export default function MathToolbar({ onInsert }: MathToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '4px',
        padding: '8px',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px 8px 0 0',
        border: '1px solid #ddd',
        borderBottom: 'none',
      }}
    >
      {MATH_BUTTONS.map((btn) => (
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
    </div>
  );
}