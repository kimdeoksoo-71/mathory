'use client';

import EditorPreview from './EditorPreview';

interface ChoicesBlockProps {
  rawText: string;
  locale?: string;
}

/** 라벨이 기록된 순서 그대로 추출 (내용이 있는 것만). */
function parseChoices(rawText: string): { label: string; content: string }[] {
  const result: { label: string; content: string }[] = [];
  for (const line of rawText.split('\n')) {
    const m = line.trim().match(/^([①②③④⑤])\s*(.*)$/);
    if (!m) continue;
    const content = m[2].trim();
    if (!content) continue;
    result.push({ label: m[1], content });
    if (result.length >= 5) break;
  }
  return result;
}

export default function ChoicesBlock({ rawText, locale = 'ko' }: ChoicesBlockProps) {
  const choices = parseChoices(rawText);
  // 1~3개 → 3등분, 4~5개 → 5등분. 왼쪽부터 차례로 배치
  const cols = choices.length <= 3 ? 3 : 5;

  return (
    <div className="choices-grid" style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
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
