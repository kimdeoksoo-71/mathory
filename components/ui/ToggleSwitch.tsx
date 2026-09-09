'use client';

/**
 * 라벨 + 좌우로 움직이는 스위치. 켜짐/꺼짐 한 쌍을 나타내는 앱 공통 형태.
 *
 * Phase 47에서 댓글 패널('보이기' 등)에 만들었고, Phase 59에서 블록 상단바의
 * '요약에 넣기'가 같은 모양을 쓰게 되면서 공용으로 옮겼다.
 * ⚠ 사본을 만들지 말 것 — 도안·크기·색이 두 벌로 갈리면 금방 어긋난다.
 *
 * M6 D17~D19 — 트랙+손잡이 span 2개를 Phosphor `toggle-left`(OFF · regular) /
 * `toggle-right`(ON · fill) 한 글리프로 바꿨다. 24px 글리프의 잉크 bbox가 22.5×13.5라
 * 옛 트랙(22×13)과 0.5px 차 — 소비처 4곳(블록 상단바 · 열람뷰 '요약' · 댓글 패널 2)의
 * 레이아웃이 움직이지 않는다. 켜짐은 fill weight(IconPin과 같은 규약), 색은
 * ON --border-content-active / OFF --text-muted(옛 --text-placeholder는 선 도안에서 1.35:1).
 *
 * 드래그 핸들 위(dnd-kit)나 클릭 가로채기가 필요한 자리에서는 호출부가
 * 바깥 span에서 pointerdown을 막는다 (이 컴포넌트는 순수하게 둔다).
 */
import { PhIcon } from './Icons';
import { PH } from './phosphorPaths';

const TOGGLE_SIZE = 24;

export default function ToggleSwitch({
  label, on, onToggle, title, disabled, labelStyle,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  title?: string;
  /** 켤 수 없는 상태(대상이 없음 등). 자리는 지키되 조작을 막는다 */
  disabled?: boolean;
  /** 라벨 타이포 덮어쓰기. 옆에 놓인 글자와 자형을 맞춰야 하는 자리에서 쓴다
   *  (열람뷰의 '요약'은 탭 라벨 '문제·풀이'와 같은 12px/600/자간 0.5) */
  labelStyle?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      title={title}
      style={{
        opacity: disabled ? 0.45 : 1,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        border: 'none', background: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        padding: '2px 2px', fontFamily: 'var(--font-ui)',
        fontSize: 11, color: on ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <span style={labelStyle}>{label}</span>
      <PhIcon
        d={on ? PH.toggleOn : PH.toggleOff}
        size={TOGGLE_SIZE}
        color={on ? 'var(--border-content-active, #B89B78)' : 'var(--text-muted)'}
        style={{ flexShrink: 0, transition: 'color 0.15s' }}
      />
    </button>
  );
}
