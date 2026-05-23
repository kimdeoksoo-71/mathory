'use client';

import { LatexInputEditorHandle } from './LatexInputEditor';

/* 댓글 입력용 간소 수식 툴바
 * 클릭 시 LatexInputEditor의 커서 위치에 LaTeX 토큰 삽입.
 * 토큰에 `|` 마커가 있으면 그 위치로 커서 이동.
 */

interface MiniMathToolbarProps {
  editorRef: React.RefObject<LatexInputEditorHandle>;
}

interface MathButton {
  label: string;
  insert: string;   // '|' 위치에 커서가 옴
  title: string;
}

const BUTTONS: MathButton[] = [
  { label: '$x$', insert: '$|$', title: '인라인 수식' },
  { label: 'a/b', insert: '$\\frac{|}{}$', title: '분수' },
  { label: 'a²', insert: '$|^{}$', title: '제곱' },
  { label: 'aₙ', insert: '$|_{}$', title: '아래첨자' },
  { label: '√', insert: '$\\sqrt{|}$', title: '루트' },
  { label: '∫', insert: '$\\int_{|}^{}$', title: '적분' },
  { label: '∑', insert: '$\\sum_{|}^{}$', title: '시그마' },
];

export default function MiniMathToolbar({ editorRef }: MiniMathToolbarProps) {
  const handleClick = (btn: MathButton) => {
    const ed = editorRef.current;
    if (!ed) return;
    let text = btn.insert;
    const cursorMark = text.indexOf('|');
    if (cursorMark >= 0) text = text.replace('|', '');
    ed.insertAtCursor(text, cursorMark >= 0 ? cursorMark : undefined);
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 4,
      padding: '4px 0', fontFamily: 'var(--font-ui)',
    }}>
      {BUTTONS.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={() => handleClick(b)}
          title={b.title}
          style={{
            minWidth: 28, height: 24, padding: '0 6px',
            border: '1px solid var(--border-light, #ddd)',
            borderRadius: 4, background: 'var(--bg-card, #fff)',
            cursor: 'pointer', fontSize: 11,
            color: 'var(--text-secondary)',
            fontFamily: "var(--font-content, 'Noto Serif KR', serif)",
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--bg-card, #fff)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}
