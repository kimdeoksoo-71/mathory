'use client';

/**
 * 라벨 + 좌우로 움직이는 스위치. 켜짐/꺼짐 한 쌍을 나타내는 앱 공통 형태.
 *
 * Phase 47에서 댓글 패널('보이기' 등)에 만들었고, Phase 59에서 블록 상단바의
 * '요약에 넣기'가 같은 모양을 쓰게 되면서 공용으로 옮겼다.
 * ⚠ 사본을 만들지 말 것 — 트랙·손잡이 치수와 색이 두 벌로 갈리면 금방 어긋난다.
 *
 * 드래그 핸들 위(dnd-kit)나 클릭 가로채기가 필요한 자리에서는 호출부가
 * 바깥 span에서 pointerdown을 막는다 (이 컴포넌트는 순수하게 둔다).
 */
export default function ToggleSwitch({
  label, on, onToggle, title, disabled,
}: {
  label: string;
  on: boolean;
  onToggle: () => void;
  title?: string;
  /** 켤 수 없는 상태(대상이 없음 등). 자리는 지키되 조작을 막는다 */
  disabled?: boolean;
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
      <span>{label}</span>
      <span style={{
        position: 'relative', display: 'inline-block',
        width: 26, height: 15, borderRadius: 8,
        // ON은 배경과 조화되는 따뜻한 탄 톤.
        // OFF는 --bg-active(#E8E2D9)를 쓰다가 --text-placeholder로 낮췄다 — 활성 블록
        // 배경(#E8DFCE)과 명암비가 1.03:1이라 트랙이 사실상 보이지 않았다(→ 1.35:1).
        background: on ? 'var(--border-content-active, #B89B78)' : 'var(--text-placeholder, #C8C1B6)',
        transition: 'background 0.15s',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 13 : 2,
          width: 11, height: 11, borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }} />
      </span>
    </button>
  );
}
