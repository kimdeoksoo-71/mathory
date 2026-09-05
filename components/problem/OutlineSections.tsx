'use client';

import React from 'react';
import type { Block } from '../../types/problem';
import { needsPrefaceToggle, type OutlineItem, type OutlineSection } from '../../lib/solutionOutline';
import { caseClassName } from '../../lib/caseBlock';
import EditorPreview from '../editor/EditorPreview';

/* ═══════════════════════════════════════════════════════════════
   Phase 59 — 요약 보기 스켈레톤 렌더 (열람 2뷰 공용)

   블록 렌더러는 사이트마다 다르므로(공개 뷰어에는 svg·ggb 분기가 없다 — D16)
   renderBlock을 렌더프롭으로 받는다. 여기서 공유하는 것은 "무엇을 접고 무엇을
   남기는가"라는 골격뿐이다.

   Phase 59a: 남는 것은 제목 · 경우 제목행 · 작성자가 고른 블록 셋뿐이다.
   `**` 발췌 렌더는 폐기됐다.

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
      {/* ⚠ v3 S1 — 여닫이 노브(chevron)는 **제목 줄·경우 줄 둘 다** 없앴다.
          덕수 원안: "현재의 노브는 없앤다. 간결함을 저해하는 요소로 작용되고
          배경톤 진해짐 효과와 기능 중복". 펼침/접힘은 이제 톤이 말한다 —
          접힘 hover 2단 · 펼침 1단 상시(S2·S3), 경우는 dot의 테두리/채움.
          ⚠ 되살리지 말 것: 노브를 다시 넣으면 같은 정보를 두 번 말하게 되고,
            경우 줄에서는 rail이 -1.3em으로 당겨 온 자리(R2)를 도로 빼앗는다.
          ⚠ 여닫이라는 사실은 role="button" + aria-expanded가 계속 나른다. */}
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
  // 펼칠 것 = 자기 본문 + 거느린 구역. 둘 다 없으면 정적 줄(레거시 라벨 항목)이다.
  const toggleable = (item.body ?? '').trim() !== '' || (item.segment?.length ?? 0) > 0;
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
        {/* 이 안에는 경우 블록 **자신의** 본문만 넣는다. 거느린 구역은 바깥에서
            형제로 그린다 — 여기 넣으면 .case-block 안에 갇혀 rail 인접이 끊긴다. */}
        {open && item.body ? <EditorPreview content={item.body} borderless locale="ko" /> : null}
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
        /* Phase 59a: 항목은 'case'와 'block' 둘뿐이다. 발췌(kind:'keys')가 폐기되면서
           "경우 사이에 낀 발췌에 .case-gap을 붙인다"는 firstCase/lastCase 계산도 사라졌다. */
        const skeleton = (
          <>
            {sec.items.map((item, idx) => {
              /* 작성자가 고른 블록 — 사이트 renderBlock을 그대로 쓴다(자체 key 보유).
                 ⚠ 여기서 div로 한 번 더 감싸면 .case-gap이 형제가 아니게 되어
                   rail이 그 블록 앞뒤로 끊긴다. renderBlock 결과를 그대로 흘릴 것. */
              if (item.kind !== 'case') return renderBlock(item.block!, idx);

              /* 경우 구역 — 펼치면 거느린 블록 전부, 접으면 '요약에 넣기'를 켠 것만.
                 ⚠ 둘을 동시에 그리면 pinned 블록이 두 번 나온다(펼침 목록이 이미 포함).
                 ⚠ Fragment로 감싸는 것이 요점이다. DOM 노드를 만들지 않으므로
                   .case-block과 뒤따르는 .case-gap이 **형제로 남아** rail 브리징이
                   전체 보기와 똑같이 동작한다. div로 감싸면 그 순간 죽는다 (D15′). */
              const isOpen = openCases.has(item.itemKey);
              const trailing = (isOpen ? item.segment : item.pinned) ?? [];
              return (
                <React.Fragment key={item.itemKey}>
                  <CaseItem item={item} open={isOpen} onToggle={onToggleCase} />
                  {trailing.map((b, i) => renderBlock(b, i))}
                </React.Fragment>
              );
            })}
          </>
        );

        /* v3 S3 — 펼친 섹션은 카드 전폭 톤을 입는다. 음수 마진 값은 CSS가
           --card-pad-l/r(TabBody가 카드 인라인 style에 세운다)에서 읽는다.
           ⚠ TS 상수 하나가 카드 패딩과 톤 폭을 함께 공급해야 한다 — CSS에 리터럴을
             적으면 글꼴을 바꿀 때 톤 영역만 어긋난다. */
        return (
          <div key={sec.key} className={`outline-section${open ? ' is-open' : ''}`}>
            {sec.heading ? (
              <Toggler open={open} onToggle={(el) => onToggleSection(sec.key, el)} controls={bodyId} className="section-head">
                {renderBlock(sec.heading, 0)}
              </Toggler>
            ) : needsPrefaceToggle(sec) || (open && sec.blocks.length > 0) ? (
              /* M3 B3(D9=(b)) — 여닫이는 숨은 블록이 있을 때만. 판정은 lib이 소유한다.
                 둘째 항은 이미 열린 전문을 닫는 길 — 지우면 한 번 열면 못 닫는다. */
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
