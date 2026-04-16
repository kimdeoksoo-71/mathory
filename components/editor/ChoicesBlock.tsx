'use client';

import EditorPreview from './EditorPreview';

const LABELS = ['①', '②', '③', '④', '⑤'];

interface ChoicesBlockProps {
  rawText: string;
  locale?: string;
}

export default function ChoicesBlock({ rawText, locale = 'ko' }: ChoicesBlockProps) {
  const lines = rawText.split('\n').filter((l) => l.trim());
  const choices = lines.slice(0, 5).map((line, i) => ({
    label: LABELS[i] || '',
    content: line.replace(/^[①②③④⑤]\s*/, '').trim(),
  }));

  return (
    <div className="choices-grid" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${choices.length}, 1fr)`,
      marginTop: '1em',
    }}>
      {choices.map(({ label, content }, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '1em' }}>
          <span style={{ flexShrink: 0 }}>{label}</span>
          <div style={{ flex: 1 }}>
            <EditorPreview content={content} borderless locale={locale} />
          </div>
        </div>
      ))}
    </div>
  );
}
