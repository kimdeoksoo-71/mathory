'use client';

/**
 * M6 D22 — 사이드바 최상위 섹션 헤더 한 벌(My · 공유 · 최근 문항).
 * 세 헤더가 각자 사본으로 살며 글자 크기(12.5/11.5)·uppercase·아이콘 유무가 갈렸던 것을
 * 하나로 묶었다. 규격: [아이콘 16 · --text-muted] [라벨 12.5/600/--text-muted/자간 .3 · flex:1]
 * [trailing] [chevron 14 · 열리면 90°]. 아이콘은 접힘(collapsed) 모드 SidebarItem의 것과
 * 같은 컴포넌트를 넘긴다 — 펼침·접힘에서 도안·의미가 1:1.
 * 래퍼 여백('8px 12px')은 호출부(Sidebar)가 세 섹션에 똑같이 준다 — 헤더 사이 간격이
 * 달라 보이던 실제 원인이 그 여백 차이였다(v1 §1 G).
 */
import { IconChevron } from '../ui/Icons';

export default function SidebarSectionHeader({ icon, label, open, onToggle, trailing, style }: {
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  /** 라벨과 chevron 사이(My의 '+ 새 폴더' 버튼) */
  trailing?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, ...style }}>
      <span style={{ display: 'flex', flexShrink: 0, color: 'var(--text-muted)' }}>{icon}</span>
      <button
        onClick={onToggle}
        style={{
          flex: 1, minWidth: 0,
          display: 'flex', alignItems: 'center',
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)',
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
        title={open ? '접기' : '펼치기'}
      >
        <IconChevron size={14} />
      </button>
    </div>
  );
}
