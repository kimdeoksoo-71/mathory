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
  onAutoFixIssue?: (issueIndex: number) => void;
  onRetry: () => void;
}

const KIND_LABEL: Record<string, { text: string; color: string }> = {
  // M6 색 정리 — 종류별 칩 색을 팔레트 안 톤 사다리로(옛 주황·보라·파랑·청록 폐기). 종류 이름이 칩에 적혀 있어 색은 보조다.
  spelling: { text: '맞춤법', color: 'var(--accent-danger, #C0392B)' },
  spacing: { text: '띄어쓰기', color: 'var(--mathory-red, #D97757)' },
  'josa-space': { text: '수식·조사 공백', color: 'var(--mathory-red-dark, #BC5F3F)' },
  'latex-brace': { text: '첨자 중괄호', color: 'var(--accent-primary, #c96442)' },
  'latex-comma': { text: '수식 쉼표', color: 'var(--accent-success, #5f6b3c)' },
  other: { text: '기타', color: 'var(--text-secondary, #5D5647)' },
};

const AUTO_FIX_KINDS = new Set(['josa-space', 'latex-brace', 'latex-comma']);

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProofreadResultBox({ data, onDismiss, onDismissIssue, onAutoFixIssue, onRetry }: Props) {
  if (data.status === 'loading') {
    return (
      <div className="proofread-box" style={{
        margin: '4px 16px 10px', padding: '8px 12px',
        background: 'var(--bg-secondary)',
        border: '1px dashed var(--border-light)',
        borderRadius: 8, fontSize: 12, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-ui)',
      }}>
        <IconLoader size={14} /> 검토 중…
      </div>
    );
  }

  if (data.status === 'failed') {
    return (
      <div className="proofread-box" style={{
        margin: '4px 16px 10px', padding: '8px 12px',
        background: 'var(--accent-danger-bg, #FEF2F2)', border: '1px solid var(--accent-danger, #C0392B)',
        borderRadius: 8, fontSize: 12, color: 'var(--accent-danger, #C0392B)',
        display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-ui)',
      }}>
        <span style={{ flex: 1 }}>검토 실패{data.error ? ` — ${data.error}` : ''}</span>
        <button onClick={onRetry} style={boxBtnStyle('var(--accent-danger, #C0392B)')}>재시도</button>
        <button onClick={onDismiss} title="닫기" style={boxIconBtnStyle}><IconTrash size={11} /></button>
      </div>
    );
  }

  // status === 'ok'
  if (data.issues.length === 0) return null;

  return (
    <div className="proofread-box" style={{
      margin: '4px 16px 10px', padding: '8px 12px',
      background: 'var(--accent-soft, #f5e6df)', border: '1px solid var(--border-content-active, #B89B78)',
      borderRadius: 8, fontSize: 12.5, color: 'var(--text-primary, #2D2A23)',
      fontFamily: 'var(--font-ui)',
      position: 'relative',
    }}>
      <button
        onClick={onDismiss}
        title="이 블록 결과 닫기"
        style={{
          position: 'absolute', top: 6, right: 6,
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--mathory-red-dark, #BC5F3F)', padding: 4, display: 'flex',
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
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted, #9C9585)' }}>{issue.original}</span>
                  <span style={{ margin: '0 6px', color: 'var(--text-muted, #9C9585)' }}>→</span>
                  <span style={{ color: 'var(--accent-success, #5f6b3c)', fontWeight: 600 }}>{issue.suggestion}</span>
                </span>
                {onAutoFixIssue && AUTO_FIX_KINDS.has(issue.kind) && (
                  <button
                    onClick={() => onAutoFixIssue(i)}
                    title="자동 정정"
                    style={{
                      border: '1px solid var(--accent-success, #5f6b3c)', background: 'var(--accent-success-bg, #EDEFE3)', cursor: 'pointer',
                      color: 'var(--accent-success, #5f6b3c)', padding: '1px 8px', fontSize: 11, lineHeight: 1.4,
                      borderRadius: 4, fontWeight: 600, flexShrink: 0,
                      fontFamily: 'var(--font-ui)',
                    }}
                  >정정</button>
                )}
                {onDismissIssue && (
                  <button
                    onClick={() => onDismissIssue(i)}
                    title="이 항목 무시"
                    style={{
                      border: 'none', background: 'none', cursor: 'pointer',
                      color: 'var(--mathory-red-dark, #BC5F3F)', padding: '0 4px', fontSize: 12, lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >✕</button>
                )}
              </div>
              {issue.reason && (
                <div style={{ fontSize: 11.5, color: 'var(--text-secondary, #5D5647)', marginLeft: 4 }}>{issue.reason}</div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{
        marginTop: 8, paddingTop: 6, borderTop: '1px dashed var(--border-content-active, #B89B78)',
        fontSize: 10.5, color: 'var(--mathory-red-dark, #BC5F3F)',
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
  color: 'var(--accent-danger, #C0392B)', padding: 4, display: 'flex', borderRadius: 4,
};
