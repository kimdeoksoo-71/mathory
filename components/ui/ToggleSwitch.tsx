'use client';

/**
 * 라벨 + 좌우로 움직이는 스위치. 켜짐/꺼짐 한 쌍을 나타내는 앱 공통 형태.
 *
 * Phase 47에서 댓글 패널('보이기' 등)에 만들었고, Phase 59에서 블록 상단바의
 * '요약에 넣기'가 같은 모양을 쓰게 되면서 공용으로 옮겼다.
 * ⚠ 사본을 만들지 말 것 — 트랙·손잡이 치수와 색이 두 벌로 갈리면 금방 어긋난다.
 *
 * M6 후속(덕수 2026-09-09) — M6 D17~D19의 Phosphor toggle-left/right 글리프는 **철회**했다
 * ("변경 전 디자인이 더 자연스럽다"). 트랙+손잡이 도안으로 복귀하되 크기만 줄였다:
 * 22×13(손잡이 9) → **18×11(손잡이 7)** — 옆에 놓이는 상단바 아이콘(14px)과 비슷한 눈높이.
 * 켜짐 위치 9 = 18 − 7 − 2. 색은 그대로(ON --border-content-active / OFF --text-placeholder —
 * 활성 블록 배경 #E8DFCE에서 1.35:1, 옛 --bg-active는 1.03:1이라 트랙이 안 보였다).
 *
 * 드래그 핸들 위(dnd-kit)나 클릭 가로채기가 필요한 자리에서는 호출부가
 * 바깥 span에서 pointerdown을 막는다 (이 컴포넌트는 순수하게 둔다).
 */
const TRACK_W = 18;
const TRACK_H = 11;
const KNOB = 7;
const KNOB_INSET = 2;

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
      <span style={{
        position: 'relative', display: 'inline-block',
        width: TRACK_W, height: TRACK_H, borderRadius: TRACK_H / 2,
        background: on ? 'var(--border-content-active, #B89B78)' : 'var(--text-placeholder, #C8C1B6)',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: KNOB_INSET,
          left: on ? TRACK_W - KNOB - KNOB_INSET : KNOB_INSET,
          width: KNOB, height: KNOB, borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }} />
      </span>
    </button>
  );
}
