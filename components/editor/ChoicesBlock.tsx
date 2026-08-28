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
        // 개선묶음 M2 B — 라벨 세로 정렬은 center다(baseline 금지).
        //   그리드 아이템은 기본 align-items:stretch라 5개 셀의 높이가 이미 같다 →
        //   center는 5개 라벨을 정확히 같은 y에 놓는다(실측 편차 0.00px @11·15·24px).
        //   baseline은 큰 수식(.base:has(.mfrac,.sqrt,.op-symbol.large-op)의 상하 0.4em
        //   padding)이 든 셀에서 첫 라인박스 베이스라인이 내려가 셀마다 어긋난다
        //   (실측 편차 9.33 / 12.81 / 20.91px). 인쇄 사본(.print-choice-item)도 같은 값.
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
          {/* 원문자 라벨: 유니코드 글리프 그대로. 크기는 --font-circled(P5)가 담당 */}
          <span style={{ flexShrink: 0, lineHeight: 1 }}>{label}</span>
          <div style={{ flex: 1 }}>
            <EditorPreview content={content} borderless locale={locale} />
          </div>
        </div>
      ))}
    </div>
  );
}
