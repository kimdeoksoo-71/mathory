'use client';

import { useMemo } from 'react';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { Block } from '../../types/problem';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import { isToneScoped, toneClass } from '../../lib/keyTone';
import { blockKeyOf, buildCaseGapKeys, buildCaseLabels, caseClassName, caseGapClassName, injectCaseLabel, isCaseBlock } from '../../lib/caseBlock';
import { useOutlineState } from '../../hooks/useOutlineState';
import OutlineSections from '../problem/OutlineSections';
import OutlineToggle from '../ui/OutlineToggle';
import CoachLabel from '../ui/CoachLabel';
import { coachClassName, isCoachBlock } from '../../lib/coachBlock';

const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

/**
 * 공개 뷰어용 탭 본문 렌더러 (Phase 50 /shared, Phase 51 /p 공통).
 * EditorPreview borderless + ChoicesBlock + 이미지 treatment 패턴.
 *
 * Phase 58 P2 — tabId를 받는다. 톤 스코프 판정(question 탭만 제외)에 필요한데
 * 이전에는 blocks만 받아 탭 정체를 몰랐다.
 *
 * Phase 59 — 요약 보기 토글을 여기에 둔다(D6). 셸이 아니라 이 컴포넌트인 이유:
 * 넓은 화면 + 탭 2개면 PublicViewerShell이 탭 바 없이 좌·우 2단으로 가르므로
 * "탭 바 옆"이라는 자리가 존재하지 않는다. 탭 콘텐츠 자신이 유일한 공통 자리다.
 */
export default function ProblemTabContent({ blocks, tabId }: { blocks: Block[]; tabId: string }) {
  // ⚠ useOutlineState가 blocks 참조로 memo하므로 정렬 결과를 매 렌더 새로 만들면 안 된다
  const sorted = useMemo(() => [...blocks].sort((a, b) => a.order - b.order), [blocks]);
  const caseLabels = useMemo(() => buildCaseLabels(sorted), [sorted]);
  const caseGaps = useMemo(() => buildCaseGapKeys(sorted), [sorted]);
  const outline = useOutlineState(sorted);
  // 문제 탭은 스코프 밖 — 거기서 `**`는 key 마커가 아니다(Phase 58 D9)
  const scoped = isToneScoped(tabId);

  /* 경우 사이에 낀 블록은 rail이 관통하도록 .case-gap 한 겹을 두른다(형제 관계 유지) */
  const renderBlock = (block: Block, i: number) => {
    const node = renderBlockInner(block, i);
    if (!caseGaps.has(blockKeyOf(block))) return node;
    return <div key={block.id} className={caseGapClassName(block.type)}>{node}</div>;
  };

  const renderBlockInner = (block: Block, i: number) => {
    const headingTopPad = block.type === 'heading' && i !== 0 ? '0.5em' : undefined;   // Phase 58 D2

    if (block.type === 'image') {
      const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
      return (
        <div key={block.id} style={{ textAlign: 'center', margin: '0.8em 0' }}>
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" style={{
              width: block.imageWidth || 400, maxWidth: '90%', height: 'auto',
              ...imageTreatmentStyle(block),
            }} />
          ) : (
            <span style={{ color: '#888', fontSize: 12 }}>(이미지 없음)</span>
          )}
        </div>
      );
    }

    if (BORDERED_TYPES.has(block.type)) {
      return (
        <div key={block.id} style={{
          border: '1.5px solid var(--text-muted, #888)',
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
        <div key={block.id} className={caseClassName(block.type, !!label)}>
          <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko" />
        </div>
      );
    }

    if (isCoachBlock(block.type)) {
      /* Phase 59a: 코칭 — 라벨(Important/Caution)은 raw_text가 아니라 렌더가 붙인다 */
      return (
        <div key={block.id} className={coachClassName(block.type)}>
          <CoachLabel type={block.type} />
          <EditorPreview content={block.raw_text} borderless locale="ko" />
        </div>
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
      <div key={block.id} style={{ paddingTop: headingTopPad }}>
        <EditorPreview content={block.raw_text} borderless locale="ko" />
      </div>
    );
  };

  return (
    /* Phase 58 D14 — 앱 열람뷰와 톤 기준선을 맞춘다.
       ⚠ .problem-content-toned를 통째로 붙이면 letter-spacing: -0.01em이 함께 들어와
         이미 공개된 페이지의 줄바꿈이 바뀐다. 색만 담은 .tone-baseline만 쓸 것.
         (line-height 1.8·font-family는 EditorPreview root가 이미 주고 있다) */
    /* --case-dot-fill: 접힘 dot의 속을 이 카드의 배경색으로 채운다(기본값은 앱의 클레이) */
    <div className={`tone-baseline ${toneClass(tabId)}`.trim()}
      style={{ ['--case-dot-fill' as any]: 'var(--bg-card, #fff)' }}>
      {scoped && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
          <OutlineToggle mode={outline.mode} onToggle={outline.toggleMode} disabled={!outline.available} />
        </div>
      )}
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
        sorted.map(renderBlock)
      )}
    </div>
  );
}
