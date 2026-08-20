'use client';

import { IconCoachImportant, IconCoachCaution } from './Icons';
import { COACH_LABELS } from '../../lib/coachBlock';

/* Phase 59a — 코칭 블록의 제목 줄 (아이콘 + 라벨 어절).
   렌더 5사이트가 **모두** 이 컴포넌트를 쓴다. 블록 렌더러 자체는 사이트마다 다르지만
   (D16 — 공개 뷰어엔 svg·ggb 분기가 없다) 이 줄은 순수 표시라 공유해도 그 분리를
   해치지 않는다. 사본을 만들면 아이콘·간격이 사이트마다 갈린다.

   ⚠ 색은 CSS(.coach-block .coach-label)가 --coach-accent로 준다. 여기서 색을 주지 말 것 —
     인쇄는 같은 자리를 #000으로 덮어써야 하는데 인라인 style이면 못 이긴다.
   ⚠ 아이콘은 stroke="currentColor"라 라벨 색을 그대로 따라온다. */
export default function CoachLabel({ type }: { type: string }) {
  const caution = type === 'coach_caution';
  return (
    <div className="coach-label">
      {caution ? <IconCoachCaution size={14} /> : <IconCoachImportant size={14} />}
      <span>{COACH_LABELS[type] ?? 'Important'}</span>
    </div>
  );
}
