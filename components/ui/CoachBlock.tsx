'use client';

import { useState } from 'react';
import CoachLabel from './CoachLabel';
import { coachClassName } from '../../lib/coachBlock';

/* 개선묶음 M2 G — 코칭(Tip) 블록의 공통 껍데기.
   렌더 5사이트가 각자 적고 있던 `div.coach-block > CoachLabel + 본문` 패턴을 흡수한다.

   본문을 children으로 받는 이유: 5사이트 중 인쇄만 EditorPreview가 아니라 자체
   PrintBlockRenderer를 쓴다. 껍데기가 본문 렌더러까지 소유하면 인쇄가 이 컴포넌트를
   못 쓰고, 그러면 접힘 규약이 다시 사이트별 사본으로 갈린다.

   collapsible (D38′):
     TabBody · ProblemTabContent = true  (기본 접힘)
     FolderView                  = false (320px 축약 카드에서 아이콘만 남으면 무엇이
                                          들었는지 알 수 없다 — Q13)
     EditorView 미리보기 · 인쇄    = false (편집 방해 · 지면에 버튼 금지)

   ⚠ 상태는 컴포넌트 로컬이고 저장하지 않는다(S5). 렌더 사이트가 key={block.id}를
     주므로 인스턴스 수명이 블록과 일치한다 — 별도 키 개념이 필요 없다. */
export default function CoachBlock({
  type, collapsible = false, children,
}: {
  type: string;
  collapsible?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);   // D37′ — 기본 접힘
  const collapsed = collapsible && !open;

  return (
    <div className={coachClassName(type)}>
      <CoachLabel
        type={type}
        collapsed={collapsed}
        onToggle={collapsible ? () => setOpen((o) => !o) : undefined}
      />
      {!collapsed && children}
    </div>
  );
}
