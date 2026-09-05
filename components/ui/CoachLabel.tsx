'use client';

import { IconCoachImportant } from './Icons';
import { COACH_LABELS } from '../../lib/coachBlock';

/* Phase 59a — 코칭 블록의 제목 줄 (아이콘 + 라벨 어절).
   렌더 5사이트가 **모두** 이 컴포넌트를 쓴다. 블록 렌더러 자체는 사이트마다 다르지만
   (D16 — 공개 뷰어엔 svg·ggb 분기가 없다) 이 줄은 순수 표시라 공유해도 그 분리를
   해치지 않는다. 사본을 만들면 아이콘·간격이 사이트마다 갈린다.

   개선묶음 M2 G — 종류가 'Tip' 하나로 단일화됐다.
   - 아이콘은 타입 무관 IconCoachImportant(네모 말풍선 + 느낌표) 하나다.
   - collapsible 사이트에서는 아이콘이 토글 버튼이 되고, 접히면 라벨 어절이 사라진다.

   ⚠ 색은 CSS(.coach-block .coach-label)가 --coach-accent로 준다. 여기서 색을 주지 말 것 —
     인쇄는 같은 자리를 #000으로 덮어써야 하는데 인라인 style이면 못 이긴다.
   ⚠ 아이콘은 stroke="currentColor"라 라벨 색을 그대로 따라온다.
   ⚠ 토글 래퍼(.coach-toggle)의 히트 영역 확대는 padding + 같은 크기의 음수 margin으로
     한다 — padding만 주면 아이콘이 밀려 접힘/펼침에서 위치가 흔들린다. */
export default function CoachLabel({
  type, collapsed = false, onToggle,
}: {
  type: string;
  /** 접힘 상태(= 라벨 어절 숨김). collapsible 사이트에서만 true가 될 수 있다. */
  collapsed?: boolean;
  /** 넘기면 아이콘이 토글 버튼이 된다. 없으면 순수 표시(인쇄·편집 미리보기·폴더뷰). */
  onToggle?: () => void;
}) {
  const interactive = !!onToggle;
  /* M3 A1 — 아이콘 14 → 17(덕수: "약간만, 20%") · 클릭 범위 = 아이콘+라벨.
     토글 스팬이 라벨까지 감싼다 — 접히면 라벨이 사라져 자연히 아이콘만 남는다.
     ⚠ 비인터랙티브(인쇄·편집 미리보기·폴더뷰)는 옛 구조(형제) 그대로다:
       아이콘↔라벨 간격을 부모 .coach-label의 gap이 공급하는 관계를 안 깨기 위해서다.
       인터랙티브 쪽 간격은 .coach-toggle의 gap(globals)이 같은 값으로 공급한다. */
  const icon = <IconCoachImportant size={17} />;
  const label = !collapsed ? <span>{COACH_LABELS[type] ?? 'Tip'}</span> : null;
  return (
    <div className="coach-label">
      {interactive ? (
        <span
          className="coach-toggle"
          role="button"
          tabIndex={0}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Tip 펼치기' : 'Tip 접기'}
          onClick={(e) => { e.stopPropagation(); onToggle!(); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onToggle!(); }
          }}
        >
          {icon}
          {label}
        </span>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </div>
  );
}
