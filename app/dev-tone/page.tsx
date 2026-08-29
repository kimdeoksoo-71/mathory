'use client';
/* 임시 계측 — 요약 톤 배경이 경우 rail·dot을 덮는가. 검수 후 삭제. */
import EditorPreview from '../../components/editor/EditorPreview';
import { injectCaseLabel } from '../../lib/caseBlock';

const CARD: React.CSSProperties = {
  width: 601, boxSizing: 'border-box',
  background: 'var(--bg-content)', border: '0.5px solid var(--border-content)',
  borderRadius: 6, padding: '20px 36px 20px 40px', marginBottom: 20,
};

function Case({ label, body }: { label: string; body: string }) {
  return (
    <div className="case-block case-numbered">
      <EditorPreview content={injectCaseLabel(`${label}\n\n${body}`, label.slice(0, 3))} borderless locale="ko" />
    </div>
  );
}

export default function Dev() {
  return (
    <div style={{ padding: 30, background: 'var(--bg-functional)', minHeight: '100vh' }}>
      <div className="problem-content-scaled problem-content-toned tone-baseline"
        style={{ ['--content-font-size' as never]: '15px', fontSize: 15 }}>

        <div style={{ fontSize: 12, marginBottom: 6 }}>A · 톤 배경 없음(현행)</div>
        <div style={CARD} id="cardA">
          <Case label="a &gt; 1 인 경우" body="본문 한 줄." />
          <Case label="a ≤ 1 인 경우" body="본문 한 줄." />
        </div>

        <div style={{ fontSize: 12, marginBottom: 6 }}>B · 조상에 톤 배경 + 카드 전폭 음수 마진</div>
        <div style={CARD} id="cardB">
          <div id="toneB" style={{
            background: 'var(--block-bg)',
            marginLeft: -40, marginRight: -36, paddingLeft: 40, paddingRight: 36,
          }}>
            <Case label="a &gt; 1 인 경우" body="본문 한 줄." />
            <Case label="a ≤ 1 인 경우" body="본문 한 줄." />
          </div>
        </div>

        <div style={{ fontSize: 12, marginBottom: 6 }}>C · B + --case-dot-fill 재정의</div>
        <div style={CARD} id="cardC">
          <div id="toneC" style={{
            background: 'var(--block-bg)',
            ['--case-dot-fill' as never]: 'var(--block-bg)',
            marginLeft: -40, marginRight: -36, paddingLeft: 40, paddingRight: 36,
          }}>
            <Case label="a &gt; 1 인 경우" body="본문 한 줄." />
            <Case label="a ≤ 1 인 경우" body="본문 한 줄." />
          </div>
        </div>
      </div>
    </div>
  );
}
