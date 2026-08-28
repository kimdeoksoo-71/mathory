'use client';

import { useMemo } from 'react';
import { Block, TabMeta } from '../../types/problem';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import { isToneScoped, toneClass } from '../../lib/keyTone';
import { blockKeyOf, buildCaseGapKeys, buildCaseLabels, caseClassName, caseGapClassName, injectCaseLabel, isCaseBlock } from '../../lib/caseBlock';
import { useOutlineState } from '../../hooks/useOutlineState';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import SvgViewer from '../viewer/SvgViewer';
import GgbViewer from '../viewer/GgbViewer';
import OutlineSections from './OutlineSections';
import OutlineToggle from '../ui/OutlineToggle';
import CoachBlock from '../ui/CoachBlock';
import { isCoachBlock } from '../../lib/coachBlock';
import { IconCheck, IconCopy } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 59 — ProblemView의 탭 한 행 ([탭 라벨 | 탭 본문]).

   ProblemView에서 분리한 이유: 요약 보기 상태를 **탭마다** 따로 들어야 하는데
   ProblemView는 이미 1,000행이 넘고 인라인 style·IIFE가 촘촘하다. 상태를 탭
   컴포넌트가 들면 Record<tabId, state> 같은 배선이 통째로 사라진다.

   블록 렌더 분기는 공개 뷰어(ProblemTabContent)와 통합하지 않는다 (D16) —
   공개 뷰어에는 svg·ggb 분기가 없어서, 합치면 공개 페이지 동작이 바뀐다.
   ═══════════════════════════════════════════════════════════════ */

const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);
/* 라벨 열 ↔ 본문 사이 간격. Phase 59a: 경우 rail이 이 틈으로 나오므로 px 고정을 버리고
   글꼴에 비례시킨다 — 라벨 열 폭이 이미 `7 * contentFontSize`라 정합적이다.
   2.8em = dot 좌단 2.06em + 라벨과의 여유 0.74em.
   ⚠ 고정 px으로 되돌리지 말 것: 28px은 24px 글꼴에서 1.17em이라 dot이 라벨을 파고들고,
     11px에서는 2.55em이라 rail이 본문에서 멀어진다(em/px 혼합 함정). */
const LABEL_GAP_EM = 2.8;

interface Props {
  tab: TabMeta;
  blocks: Block[];
  tabIdx: number;
  isOpen: boolean;
  copied: boolean;
  contentFontSize: number;
  onToggleTab: () => void;
  onCopy: () => void;
}

