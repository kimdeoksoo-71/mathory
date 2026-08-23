'use client';

/**
 * Phase 61b — 검증 리포트 카드
 *
 * 저장 형태는 Phase 42의 `mathory-graph` 선례를 그대로 따른다:
 *   메시지 `content` = 사람이 읽는 markdown 요약 + ` ```mathory-verify ` 펜스의 JSON.
 * 요약은 카드를 못 그리는 곳(공개 뷰어·히스토리)에서도 읽히는 폴백이다.
 *
 * ⚠️ `<details>`를 쓰지 말 것 — `stripForHistory`가 `<details>…</details>`를
 *    "[검산 코드 첨부됨]"으로 치환한다(CommentPanel.tsx). 접기는 카드 자체 상태로 한다.
 * ⚠️ `derivedAnswer`·`quote`를 markdown 요약에 넣지 말 것 — 요약은 폴백 경로라
 *    카드를 거치지 않고 그대로 보인다.
 */

import { memo, useMemo, useRef, useState } from 'react';
import type { VerifyReport, VerifyFinding, VerifyVerdict } from '../../types/problem';
import { AIBrandIcon, providerFromModelName } from './AIBrandIcon';
import { renderInlineMathHtml } from '../../lib/katex-render';

export const VERIFY_FENCE_RE = /```mathory-verify\s*([\s\S]*?)```/;

const KIND_LABEL: Record<string, string> = { problem: '문제 검증', solution: '풀이 검증' };

const VERDICT_META: Record<VerifyVerdict, { icon: string; label: string; color: string }> = {
  ok:    { icon: '✓', label: '이상 없음',   color: 'var(--accent-success)' },
  check: { icon: '⚠', label: '확인 필요',   color: 'var(--mathory-red-dark)' },
  fail:  { icon: '✕', label: '결함 확인',   color: 'var(--accent-danger)' },
  skip:  { icon: '−', label: '검증 안 함',  color: 'var(--text-muted)' },
};

/* ⚠️ MathText에 넘기는 style은 **모듈 상수**여야 한다 — 인라인 객체 리터럴은 매 렌더
   새 identity라 memo가 뚫리고, 그러면 innerHTML이 다시 쓰여 선택이 죽는다(위 MathText 주석) */
const DERIVED_ANSWER_STYLE: React.CSSProperties = {
  fontSize: 11.5, background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3,
};
const REASON_STYLE: React.CSSProperties = { display: 'block', marginTop: 3, lineHeight: 1.5 };

const ANSWER_CHECK_LABEL: Record<string, string> = {
  match: '등록 정답과 일치',
  mismatch: '등록 정답과 불일치',
  no_answer: '등록된 정답 없음',
};

/* ═══════════════════════════════════════════════════════ */
/* 직렬화 · 역직렬화                                         */
/* ═══════════════════════════════════════════════════════ */

/** 메시지 `content` 조립. 요약(폴백용) + JSON 펜스 */
export function buildReportMarkdown(report: VerifyReport): string {
  const m = VERDICT_META[report.verdict] ?? VERDICT_META.check;
  const n = report.findings.length;
  const head = `**${KIND_LABEL[report.kind] ?? '검증'}** — ${m.icon} ${m.label}`
    + (n > 0 ? ` · 지적 ${n}건` : '')
    + (report.note ? ` · ${report.note}` : '');
  return `${head}\n\n\`\`\`mathory-verify\n${JSON.stringify(report)}\n\`\`\``;
}

/** 메시지에서 리포트를 꺼내고, 펜스를 뺀 본문을 함께 돌려준다 */
export function extractVerifyReport(content: string): { report: VerifyReport; body: string } | null {
  const m = content.match(VERIFY_FENCE_RE);
  if (!m) return null;
  try {
    const report = JSON.parse(m[1].trim()) as VerifyReport;
    if (!report || typeof report !== 'object' || !Array.isArray(report.findings)) return null;
    return { report, body: content.replace(VERIFY_FENCE_RE, '').trim() };
  } catch {
    return null;   // 손상된 펜스는 카드 없이 원문만 보이게 둔다
  }
}

/* ═══════════════════════════════════════════════════════ */
/* 카드                                                     */
/* ═══════════════════════════════════════════════════════ */

