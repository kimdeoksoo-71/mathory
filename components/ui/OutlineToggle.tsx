'use client';

import ToggleSwitch from './ToggleSwitch';
import type { OutlineMode } from '../../hooks/useOutlineState';

/* Phase 59 — 요약 보기 / 전체 보기 토글 (D6)

   ⚠ 명칭 주의: 편집창의 "전체 접기/펼치기"(Phase 45 collapseMode)는 완전히
     다른 기능이다. 열람 화면의 이 토글은 "요약 보기 / 전체 보기"로만 부른다.

   앱 열람뷰(라벨 열)와 공개 뷰어(탭 콘텐츠 상단)가 함께 쓴다. 공유하는 것은
   이 버튼과 outline 로직뿐이고 블록 렌더러는 통합하지 않는다 (D16).

   모양은 블록 상단바의 '요약에 넣기'·댓글 패널의 '보이기'와 같은 공용 스위치다
   — 앱 안에서 켜고 끄는 것은 전부 같은 형태로 보여야 한다. */

interface Props {
  mode: OutlineMode;
  onToggle: () => void;
  /** 보여줄 스켈레톤이 없을 때 (D14) */
  disabled?: boolean;
}

export default function OutlineToggle({ mode, onToggle, disabled }: Props) {
  const outline = mode === 'outline';
  return (
    <ToggleSwitch
      label="요약"
      on={outline}
      onToggle={onToggle}
      disabled={disabled}
      /* 탭 라벨('문제'·'풀이')과 자형을 맞춘다 — 바로 그 아래·옆에 놓이는 글자다 */
      labelStyle={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.5 }}
      /* Phase 59a: `**` 발췌가 폐기돼 요약에 남는 것이 셋으로 정리됐다.
         disabled 문구를 안 고치면 "강조를 넣었는데 왜 안 켜지나"가 된다. */
      title={disabled
        ? '제목·경우 블록이 없습니다'
        : outline
          ? '켜짐 — 제목·경우·요약에 넣은 블록만 보입니다. 끄면 전체가 펼쳐집니다'
          : '꺼짐 — 풀이 전체가 보입니다. 켜면 요약만 남습니다'}
    />
  );
}
