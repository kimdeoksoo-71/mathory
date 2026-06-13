'use client';

/**
 * Phase 25 — Unified Toolbar
 *
 * 컨텍스트 가시화(수식 안/밖) + 단일 진입점.
 * Step 2 (현재): 골격 + 기존 MathToolbar 분류 풀다운을 수식 안 상태에서만 노출.
 * Step 3 이후: MathToolbar 의존 제거 → 커스터마이징 가능한 그룹 시스템으로 교체.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MathSnippet } from '../../types/snippet';
import MathSymbolPalette from './MathSymbolPalette';
import MathSnippetMenu from './MathSnippetMenu';
import { IconLoader } from '../ui/Icons';
import { EmojiPickerPanel, EMOJI_PANEL_WIDTH } from './EmojiPickerPanel';

// ═══════════════════════════════════════════════
// SVG 아이콘 (viewBox 64×64, stroke=currentColor)
// ═══════════════════════════════════════════════

const ICON_SIZE = 22;
const SVG_PROPS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: '0 0 64 64',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 3.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

const CORNER_BRACKETS = (
  <>
    <path d="M8 20 L8 8 L20 8" />
    <path d="M44 8 L56 8 L56 20" />
    <path d="M56 44 L56 56 L44 56" />
    <path d="M20 56 L8 56 L8 44" />
  </>
);

function InlineMathIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M32 16 L32 48" />
      <path d="M38 22 C38 22 36 19 32 19 C28 19 25 21 25 24.5 C25 28 28 29.5 32 31 C36 32.5 39 34.5 39 38.5 C39 42 36 45 32 45 C28 45 26 42 26 42" />
    </svg>
  );
}

function BlockMathIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M23 16 L23 48" />
      <path d="M29 22 C29 22 27.5 19 23 19 C19 19 17 21.5 17 24.5 C17 28 19.5 29.5 23 31 C26.5 32.5 29 34.5 29 38.5 C29 42 27 45 23 45 C19 45 17 42 17 42" />
      <path d="M41 16 L41 48" />
      <path d="M47 22 C47 22 45.5 19 41 19 C37 19 35 21.5 35 24.5 C35 28 37.5 29.5 41 31 C44.5 32.5 47 34.5 47 38.5 C47 42 45 45 41 45 C37 45 35 42 35 42" />
    </svg>
  );
}

function SearchReplaceIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <circle cx="29" cy="28" r="11" />
      <path d="M37 36 L44 43" />
    </svg>
  );
}

function SnippetIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M25 20 C25 20 22 20 22 24 L22 29 C22 32 18 32 18 32 C18 32 22 32 22 35 L22 40 C22 44 25 44 25 44" />
      <path d="M39 20 C39 20 42 20 42 24 L42 29 C42 32 46 32 46 32 C46 32 42 32 42 35 L42 40 C42 44 39 44 39 44" />
      <circle cx="27" cy="32" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="32" cy="32" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="37" cy="32" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OcrIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <text
        x="32" y="38"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="18"
        fill="currentColor"
        stroke="none"
        letterSpacing="1"
      >OCR</text>
    </svg>
  );
}

function ProofreadIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M18 20 L46 20" />
      <path d="M18 28 L44 28" />
      <path d="M18 36 L40 36" />
      <path d="M18 44 L34 44" />
      <path d="M38 42 L43 48 L52 36" />
    </svg>
  );
}

function SpecialCharIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <circle cx="32" cy="32" r="14" />
      <text
        x="32" y="38"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontWeight="700"
        fontSize="20"
        fill="currentColor"
        stroke="none"
      >1</text>
    </svg>
  );
}

function EmojiIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <circle cx="32" cy="32" r="14" />
      <circle cx="27" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="37" cy="28" r="1.6" fill="currentColor" stroke="none" />
      <path d="M25 37 C27.5 41 36.5 41 39 37" />
    </svg>
  );
}

function TableAddIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <rect x="20" y="20" width="24" height="24" rx="1" />
      <path d="M32 20 L32 44" />
      <path d="M20 32 L44 32" />
    </svg>
  );
}

function BlockAddIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M32 20 L32 44" />
      <path d="M20 32 L44 32" />
    </svg>
  );
}

function BlockSplitIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M18 32 L46 32" />
      <path d="M24 26 L18 32 L24 38" />
      <path d="M40 26 L46 32 L40 38" />
    </svg>
  );
}

function FormulaSplitIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M18 27 L36 27" />
      <path d="M18 37 L36 37" />
      <circle cx="42" cy="27" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="42" cy="37" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AiMathGenIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path
        d="M32 16 C32 16 34 28 44 32 C34 36 32 48 32 48 C32 48 30 36 20 32 C30 28 32 16 32 16Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

// ═══════════════════════════════════════════════
// 특수문자 그룹 (원문자 등) — Step 5에서 사용자 커스터마이징 지원 예정
// ═══════════════════════════════════════════════

interface SpecialCharGroup {
  name: string;
  items: { char: string; title: string }[];
}

const SPECIAL_CHAR_GROUPS: SpecialCharGroup[] = [
  {
    name: '원문자',
    items: [
      { char: '①', title: '원문자 1' },
      { char: '②', title: '원문자 2' },
      { char: '③', title: '원문자 3' },
      { char: '④', title: '원문자 4' },
      { char: '⑤', title: '원문자 5' },
    ],
  },
  {
    name: '검정원문자',
    items: [
      { char: '❶', title: '검정 1' },
      { char: '❷', title: '검정 2' },
      { char: '❸', title: '검정 3' },
      { char: '❹', title: '검정 4' },
      { char: '❺', title: '검정 5' },
    ],
  },
  {
    name: '한글원문자',
    items: [
      { char: '㉠', title: '한글 ㄱ' },
      { char: '㉡', title: '한글 ㄴ' },
      { char: '㉢', title: '한글 ㄷ' },
      { char: '㉣', title: '한글 ㄹ' },
      { char: '㉤', title: '한글 ㅁ' },
      { char: '㉥', title: '한글 ㅂ' },
      { char: '㉦', title: '한글 ㅅ' },
      { char: '㉧', title: '한글 ㅇ' },
    ],
  },
];

// ═══════════════════════════════════════════════
// Props & 공통 스타일
// ═══════════════════════════════════════════════

export interface BlockTypeOption {
  type: string;
  label: string;
}

interface UnifiedToolbarProps {
  cursorInMath: boolean;
  showToolbar: boolean;
  onInsert: (template: string, cursorOffset: number) => void;
  snippets: MathSnippet[];
  onSnippetInsert: (content: string) => void;
  onSnippetAdd: (data: { name: string; shortcutIndex: number; content: string }) => void;
  onSnippetEdit: (snippetId: string, data: Partial<{ name: string; shortcutIndex: number; content: string }>) => void;
  onSnippetDelete: (snippetId: string) => void;
  searchOpen: boolean;
  onToggleSearch: () => void;
  proofreading: boolean;
  onRunProofread: () => void;
  ocrLoading: boolean;
  onOcrClick: () => void;
  // 블록 영역
  blockTypes: BlockTypeOption[];
  onAddBlock: (type: string) => void;
  onSplitBlock: () => void;
  canSplitBlock: boolean;
  onSplitMathLines: () => void;
  onAIComplete: () => void;
  aiLoading: boolean;
}

const ICON_BTN_BASE: React.CSSProperties = {
  width: 32, height: 32,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid transparent',
  borderRadius: 6,
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--text-muted)',
  transition: 'all 0.15s',
  padding: 0,
};

const TOOLTIP_DELAY_MS = 600;

function IconButton({
  title, onClick, active, disabled, children, buttonRef,
}: {
  title: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  buttonRef?: React.Ref<HTMLButtonElement>;
}) {
  const [tipPos, setTipPos] = useState<{ top: number; left: number } | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const innerBtnRef = useRef<HTMLButtonElement | null>(null);

  // 외부 buttonRef와 내부 ref 동시 할당
  const setBtnRef = (el: HTMLButtonElement | null) => {
    innerBtnRef.current = el;
    if (typeof buttonRef === 'function') buttonRef(el);
    else if (buttonRef) (buttonRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
  };

  const showTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      const el = innerBtnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setTipPos({ top: r.bottom + 6, left: r.left + r.width / 2 });
    }, TOOLTIP_DELAY_MS);
  };
  const hideTip = () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setTipPos(null);
  };

  useEffect(() => () => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
  }, []);

  return (
    <>
      <button
        ref={setBtnRef}
        onClick={() => { hideTip(); onClick(); }}
        disabled={disabled}
        aria-label={title}
        style={{
          ...ICON_BTN_BASE,
          border: active ? '1px solid var(--accent-primary)' : '1px solid transparent',
          background: active ? 'rgba(66, 133, 244, 0.08)' : 'transparent',
          color: active ? 'var(--accent-primary)' : 'var(--text-muted)',
          cursor: disabled ? 'wait' : 'pointer',
        }}
        onMouseEnter={(e) => {
          if (!active && !disabled) e.currentTarget.style.background = 'var(--bg-hover, #f0f0f0)';
          showTip();
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
          hideTip();
        }}
        onFocus={showTip}
        onBlur={hideTip}
      >
        {children}
      </button>
      {tipPos && (
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: tipPos.top,
            left: tipPos.left,
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            background: 'rgba(33, 33, 33, 0.92)',
            color: '#fff',
            fontSize: 11,
            fontWeight: 500,
            fontFamily: 'var(--font-ui, sans-serif)',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          }}
        >
          {title}
        </span>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// 특수문자 풀다운
// ═══════════════════════════════════════════════

function SpecialCharDropdown({ onInsert }: { onInsert: (template: string, cursorOffset: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton title="특수문자" onClick={() => setOpen((v) => !v)} active={open}>
        <SpecialCharIcon />
      </IconButton>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            padding: 8,
            minWidth: 200,
          }}
        >
          {SPECIAL_CHAR_GROUPS.map((group, gi) => (
            <div key={group.name} style={{ marginTop: gi > 0 ? 8 : 0 }}>
              <div
                style={{
                  padding: '0 2px 4px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#999',
                  letterSpacing: 0.5,
                  fontFamily: 'var(--font-ui, sans-serif)',
                }}
              >
                {group.name}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 3 }}>
                {group.items.map((it) => (
                  <button
                    key={it.char}
                    title={it.title}
                    onClick={() => {
                      onInsert(it.char, it.char.length);
                      setOpen(false);
                    }}
                    style={{
                      padding: '6px',
                      fontSize: 16,
                      backgroundColor: '#fff',
                      border: '1px solid #eee',
                      borderRadius: 4,
                      cursor: 'pointer',
                      lineHeight: 1,
                      textAlign: 'center',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f0f0f0'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                  >
                    {it.char}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 이모지 풀다운 (Twemoji) — Phase 39
// 입력: 순수 유니코드만 삽입. 패널은 EmojiPickerPanel(재사용) 사용.
// ═══════════════════════════════════════════════

function EmojiPickerDropdown({ onInsert }: { onInsert: (template: string, cursorOffset: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 외부 클릭 닫기 (SpecialChar와 동일)
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton title="이모지" onClick={() => setOpen((v) => !v)} active={open}>
        <EmojiIcon />
      </IconButton>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 1000,
            padding: 8,
            width: EMOJI_PANEL_WIDTH + 16,
          }}
        >
          <EmojiPickerPanel
            onSelect={(emoji) => {
              onInsert(emoji, Array.from(emoji).length);
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 블록 추가 풀다운
// ═══════════════════════════════════════════════

function BlockAddDropdown({
  blockTypes, onAddBlock, disabled,
}: {
  blockTypes: BlockTypeOption[];
  onAddBlock: (type: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <IconButton
        title="블록 추가"
        onClick={() => setOpen((v) => !v)}
        active={open}
        disabled={disabled}
      >
        <BlockAddIcon />
      </IconButton>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: 4,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-light)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: 140,
            overflow: 'hidden',
          }}
        >
          {blockTypes.map((bt) => (
            <div
              key={bt.type}
              onClick={() => {
                onAddBlock(bt.type);
                setOpen(false);
              }}
              style={{
                padding: '7px 14px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-ui)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {bt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 표 삽입 다이얼로그
// ═══════════════════════════════════════════════

function TableInsertDialog({
  open, onClose, onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (rows: number, cols: number) => void;
}) {
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);

  useEffect(() => {
    if (open) {
      setRows(3);
      setCols(3);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const r = Math.max(1, Math.min(50, Math.floor(rows)));
    const c = Math.max(1, Math.min(20, Math.floor(cols)));
    onConfirm(r, c);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 3000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          padding: '20px 24px',
          minWidth: 260,
          fontFamily: 'var(--font-ui)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
          표 삽입
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ width: 28 }}>행</span>
            <input
              type="number" min={1} max={50}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value) || 1)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              autoFocus
              style={{
                width: 64, padding: '4px 8px', fontSize: 13,
                border: '1px solid var(--border-light)', borderRadius: 4,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'var(--text-primary)' }}>
            <span style={{ width: 28 }}>열</span>
            <input
              type="number" min={1} max={20}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value) || 1)}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              style={{
                width: 64, padding: '4px 8px', fontSize: 13,
                border: '1px solid var(--border-light)', borderRadius: 4,
                fontFamily: 'var(--font-ui)',
              }}
            />
          </label>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              padding: '6px 14px', fontSize: 13,
              border: '1px solid var(--border-light)', background: '#fff',
              borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              color: 'var(--text-primary)',
            }}
          >취소</button>
          <button
            onClick={submit}
            style={{
              padding: '6px 14px', fontSize: 13,
              border: '1px solid var(--accent-primary)',
              background: 'var(--accent-primary)',
              color: '#fff',
              borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-ui)',
              fontWeight: 600,
            }}
          >확인</button>
        </div>
      </div>
    </div>
  );
}

/**
 * 행 r, 열 c의 가운데 정렬 markdown 표 문자열 생성.
 * 1행은 헤더(빈 셀), 2행은 정렬 구분자(`:---:`), 이후 r-1개의 빈 본문 행.
 */