export default function VerifyReportCard({
  report, onJumpToBlock,
}: {
  report: VerifyReport;
  /** 지적 → 그 인용이 있는 자리로 이동 */
  onJumpToBlock?: (blockKey: string, quote: string) => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(false);
  const meta = VERDICT_META[report.verdict] ?? VERDICT_META.check;

  return (
    <div style={{
      border: '1px solid var(--border-light)',
      borderLeft: `3px solid ${meta.color}`,
      borderRadius: 6,
      background: 'var(--bg-card)',
      padding: '10px 12px',
      marginTop: 8,
      fontSize: 12.5,
      color: 'var(--text-primary)',
    }}>
      {/* 종합 판정 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: report.findings.length ? 8 : 0 }}>
        <span style={{ color: meta.color, fontWeight: 700 }}>{meta.icon}</span>
        <span style={{ fontWeight: 600 }}>{KIND_LABEL[report.kind] ?? '검증'}</span>
        <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
        {report.findings.length > 0 && (
          <span style={{ color: 'var(--text-muted)' }}>· 지적 {report.findings.length}건</span>
        )}
        {report.note && <span style={{ color: 'var(--text-muted)' }}>· {report.note}</span>}
      </div>

      {/* 지적 목록 */}
      {report.findings.map((f, i) => (
        <FindingRow key={i} finding={f} index={i + 1} onJumpToBlock={onJumpToBlock} />
      ))}

      {/* 정답 대조 */}
      {report.answerCheck && (
        <div style={{
          marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
          fontSize: 11.5, color: 'var(--text-secondary)',
        }}>
          <span>{ANSWER_CHECK_LABEL[report.answerCheck] ?? report.answerCheck}</span>
          {report.derivedAnswer && (
            <button
              onClick={() => setAnswerOpen((v) => !v)}
              style={{
                border: '1px solid var(--border-primary)', background: 'transparent',
                borderRadius: 4, padding: '1px 6px', fontSize: 11, cursor: 'pointer',
                color: 'var(--text-muted)', fontFamily: 'var(--font-ui)',
              }}
            >
              {answerOpen ? 'AI 도출답 숨기기' : 'AI 도출답 보기'}
            </button>
          )}
          {answerOpen && report.derivedAnswer && (
            <MathText
              text={report.derivedAnswer}
              autoMath
              style={DERIVED_ANSWER_STYLE}
            />
          )}
        </div>
      )}

      {/* 모델 각주 — 아이콘은 토론 참여자(민·쳇·클)와 같은 브랜드 아이콘을 쓴다.
           검증 모델은 env 고정이라 ai_models 문서가 없으므로 모델명에서 provider를 유추한다. */}
      <div style={{
        marginTop: 6, display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
        fontSize: 10.5, color: 'var(--text-faint)',
      }}>
        <ModelChip name={report.models.first} />
        {report.models.judge ? (
          <>
            <span>→</span>
            <ModelChip name={report.models.judge} />
          </>
        ) : (
          <span>(후보 없음 — 판정 생략)</span>
        )}
      </div>
    </div>
  );
}

/** 인용·이유에 섞인 `$...$`를 KaTeX로. 프롬프트가 수식을 `$...$`로 쓰게 하므로
 *  평문으로 두면 카드 안이 전부 LaTeX 소스로 보인다.
 *
 *  ⚠️ **반드시 memo + useMemo로 감쌀 것 (Phase 61c)**: `dangerouslySetInnerHTML`에 매 렌더
 *     새 객체를 주면 React가 그 span의 innerHTML을 **다시 쓴다** → 안의 텍스트 노드가 통째로
 *     교체돼 **거기 걸린 사용자 선택이 즉시 죽는다**. 카드 안에서 인용을 드래그하는 것이
 *     아예 불가능했던 원인이 이것이다(실측: 드래그 한 번에 innerHTML 재기록 12건).
 *     같은 이유로 `style` prop은 **모듈 상수**여야 한다 — 인라인 리터럴은 매번 새 객체라
 *     memo를 무력화한다. */
const MathText = memo(function MathText({
  text, style, className, autoMath,
}: {
  text: string;
  style?: React.CSSProperties;
  className?: string;
  /** `$` 없이 온 순수 LaTeX도 수식으로 본다. 인용·도출답에만 켠다(산문은 금지) */
  autoMath?: boolean;
}) {
  const html = useMemo(() => renderInlineMathHtml(text, { autoMath }), [text, autoMath]);
  return (
    <span
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});

function ModelChip({ name }: { name: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      <AIBrandIcon provider={providerFromModelName(name)} size={12} fallbackEmoji="🔍" />
      <span>{name}</span>
    </span>
  );
}

function FindingRow({
  finding, index, onJumpToBlock,
}: {
  finding: VerifyFinding;
  index: number;
  onJumpToBlock?: (blockKey: string, quote: string) => void;
}) {
  const isFail = finding.verdict === 'fail';
  const canJump = !!onJumpToBlock && !!finding.blockKey;
  /* ⚠️ hover를 state로 들지 않는다 (Phase 61c) — mouseenter/leave가 카드 안에서 리렌더를
     일으키고, 그 리렌더가 MathText의 innerHTML을 다시 써서 드래그 선택을 죽였다.
     배경 강조는 `.verify-finding-row:hover`(globals.css)가 CSS로 처리한다. */
  const downAt = useRef<{ x: number; y: number } | null>(null);

  /* 클릭이 안 되는 이유를 알려 준다 — 이유 없이 반응만 없으면 고장으로 보인다 */
  const why = canJump
    ? '클릭하면 그 인용 자리로 이동합니다'
    : !finding.quote
      ? '이 지적은 특정 위치를 가리키지 않습니다'
      : '인용을 원문에서 찾지 못해 이동할 수 없습니다';

  return (
    <div
      className={canJump ? 'verify-finding-row' : undefined}
      onMouseDown={canJump ? (e) => { downAt.current = { x: e.clientX, y: e.clientY }; } : undefined}
      onClick={canJump ? (e) => {
        /* Phase 61c: 카드 안에서 인용을 드래그로 뽑는 중이면 점프하지 않는다.
           행 전체가 클릭 영역이라 mouseup이 곧 점프였고, 탭 전환·ref.focus()가
           대화창 선택을 통째로 날렸다 — 인용을 뽑는 것 자체가 막혔다.
           ① 포인터가 움직였으면 드래그다 ② 선택이 살아 있으면 드래그다.
           ①이 필요한 이유: 선택이 어떤 이유로든 이미 죽은 뒤에는 ②가 통과해 버린다. */
        const d = downAt.current;
        downAt.current = null;
        if (d && (Math.abs(e.clientX - d.x) > 4 || Math.abs(e.clientY - d.y) > 4)) return;
        const sel = typeof window !== 'undefined' ? window.getSelection() : null;
        if (sel && !sel.isCollapsed && sel.toString().trim()) return;
        onJumpToBlock!(finding.blockKey!, finding.quote);
      } : undefined}
      title={why}
      style={{
        padding: '6px 4px',
        margin: '0 -4px',
        borderRadius: 4,
        borderTop: index === 1 ? 'none' : '1px solid var(--border-light)',
        cursor: canJump ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{index}.</span>
        <span style={{
          fontSize: 10.5, fontWeight: 600, padding: '1px 6px', borderRadius: 3,
          background: isFail ? 'var(--accent-danger-bg)' : 'var(--bg-secondary)',
          color: isFail ? 'var(--accent-danger)' : 'var(--text-secondary)',
        }}>
          {finding.tag}
        </span>
        {!isFail && (
          <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>확인 필요</span>
        )}
        {!finding.quoteFound && !!finding.quote && (
          <span
            title="인용이 원문에서 확인되지 않았습니다 — 위치가 부정확할 수 있습니다"
            style={{ fontSize: 10.5, color: 'var(--text-faint)' }}
          >
            원문 미확인
          </span>
        )}
      </div>

      {finding.quote && (
        <div style={{
          marginTop: 3, paddingLeft: 8,
          borderLeft: '2px solid var(--border-primary)',
          fontSize: 11.5, color: 'var(--text-secondary)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          <MathText text={finding.quote} autoMath />
        </div>
      )}

      <MathText text={finding.reason} style={REASON_STYLE} />

      {finding.suggestion && (
        <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--accent-success)' }}>
          제안: <MathText text={finding.suggestion} />
        </div>
      )}
    </div>
  );
}
