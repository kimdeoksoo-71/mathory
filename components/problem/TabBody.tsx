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
export const LABEL_GAP_EM = 2.8;

/* 개선묶음 M2 D — 카드 좌우 안쪽 여백. 좌 40px은 경우 rail·dot이 사는 거터(2.06em@15,
   실사용 2.2em)를 카드 **안쪽**에 확보하기 위한 값이다 — 공개 뷰어 ContentCard가 쓰는
   `32px 36px 32px 40px`의 좌우와 같다.
   ⚠ 카드에 overflow:hidden을 주지 말 것 — 거터에 그린 rail이 통째로 잘린다(Phase 59a Q5). */
export const CARD_PAD_L = 40;
export const CARD_PAD_R = 36;

/** 카드 모서리 반지름. 덕수 요청(2026-08-28)으로 12 → 6(절반)으로 낮췄다. */
export const CARD_RADIUS = 6;

/** 접힘 상태 문제 카드의 세로 두께 = 리스트 보기의 가로 막대와 같은 크기.
 *  ListView 행: padding 9px + 13.5px 텍스트 1줄 + 0.5px 테두리 ≈ 35px.
 *  ⚠ 본문 글꼴(11~24px)에 비례시키지 않는다 — 이건 본문이 아니라 **크롬**이라
 *    글꼴을 키워도 두께가 따라 커지면 "접었다"는 신호가 흐려진다. */
export const COLLAPSED_CARD_H = 35;

interface Props {
  tab: TabMeta;
  /** 본문 폭(em). 기본 35 — 사용자가 우측 상단 스테퍼로 넓힐 수 있다(M2 D24′). */
  widthEm: number;
  /** 문제 탭 접힘. 내용은 **완전히** 숨고 리스트 행 두께의 막대만 남는다(덕수 보완 2). */
  collapsedPreview?: boolean;
  /** 제목행이 슬림일 때 첫 행의 상단 여백을 줄여 카드를 더 위로 올린다(덕수 보완 1). */
  compactTop?: boolean;
  blocks: Block[];
  tabIdx: number;
  isOpen: boolean;
  copied: boolean;
  contentFontSize: number;
  onToggleTab: () => void;
  onCopy: () => void;
}

export default function TabBody({
  tab, blocks, tabIdx, isOpen, copied, contentFontSize, widthEm,
  collapsedPreview, compactTop, onToggleTab, onCopy,
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
  /* ⚠ 이 폭은 제목행의 <h1>이 쓰는 사본과 **같은 값**이어야 한다(M2 D24″) —
       제목과 카드 우단이 함께 움직이지 않으면 D40″의 좌단 정렬이 폭마다 깨진다. */
  const mainColStyle: React.CSSProperties = {
    width: widthEm * contentFontSize, flexShrink: 0,
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
    /* 개선묶음 M2 D — 탭 한 행 = [라벨 열 | 카드]. 카드 사이 세로 여백은 2em(접힘 1em).
       ⚠ align-items는 flex-start를 유지한다 — stretch면 카드가 행 높이로 늘어나
         sticky가 움직일 여지를 잃는다(v2 D-19 실측: 300px 스크롤 후 −220px로 흘러감). */
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: LABEL_GAP_EM * contentFontSize,
      marginTop: tabIdx === 0 ? (compactTop ? 6 : 24) : 0,
      marginBottom: isOpen ? '2em' : '1em',
    }}>
      {/* 라벨 열 — 라벨 · 복사 · 요약 보기.
          ⚠ flexWrap 필수: 탭 이름은 3번째 탭부터 사용자가 자유롭게 짓고 길이 제한이
            없다. 폭(7em)을 넘으면 토글이 다음 행으로 내려가야 레이아웃이 버틴다. */}
      {/* 개선묶음 M2 D51 — 라벨 열은 카드가 스크롤돼도 제자리에 남는다.
          top은 sticky 문제 카드의 접힘 높이를 담은 CSS 변수다(ProblemView가 세운다) —
          0으로 두면 문제 행(z 상위)에 상시 가려진다(v3 W7). */}
      <div style={{
        ...labelColStyle,
        display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 4,
        flexWrap: 'wrap', rowGap: 2,
        paddingTop: isOpen ? 14 : 0,
        ...(isQuestion ? null : {
          position: 'sticky' as const,
          top: 'calc(var(--m2-q-sticky-h, 0px) + 12px)',
          alignSelf: 'flex-start' as const,
        }),
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
        /* 개선묶음 M2 D20′·D21′ — 탭 본문 열이 **클레이 카드**가 된다(바탕은 아이보리).
           폴더뷰 카드와 같은 문법이되 --card-surface는 쓰지 않는다 — 그 변수는 폴더뷰
           카드·행의 hover 계약이라 여기 끌어오면 의미가 꼬인다(D20′).
           ⚠ overflow:hidden 금지 — 경우 rail·dot이 좌측 거터(−1.8em)에 그려진다.
           ⚠ --case-dot-fill을 카드 배경으로 재정의한다. 접힘 dot의 속이 배경색이라
             재정의하지 않으면 rail이 dot을 관통한다(globals.css:157 전례).
           ⚠ question 탭의 옛 `marginLeft:-24` 분기는 제거했다 — 이제 모든 탭이 카드다. */
        <div
          className={isQuestion ? 'problem-tab-card' : undefined}
          onClick={isQuestion ? onToggleTab : undefined}
          title={isQuestion ? (collapsedPreview ? '문제 펼치기' : '문제 접기') : undefined}
          style={{
            ...mainColStyle,
            width: (mainColStyle.width as number) + CARD_PAD_L + CARD_PAD_R,
            boxSizing: 'border-box',
            background: 'var(--card-surface, var(--bg-content))',
            border: '0.5px solid var(--border-content)',
            borderRadius: CARD_RADIUS,
            transition: 'background 0.15s, height 0.18s ease',
            ['--case-dot-fill' as any]: 'var(--card-surface, var(--bg-content))',
            /* 접힘(문제 탭 전용): 내용을 **아예 그리지 않고** 리스트 행 두께의 막대만 남긴다.
               ⚠ 첫 줄을 남기면 "잘렸다"로 읽혀 오히려 시선을 끈다 — 접힘은 조용해야 한다. */
            ...(collapsedPreview
              ? { height: COLLAPSED_CARD_H, padding: 0, overflow: 'hidden' }
              : { padding: `20px ${CARD_PAD_R}px 20px ${CARD_PAD_L}px` }),
            /* 카드 전체가 접힘/펼침 영역이다(덕수 보완 2) — 라벨만으로는 과녁이 너무 작다. */
            ...(isQuestion ? { cursor: 'pointer' as const } : null),
          }}>
          {/* Phase 58 P2 — 톤 기준선 + 탭별 톤 스코프 */}
          {!collapsedPreview && <div
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
          </div>}
        </div>
      )}
    </div>
  );
}
