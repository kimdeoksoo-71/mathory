'use client';

/**
 * Phase 27 — 교정 결과 박스
 * 블록 카드 아래(테두리 바깥)에 렌더링.
 * 사용자가 본문을 수정해도 자동 갱신되지 않는 단순 기록.
 */

import { ProofreadIssue } from '../../lib/proofread';
import { IconLoader, IconTrash } from '../ui/Icons';

export interface ProofreadBoxData {
  status: 'ok' | 'failed' | 'loading';
  issues: ProofreadIssue[];
  timestamp: number;
  error?: string;
}

interface Props {
  data: ProofreadBoxData;
  onDismiss: () => void;
  onDismissIssue?: (issueIndex: number) => void;
  onRetry: () => void;
}

const KIND_LABEL: Record<string, { text: string; color: string }> = {
  spelling: { text: '맞춤법', color: '#c0392b' },
  spacing: { text: '띄어쓰기', color: '#d68910' },
  'josa-space': { text: '수식·조사 공백', color: '#7d3c98' },
  other: { text: '기타', color: '#566573' },
};

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProofreadResultBox({ data, onDismiss, onDismissIssue, onRetry }: Props) {
  if (data.status === 'loading') {
    return (
      <div className="proofread-box" style={{
        margin: '4px 0 10px', padding: '8px 12px',
        background: 'var(--bg-secondary)',
        border: '1px dashed var(--border-light)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)',
      }}>
        <IconLoader size={12} /> 검토 중…
      </div>
    );
  }

  if (data.status === 'failed') {
    return (
      <div className="proofread-box" style={{
        margin: '4px 0 10px', padding: '8px 12px',
        background: '#fdecea', border: '1px solid #f5c6cb',
        borderRadius: 8, fontSize: 12, color: '#721c24',
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)',
      }}>
        <span style={{ flex: 1 }}>검토 실패{data.error ? ` — ${data.error}` : ''}</span>
        <button onClick={onRetry} style={boxBtnStyle('#721c24')}>재시도</button>
        <button onClick={onDismiss} title="닫기" style={boxIconBtnStyle}><IconTrash size={11} /></button>
      </div>
    );
  }

  // status === 'ok'
  if (data.issues.length === 0) return null;

  return (
    <div className="proofread-box" style={{
      margin: '4px 0 10px', padding: '8px 12px',
      background: '#fffbeb', border: '1px solid #fde68a',
      borderRadius: 8, fontSize: 12.5, color: '#5b4708',
      fontFamily: 'var(--font-ui)',
      position: 'relative',
    }}>
      <button
        onClick={onDismiss}
        title="이 블록 결과 닫기"
        style={{
          position: 'absolute', top: 6, right: 6,
          border: 'none', background: 'none', cursor: 'pointer',
          color: '#a07a00', padding: 4, display: 'flex',
          borderRadius: 4,
        }}
      >
        ✕
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 24 }}>
        {data.issues.map((issue, i) => {
          const label = KIND_LABEL[issue.kind] ?? KIND_LABEL.other;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2, lineHeight: 1.45 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                <span style={{
                  fontSize: 10.5, color: '#fff', background: label.color,
                  padding: '1px 6px', borderRadius: 3, flexShrink: 0,
                }}>{label.text}</span>
                <span style={{ fontFamily: 'var(--font-mono, monospace)', flex: 1 }}>
                  <span style={{ textDecoration: 'line-through', color: '#999' }}>{issue.original}</span>
                  <span style={{ margin: '0 6px', color: '#999' }}>→</span>
                  <span style={{ color: '#1e7a3a', fontWeight: 600 }}>{issue.suggestion}</span>
                </span>
                {onDismissIssue && (
                  <button
                    onClick={() => onDismissIssue(i)}
                    title="이 항목 무시"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: '#a07a00', padding: '0 4px', fontSize: 12, lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >✕</button>
                )}
              </div>
              {issue.reason && (
                <div style={{ fontSize: 11.5, color: '#7a6300', marginLeft: 4 }}>{issue.reason}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 8, paddingTop: 6, borderTop: '1px dashed #fde68a',
        fontSize: 10.5, color: '#a07a00',
      }}>
        검토 시각: {fmtTime(data.timestamp)}
      </div>
    </div>
  );
}

function boxBtnStyle(color: string): React.CSSProperties {
  return {
    border: `1px solid ${color}`, background: 'transparent', color,
    padding: '2px 8px', fontSize: 11, borderRadius: 4, cursor: 'pointer',
    fontFamily: 'var(--font-ui)',
  };
}
const boxIconBtnStyle: React.CSSProperties = {
  border: 'none', background: 'none', cursor: 'pointer',
  color: '#721c24', padding: 4, display: 'flex', borderRadius: 4,
};