function buildMarkdownTable(r: number, c: number): string {
  const empty = '|' + Array(c).fill('   ').join(' | ') + ' |';
  const align = '|' + Array(c).fill(':---:').join(' | ') + ' |';
  const bodyRows = Math.max(0, r - 1);
  const body = bodyRows > 0 ? Array(bodyRows).fill(empty).join('\n') + '\n' : '';
  // GFM 표는 앞뒤에 blank line 필요 → 양쪽에 \n\n 보장
  return `\n\n${empty}\n${align}\n${body}\n`;
}

// ═══════════════════════════════════════════════
// OverflowItems — 가용 폭 부족 시 우측 끝부터 display:none
// ═══════════════════════════════════════════════

function OverflowItems({
  items, leftWidth, rootRef,
}: {
  items: { key: string; node: React.ReactNode }[];
  leftWidth: number;
  rootRef: React.RefObject<HTMLDivElement>;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cachedWidthsRef = useRef<number[]>([]);
  const [hideCount, setHideCount] = useState(0);

  // children 폭 캐싱 (모두 보일 때 한 번)
  useLayoutEffect(() => {
    if (cachedWidthsRef.current.length === items.length) return;
    const widths = itemRefs.current.map((r) => r?.offsetWidth || 0);
    if (widths.every((w) => w > 0)) {
      cachedWidthsRef.current = widths;
    }
  });

  // root 폭 변화 + leftWidth 변화 시 hideCount 재계산
  useLayoutEffect(() => {
    if (!rootRef.current) return;
    const root = rootRef.current;

    const recalc = () => {
      const widths = cachedWidthsRef.current;
      if (widths.length === 0) return;
      const rootW = root.clientWidth;
      const gap = 4;
      const padding = 16; // 여유 + 가운데 구분선
      const available = rootW - leftWidth - padding;
      let total = widths.reduce((a, b) => a + b + gap, -gap);
      let hide = 0;
      while (total > available && hide < widths.length) {
        total -= widths[widths.length - 1 - hide] + gap;
        hide++;
      }
      setHideCount(hide);
    };

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(root);
    return () => ro.disconnect();
  }, [leftWidth, rootRef, items.length]);

  const visibleEnd = items.length - hideCount;

  return (
    <div ref={wrapRef} style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1, minWidth: 0 }}>
      {items.map((it, i) => (
        <div
          key={it.key}
          ref={(el) => { itemRefs.current[i] = el; }}
          style={{ display: i < visibleEnd ? 'flex' : 'none', alignItems: 'center' }}
        >
          {it.node}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════
// 메인
// ═══════════════════════════════════════════════

export default function UnifiedToolbar({
  cursorInMath,
  showToolbar,
  onInsert,
  snippets,
  onSnippetInsert,
  onSnippetAdd,
  onSnippetEdit,
  onSnippetDelete,
  searchOpen,
  onToggleSearch,
  proofreading,
  onRunProofread,
  ocrLoading,
  onOcrClick,
  blockTypes,
  onAddBlock,
  onSplitBlock,
  canSplitBlock,
  onSplitMathLines,
  onAIComplete,
  aiLoading,
}: UnifiedToolbarProps) {
  const [snippetMenuOpen, setSnippetMenuOpen] = useState(false);
  const snippetBtnRef = useRef<HTMLButtonElement>(null);
  const [tableDialogOpen, setTableDialogOpen] = useState(false);

  const insertInlineMath = () => onInsert('$$', 1);
  const insertBlockMath = () => onInsert('$$\n\n$$', 3);

  const insertTable = (rows: number, cols: number) => {
    const md = buildMarkdownTable(rows, cols);
    onInsert(md, md.length);
    setTableDialogOpen(false);
  };

  const rootRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const [leftWidth, setLeftWidth] = useState(0);

  // 좌측 폭 측정 — cursorInMath / MathToolbar 펼침 등 변화 모두 감지
  useLayoutEffect(() => {
    if (!leftRef.current) return;
    const el = leftRef.current;
    const update = () => setLeftWidth(el.offsetWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [cursorInMath]);

  // 우측 도구 — 좌→우 순서. 끝부터 우선 hide.
  const divider = (key: string) => (
    <div key={key} style={{ width: 1, height: 20, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
  );

  const rightItems: { key: string; node: React.ReactNode }[] = [
    {
      key: 'snippet',
      node: (
        <>
          <IconButton
            title="상용구"
            onClick={() => setSnippetMenuOpen((v) => !v)}
            active={snippetMenuOpen}
            buttonRef={snippetBtnRef}
          >
            <SnippetIcon />
          </IconButton>
          {snippetMenuOpen && (
            <MathSnippetMenu
              snippets={snippets}
              onInsert={onSnippetInsert}
              onAdd={onSnippetAdd}
              onEdit={onSnippetEdit}
              onDelete={onSnippetDelete}
              anchorRef={snippetBtnRef}
              onClose={() => setSnippetMenuOpen(false)}
            />
          )}
        </>
      ),
    },
    { key: 'special', node: <SpecialCharDropdown onInsert={onInsert} /> },
    { key: 'emoji', node: <EmojiPickerDropdown onInsert={onInsert} /> },
    {
      key: 'table',
      node: (
        <IconButton title="표 삽입" onClick={() => setTableDialogOpen(true)}>
          <TableAddIcon />
        </IconButton>
      ),
    },
    {
      key: 'ocr',
      node: (
        <IconButton title="수식 읽기" onClick={onOcrClick} disabled={ocrLoading}>
          {ocrLoading ? <IconLoader size={14} /> : <OcrIcon />}
        </IconButton>
      ),
    },
    { key: 'd1', node: divider('d1') },
    {
      key: 'proofread',
      node: (
        <IconButton title="맞춤법 검사 (현재 탭)" onClick={onRunProofread} disabled={proofreading}>
          {proofreading ? <IconLoader size={14} /> : <ProofreadIcon />}
        </IconButton>
      ),
    },
    {
      key: 'search',
      node: (
        <IconButton title="찾기 / 바꾸기 (Ctrl+F)" onClick={onToggleSearch} active={searchOpen}>
          <SearchReplaceIcon />
        </IconButton>
      ),
    },
    { key: 'd2', node: divider('d2') },
    {
      key: 'addBlock',
      node: (
        <BlockAddDropdown blockTypes={blockTypes} onAddBlock={onAddBlock} disabled={!showToolbar} />
      ),
    },
    {
      key: 'splitBlock',
      node: (
        <IconButton title="블록 분할 (⌘B)" onClick={onSplitBlock} disabled={!canSplitBlock}>
          <BlockSplitIcon />
        </IconButton>
      ),
    },
    {
      key: 'splitMath',
      node: (
        <IconButton title="수식행 분할 (⌘⇧L)" onClick={onSplitMathLines}>
          <FormulaSplitIcon />
        </IconButton>
      ),
    },
    {
      key: 'ai',
      node: (
        <IconButton title="AI 완성 (⌘J)" onClick={onAIComplete} disabled={aiLoading}>
          {aiLoading ? <IconLoader size={14} /> : <AiMathGenIcon />}
        </IconButton>
      ),
    },
  ];

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        opacity: showToolbar ? 1 : 0.35,
        pointerEvents: showToolbar ? 'auto' : 'none',
        transition: 'opacity 0.15s',
        flex: 1,
        minWidth: 0,
      }}
    >
      {/* ── 좌측: 컨텍스트 영역 (항상 보임, 자기 폭 유지) ── */}
      <div ref={leftRef} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {cursorInMath ? (
          <>
            {/* Phase 40: 수식 기호 팔레트 (단일 패널 + 탭 + KaTeX 하이브리드 렌더) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
              <MathSymbolPalette onInsert={onInsert} />
            </div>
          </>
        ) : (
          <>
            <IconButton title="인라인 수식 ($…$)" onClick={insertInlineMath}>
              <InlineMathIcon />
            </IconButton>
            <IconButton title="블록 수식 ($$…$$)" onClick={insertBlockMath}>
              <BlockMathIcon />
            </IconButton>
          </>
        )}
        {/* 가운데 구분선 */}
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-light)', margin: '0 6px' }} />
      </div>

      {/* ── 우측: overflow 처리 ── */}
      <OverflowItems items={rightItems} leftWidth={leftWidth} rootRef={rootRef} />

      {/* 표 삽입 다이얼로그 (fixed overlay) */}
      <TableInsertDialog
        open={tableDialogOpen}
        onClose={() => setTableDialogOpen(false)}
        onConfirm={insertTable}
      />
    </div>
  );
}
