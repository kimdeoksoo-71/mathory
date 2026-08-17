'use client';

import React from 'react';
import type { Block } from '../../types/problem';
import type { OutlineItem, OutlineSection } from '../../lib/solutionOutline';
import { caseClassName } from '../../lib/caseBlock';
import EditorPreview from '../editor/EditorPreview';
import { IconChevron } from '../ui/Icons';

/* ═══════════════════════════════════════════════════════════════
   Phase 59 — 요약 보기 스켈레톤 렌더 (열람 2뷰 공용)

   블록 렌더러는 사이트마다 다르므로(공개 뷰어에는 svg·ggb 분기가 없다 — D16)
   renderBlock을 렌더프롭으로 받는다. 여기서 공유하는 것은 "무엇을 접고 무엇을
   남기는가"라는 골격뿐이다.

   ⚠ 경우 항목만 제목/본문 두 EditorPreview로 나뉜다. 이 컴포넌트는 열람 2뷰
     전용이고 두 뷰는 onClickMath를 쓰지 않으므로 data-math-id 충돌(v2 E7)이
     발생하지 않는다. full 모드의 경우 블록은 사이트 renderBlock이 단일
     인스턴스로 그린다 — 그쪽은 편집창과 공유되므로 절대 쪼개지 말 것.
   ═══════════════════════════════════════════════════════════════ */

interface Props {
  sections: OutlineSection[];
  openSections: Set<string>;
  openCases: Set<string>;
  onToggleSection: (key: string, el: HTMLElement | null) => void;
  onToggleCase: (key: string, el: HTMLElement | null) => void;
  renderBlock: (block: Block, index: number) => React.ReactNode;
}

/** 클릭·키보드로 여닫는 줄. <button>으로 감쌀 수 없다 —
 *  내부에 <p>·KaTeX(MathML)가 들어가 HTML이 무효가 된다. */
function Toggler({
  open, onToggle, controls, className, children,
}: {
  open: boolean;
  onToggle: (el: HTMLElement | null) => void;
  controls: string;
  className: string;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const fire = () => onToggle(ref.current);
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-expanded={open}
      aria-controls={controls}
      className={className}
      onClick={fire}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      }}
    >
      {/* ⚠ 회전을 인라인 style로 주지 말 것 — 경우 줄의 chevron은 CSS에서
          translateY(-50%)로 dot과 세로를 맞추는데 인라인 transform이 그것을 덮어써
          chevron만 반 칸 내려앉는다. 회전은 aria-expanded를 보고 CSS가 건다. */}
      <span className="outline-chevron" aria-hidden>
        <IconChevron size={12} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function CaseItem({
  item, open, onToggle,
}: {
  item: OutlineItem;
  open: boolean;
  onToggle: (key: string, el: HTMLElement | null) => void;
}) {
  const toggleable = item.body !== undefined && item.body.trim() !== '';
  const cls = caseClassName(
    item.sub ? 'subcase' : 'case',
    !!item.labeled,
    { closed: toggleable && !open },
  );
  const bodyId = `case-body-${item.itemKey}`;
  const head = <EditorPreview content={item.head} borderless locale="ko" />;

  return (
    <div className={cls}>
      {toggleable ? (
        <Toggler open={open} onToggle={(el) => onToggle(item.itemKey, el)} controls={bodyId} className="case-head">
          {head}
        </Toggler>
      ) : (
        <div className="case-head is-static">{head}</div>
      )}
      <div id={bodyId}>
        {open && item.body ? (
          <EditorPreview content={item.body} borderless locale="ko" />
        ) : item.keys ? (
          <div className="outline-keys"><EditorPreview content={item.keys} borderless locale="ko" /></div>
        ) : null}
      </div>
    </div>
  );
}

export default function OutlineSections({
  sections, openSections, openCases, onToggleSection, onToggleCase, renderBlock,
}: Props) {
  return (
    <>
      {sections.map((sec) => {
        const open = openSections.has(sec.key);
        const bodyId = `outline-sec-${sec.key}`;
        // 경우 항목 사이에 낀 발췌는 rail이 관통해야 한다 — 전체 렌더의 .case-gap과 같은 규칙
        const firstCase = sec.items.findIndex((i) => i.kind === 'case');
        const lastCase = sec.items.map((i) => i.kind).lastIndexOf('case');
        const skeleton = (
          <>
            {sec.items.map((item, idx) => (
              item.kind === 'case'
                ? <CaseItem key={item.itemKey} item={item} open={openCases.has(item.itemKey)} onToggle={onToggleCase} />
                : item.kind === 'block'
                /* 작성자가 고른 그림 — 사이트 renderBlock을 그대로 쓴다(자체 key 보유).
                   ⚠ 여기서 div로 한 번 더 감싸면 .case-gap이 형제가 아니게 되어
                     rail이 그림 앞뒤로 끊긴다. renderBlock 결과를 그대로 흘릴 것. */
                ? renderBlock(item.block!, 0)
                : (
                  <div key={item.itemKey}
                    className={`outline-keys${idx > firstCase && idx < lastCase ? ' case-gap' : ''}`}>
                    <EditorPreview content={item.head} borderless locale="ko" />
                  </div>
                )
            ))}
          </>
        );

        return (
          <div key={sec.key}>
            {sec.heading ? (
              <Toggler open={open} onToggle={(el) => onToggleSection(sec.key, el)} controls={bodyId} className="section-head">
                {renderBlock(sec.heading, 0)}
              </Toggler>
            ) : sec.items.length > 0 || (open && sec.blocks.length > 0) ? (
              /* 전문(前文) 섹션 — 클릭할 제목이 없으므로 여닫이 줄을 따로 둔다 (Q4) */
              <Toggler open={open} onToggle={(el) => onToggleSection(sec.key, el)} controls={bodyId} className="section-head is-preface">
                <span>{open ? '앞부분 접기' : '앞부분 펼치기'}</span>
              </Toggler>
            ) : null}
            <div id={bodyId}>
              {open ? sec.blocks.map((b, i) => renderBlock(b, i)) : skeleton}
            </div>
          </div>
        );
      })}
    </>
  );
}
