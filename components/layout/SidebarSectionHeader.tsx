'use client';

/**
 * M6 D22 — 사이드바 최상위 섹션 헤더 한 벌(My · 공유 · 최근 문항).
 * 세 헤더가 각자 사본으로 살며 글자 크기(12.5/11.5)·uppercase·아이콘 유무가 갈렸던 것을
 * 하나로 묶었다. 규격(M7 K, 덕수 2026-09-12): [아이콘 16 **regular** · **--text-primary**]
 * [라벨 13.5/**500** · **--text-secondary**(하위 폴더 행의 비활성 사양과 동일) · 자간 .3 · flex:1]
 * [trailing] [chevron 14 · 열리면 90°].
 * ⚠ M6 검수 6차의 "아이콘 bold + 글자 13.5/700"은 **철회**됐다("굵기가 부담스럽다") — 위계는 굵기가 아니라
 *   **아이콘 톤**(헤더 --text-primary vs 행 글리프 --text-secondary) 하나로 나른다. bold 도안은 ICONS에서 삭제됐다.
 * 아이콘은 접힘(collapsed) 모드 SidebarItem과 같은 regular 도안(IconUserCircle·IconShare·IconRecent) — 펼침·접힘 1:1.
 * 래퍼 여백('8px 12px')은 호출부(Sidebar)가 세 섹션에 똑같이 준다 — 헤더 사이 간격이
 * 달라 보이던 실제 원인이 그 여백 차이였다(v1 §1 G).
 *
 * Phase 67(hover peek) — 스타일은 불변이고 props만 늘었다:
 * · onPointerEnter/Leave — peek 중 섹션 전환 hover intent(루트 div). 필터(pointerType)는 호출부 훅이 한다.
 * · chevronTitle — undefined면 현행('접기'/'펼치기'), null이면 title 미부착(peek 중 '접기'가 오해 — D14).
 * ⚠ peek 중 onToggle은 토글이 아니라 **섹션 전환**이다 — 그 분기는 호출부(Sidebar) 책임.
 */
import { IconChevron } from '../ui/Icons';

export default function SidebarSectionHeader({
  icon, label, open, onToggle, trailing, style, onPointerEnter, onPointerLeave, chevronTitle,
}: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  /** 라벨과 chevron 사이(My의 '+ 새 폴더' 버튼) */
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
  onPointerEnter?: React.PointerEventHandler<HTMLDivElement>;
  onPointerLeave?: React.PointerEventHandler<HTMLDivElement>;
  /** undefined = 현행 '접기'/'펼치기' · null = title 없음 */
  chevronTitle?: string | null;
}) {
  const chevTitle = chevronTitle === undefined ? (open ? '접기' : '펼치기') : chevronTitle ?? undefined;
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, ...style }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: 'var(--text-primary)' }}>{icon}</span>
      <button
        onClick={onToggle}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center',
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 13.5, fontWeight: 500, color: 'var(--text-secondary)',
          letterSpacing: 0.3,
          fontFamily: 'var(--font-ui)', padding: '4px 2px',
          textAlign: 'left',
        }}
      >
        {label}
      </button>
      {trailing}
      <button
        onClick={onToggle}
        style={{
          border: 'none', background: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', display: 'flex', padding: 2, borderRadius: 4,
          transform: open ? 'rotate(90deg)' : 'rotate(0)',
          transition: 'transform var(--transition-fast, .15s)',
        }}
        title={chevTitle}
      >
        <IconChevron size={14} />
      </button>
    </div>
  );
}