export default function TabBody({
  tab, blocks, tabIdx, isOpen, copied, contentFontSize, onToggleTab, onCopy,
}: Props) {
  const caseLabels = useMemo(() => buildCaseLabels(blocks), [blocks]);
  const caseGaps = useMemo(() => buildCaseGapKeys(blocks), [blocks]);
  // 앱 열람뷰는 요약 보기로 연다 — 뼈대를 먼저 보고 필요한 곳만 펼치는 것이 기본 동선이다.
  // (공개 뷰어는 'full' 기본 — 방문자는 곧장 읽는 것이 자연스럽다)
  const outline = useOutlineState(blocks, 'outline');
  const scoped = isToneScoped(tab.id);
  const isQuestion = tab.id === 'question';

  const labelColStyle: React.CSSProperties = {
    width: 7 * contentFontSize, flexShrink: 0,
    textAlign: 'left', fontFamily: 'var(--font-ui)',
  };
  const mainColStyle: React.CSSProperties = {
    width: 35 * contentFontSize, flexShrink: 0,
  };

  /* 경우 사이에 낀 블록은 rail이 관통하도록 .case-gap 한 겹을 두른다.
     ⚠ 감싸도 형제 관계는 유지된다(래퍼가 그 자리의 형제가 된다) — rail 연결은
       인접 셀렉터로 이뤄지므로 이 성질이 필수다. 마진은 래퍼를 통과해 collapse되어
       간격도 변하지 않는다. */
  const renderBlock = (block: Block, i: number) => {
    const node = renderBlockInner(block, i);
    if (!caseGaps.has(blockKeyOf(block))) return node;
    return <div key={block.id} className={caseGapClassName(block.type)}>{node}</div>;
  };

  /* ─── 블록 렌더 (EditorView 미리보기와 동일 규칙) ─── */
  const renderBlockInner = (block: Block, i: number) => {
    const isBordered = BORDERED_TYPES.has(block.type);
    const headingTopPad = block.type === 'heading' && i !== 0 ? '0.5em' : undefined;   // Phase 58 D2
    if (block.type === 'image') {
      const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
      return (
        <div key={block.id} style={{ textAlign: 'center', margin: '1.2em 0' }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" style={{
              width: block.imageWidth || 400, maxWidth: '90%', height: 'auto',
              ...imageTreatmentStyle(block),
            }} />
          ) : (
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>(이미지 없음)</span>
          )}
        </div>
      );
    }
    if (block.type === 'svg') {
      return (
        <div key={block.id} style={{ margin: '0.8em 0' }}>
          {block.raw_text ? (
            <SvgViewer
              url={block.raw_text}
              initialView={block.svg_initial_view}
              height={block.svg_height || 300}
              enableFullscreen
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(SVG 없음)</div>
          )}
        </div>
      );
    }
    if (block.type === 'ggb') {
      return (
        <div key={block.id} style={{ margin: '0.8em 0' }}>
          {block.raw_text ? (
            <GgbViewer
              url={block.raw_text}
              initialCoords={block.ggb_initial_coords}
              height={block.ggb_height || 350}
            />
          ) : (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>(GeoGebra 없음)</div>
          )}
        </div>
      );
    }
    if (isBordered) {
      return (
        <div key={block.id} style={{
          border: '0.7px solid var(--text-primary)',
          borderRadius: 0, padding: '12px 16px', margin: '1.2em 0',
        }}>
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
      );
    }
    if (isCaseBlock(block.type)) {
      /* Phase 59: 경우 — 라벨 주입 후 단일 인스턴스로 렌더한다(제목/본문 분할 금지) */
      const label = caseLabels.get(blockKeyOf(block)) ?? null;
      return (
        <div key={block.id} data-block-id={block.id} className={caseClassName(block.type, !!label)}>
          <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko" />
        </div>
      );
    }
    if (isCoachBlock(block.type)) {
      /* Phase 59a: 코칭 — 라벨은 raw_text가 아니라 렌더가 붙인다.
         개선묶음 M2 G: 라벨은 'Tip' 하나, 열람뷰는 기본 접힘(아이콘만) */
      return (
        <CoachBlock key={block.id} type={block.type} collapsible>
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </CoachBlock>
      );
    }
    if (block.type === 'callout') {
      /* Phase 57: 들여쓰기 블록(구 '강조문') — 테두리 없이 display 수식과 같은 좌단·상하 여백 */
      return (
        <div key={block.id} className="callout-block">
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
      );
    }
    if (block.type === 'choices') {
      return (
        <div key={block.id}>
          <ChoicesBlock rawText={block.raw_text} locale="ko" />
        </div>
      );
    }
    return (
      <div key={block.id} data-block-id={block.id} style={{ paddingTop: headingTopPad }}>
        <EditorPreview content={block.raw_text} borderless locale="ko" />
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: LABEL_GAP_EM * contentFontSize,
      marginTop: tabIdx === 0 ? 24 : 0,
      marginBottom: isOpen ? '5em' : '1.5em',
    }}>
      {/* 라벨 열 — 라벨 · 복사 · 요약 보기.
          ⚠ flexWrap 필수: 탭 이름은 3번째 탭부터 사용자가 자유롭게 짓고 길이 제한이
            없다. 폭(7em)을 넘으면 토글이 다음 행으로 내려가야 레이아웃이 버틴다. */}
      <div style={{
        ...labelColStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4,
        flexWrap: 'wrap', rowGap: 2,
        paddingTop: isOpen ? 14 : 0,
      }}>
        <span
          onClick={onToggleTab}
          style={{
            fontSize: 12, fontWeight: 600,
            color: isOpen ? 'var(--text-muted)' : 'var(--text-faint)',
            letterSpacing: 0.5,
            cursor: 'pointer', userSelect: 'none',
          }}
          title={isOpen ? '탭 접기' : '탭 펼치기'}
        >
          {tab.label}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onCopy(); }}
          title="Markdown 복사"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, border: 'none', background: 'none',
            cursor: 'pointer', borderRadius: 4, padding: 0,
            color: copied ? 'var(--accent-success)' : 'var(--text-faint)',
            transition: 'color 0.2s',
          }}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
        {/* 아이콘만 두면 복사 버튼 옆에 묻혀 아무도 찾지 못한다(덕수 실사용 확인).
            라벨 열은 flexWrap이라 글자를 붙이면 자연스럽게 라벨 아래 줄로 내려간다. */}
        {/* 항상 라벨 아래 줄에 놓는다 — flexBasis 100%가 flex 줄을 강제로 끊는다.
            (폭에 따라 붙었다 떨어졌다 하면 탭마다 위치가 달라 보인다) */}
        {isOpen && scoped && (
          <span style={{ flexBasis: '100%', display: 'flex', marginLeft: -2 }}>
            <OutlineToggle mode={outline.mode} onToggle={outline.toggleMode} disabled={!outline.available} />
          </span>
        )}
      </div>

      {isOpen && (
        <div style={{
          ...mainColStyle,
          ...(isQuestion ? {
            background: 'var(--bg-content)',
            padding: '20px 24px',
            borderRadius: 8,
            marginLeft: -24,
          } : {}),
        }}>
          {/* Phase 58 P2 — 톤 기준선 + 탭별 톤 스코프 */}
          <div
            className={`problem-content-scaled problem-content-toned tone-baseline ${toneClass(tab.id)}`}
            style={{ ['--content-font-size' as any]: `${contentFontSize}px` }}
          >
            {scoped && outline.mode === 'outline' ? (
              <OutlineSections
                sections={outline.sections}
                openSections={outline.openSections}
                openCases={outline.openCases}
                onToggleSection={outline.toggleSection}
                onToggleCase={outline.toggleCase}
                renderBlock={renderBlock}
              />
            ) : (
              blocks.map(renderBlock)
            )}
          </div>
        </div>
      )}
    </div>
  );
}
