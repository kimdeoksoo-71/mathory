'use client';

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { ProblemWithBlocks, TabMeta, DEFAULT_TABS, Folder } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, TRASH_FOLDER_ID } from '../../lib/firestore';
import { getFolderPath } from '../../lib/folder-tree';
import { DIFFICULTIES, CATEGORY_OPTIONS } from '../../lib/constants';
import TabBody, { LABEL_GAP_EM, CARD_PAD_L, CARD_PAD_R } from './TabBody';
import PdfDialog from './PdfDialog';
import CopyrightPanel from './CopyrightPanel';
import BlockchainBadge from '../ui/BlockchainBadge';
import useAuth from '../../hooks/useAuth';
import { useDrawerResize } from '../../hooks/useDrawerResize';
import DrawerResizeHandle from '../ui/DrawerResizeHandle';
import { printProblemPdf, PdfPrintTab } from '../../lib/pdfPrint';
import ShareSettingsPanel from '../share/ShareSettingsPanel';
import CommentPanel from '../comment/CommentPanel';
import { buildReportMarkdown } from '../comment/VerifyReportCard';
import { runVerifyFlow, verifyCharCountOf } from '../../lib/verifyFlow';
import { blockKeyOf } from '../../lib/caseBlock';
import { findQuoteRange } from '../../lib/verify/parse';
import { buildMathIndex, findMathIdAtCursor } from '../../lib/mathIndex';
import { fastScrollTo } from '../../lib/editorScroll';
import { getUserProfile } from '../../lib/users';
import { watchAllComments, countComments, countAgentSessions } from '../../lib/comments';
import { listSessions } from '../../lib/discussion-sessions';
import { canComment as canCommentOnProblem } from '../../lib/membership';
import { UserProfile, ProblemComment, DiscussionSession, VerifyKind } from '../../types/problem';
import {
  IconEdit, IconRename, IconFolderMove, IconTrash, IconCopy, IconDownload, IconShare,
  IconDocLines,
  IconChevron, IconChevronLeft,
} from '../ui/Icons';
import { alertDialog } from '../../lib/dialogs';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const FONT_SIZE_MIN = 11;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;

/* ═══ 개선묶음 M2 D — 본문 가로폭 조절 (D24′) ═══
   기본 35em은 현행 폭 그대로다. 최소도 35 — "현재 폭을 최소 한계로" 라는 요구(메모).
   최대 45em: 50em이면 댓글 패널(기본 420)과 동시 사용 시 1725px가 필요해 실사용 창을 넘는다. */
const WIDTH_EM_KEY = 'mathory-problem-width-em';
const WIDTH_EM_DEFAULT = 35;
const WIDTH_EM_MIN = 35;
const WIDTH_EM_MAX = 45;

/* ═══ 스크롤 자동접힘 (D52 · v3 W9) ═══
   순방향 T1을 넘으면 제목행을 슬림 바로 접고, DELAY_MS 뒤에 문제 카드를 접는다.
   역방향은 T2(최상단)에서 역순 복원. T1 ≠ T2가 히스테리시스다.
   튜닝 허용 범위: T1 60~120 · DELAY 200~500 · COOLDOWN 300~600. 밖으로 나가면 문서도 갱신할 것. */
const M2_COLLAPSE = { T1: 80, T2: 8, DELAY_MS: 300, COOLDOWN_MS: 400 };

/** 제목행 높이 — 펼침(현행 98) / 접힘(슬림 바). D50: height 애니메이션이라 둘 다 px 확정값이어야 한다. */
const HEADER_H = { open: 98, slim: 36 };

/** 가운데 영역의 좌우 바깥 여백. D22′ — 카드가 좌우 76px을 더하므로 32 → 16으로 낮춰
 *  순증을 +44px로 억제한다. 바탕이 아이보리라 여백이 줄어도 답답해지지 않는다. */
const OUTER_PAD = 16;

interface ProblemViewProps {
  problemId: string;
  folders: Folder[];
  onRename?: (problem: ProblemWithBlocks) => void;
  onEdit?: (problem: ProblemWithBlocks) => void;
  onDuplicate?: (problem: ProblemWithBlocks) => void;
  onMoveFolder?: (problem: ProblemWithBlocks) => void;
  onTrash?: (problem: ProblemWithBlocks) => void;
  onUpdated?: () => void;
  onNavigateFolder?: (folderId: string) => void;
  // Phase 49: 공유 대상 관리 모달 열기 (AppShell의 ShareTargetModal)
  onManageShare?: (problem: ProblemWithBlocks) => void;
}

function formatDate(d?: Date): string {
  if (!d) return '';
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDateTime(d?: Date): string {
  if (!d) return '';
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} : ${hh}-${mi}-${ss}`;
}

/** 하단 정보 한 줄: [라벨(고정 폭)] [값] — 라벨 폭 통일로 값 시작 x 정렬 */
function BottomRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 6, fontSize: 11, color: 'var(--text-muted)',
      fontFamily: 'var(--font-ui)',
    }}>
      <span style={{ color: 'var(--text-faint)', width: 52, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

/** 문제정보 한 줄: [라벨 ......... [값(고정 폭, 우측 정렬)]] */
function CompactRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', fontSize: 12,
      fontFamily: 'var(--font-ui)',
      color: 'var(--text-muted)',
    }}>
      <span style={{ color: 'var(--text-faint)', flex: 1 }}>{label}</span>
      <div style={{
        width: 130, flexShrink: 0,
        display: 'flex', justifyContent: 'flex-end',
      }}>
        {children}
      </div>
    </div>
  );
}

export default function ProblemView({
  problemId, folders, onRename, onEdit, onDuplicate, onTrash, onUpdated, onNavigateFolder, onManageShare,
}: ProblemViewProps) {
  const { user } = useAuth();
  const [problem, setProblem] = useState<ProblemWithBlocks | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentFontSize, setContentFontSize] = useState(FONT_SIZE_DEFAULT);
  const [openTabs, setOpenTabs] = useState<Record<string, boolean>>({});
  /* D24′ — 본문 가로폭(em). 전역 영속(문항별 아님). 키 관례는 하이픈이다(FONT_SIZE_KEY와 동일). */
  const [widthEm, setWidthEm] = useState(WIDTH_EM_DEFAULT);
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(WIDTH_EM_KEY));
      if (v >= WIDTH_EM_MIN && v <= WIDTH_EM_MAX) setWidthEm(v);
    } catch {}
  }, []);
  const handleWidthChange = (delta: number) => {
    setWidthEm((prev) => {
      const next = Math.min(WIDTH_EM_MAX, Math.max(WIDTH_EM_MIN, prev + delta));
      try { localStorage.setItem(WIDTH_EM_KEY, String(next)); } catch {}
      return next;
    });
  };

  /* D25′·D27′ — 제목행 슬림 여부 · 문제 카드 접힘. 둘 다 비영속(세션 내 상태). */
  const [headerSlim, setHeaderSlim] = useState(false);
  const [questionCollapsed, setQuestionCollapsed] = useState(false);
  /* 사용자가 직접 토글했으면 최상단 복귀까지 자동접힘을 보류한다(D27′). */
  const manualQuestionRef = useRef(false);
  /* sticky 문제 행의 실측 높이 → 풀이 라벨 열의 sticky top (D51 · v3 W7) */
  const questionRowRef = useRef<HTMLDivElement>(null);
  const [qStickyH, setQStickyH] = useState(0);
  /** Phase 61b: 리포트 지적 → 블록 스크롤 대상 */
  const contentScrollRef = useRef<HTMLDivElement>(null);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Phase 40: 폴더 라벨 hover 시 상위 폴더 경로 펼침
  // 레이아웃 폭은 절대 불변(라벨 박스 7em 고정) → 제목은 transform 슬라이드, 경로는 absolute 오버레이.
  // (가운데 컨테이너가 width:fit-content + margin:auto라 폭이 커지면 좌측으로 재정렬되므로 폭 불변이 필수)
  const [folderPathHover, setFolderPathHover] = useState(false);
  const folderPathRef = useRef<HTMLDivElement>(null);   // 경로 자연폭 측정
  const labelBoxRef = useRef<HTMLDivElement>(null);     // 라벨 박스(7em) 실폭 측정
  const [titleSlide, setTitleSlide] = useState(0);      // 제목을 우측으로 밀 px
  // 제목 슬라이드량 = 경로가 라벨 박스(7em)를 넘어서는 폭 (경로폭 - 라벨박스폭)
  useEffect(() => {
    if (folderPathRef.current) {
      const pathW = folderPathRef.current.scrollWidth;
      const boxW = labelBoxRef.current?.offsetWidth ?? 0;
      setTitleSlide(Math.max(0, pathW - boxW));
    }
  }, [problem, folders]);

  // Phase 1.5: 문제정보 펼침 상태 (localStorage 기억, 기본 접힘)
  const PROBLEM_INFO_KEY = 'mathory-problem-info-open';
  const [problemInfoOpen, setProblemInfoOpen] = useState(false);
  useEffect(() => {
    try {
      const stored = localStorage.getItem(PROBLEM_INFO_KEY);
      if (stored === '1') setProblemInfoOpen(true);
    } catch {}
  }, []);
  const toggleProblemInfo = () => {
    setProblemInfoOpen((v) => {
      const next = !v;
      try { localStorage.setItem(PROBLEM_INFO_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };
  // 저자 프로필
  const [authorProfile, setAuthorProfile] = useState<UserProfile | null>(null);
  // Phase 47: 패널 모드 — 'comments'(댓글) | 'agent' | null(닫힘)
  const [panelMode, setPanelMode] = useState<'comments' | 'agent' | null>(null);
  // Phase 44 → Phase 62 D11: 댓글 패널 드래그 리사이즈 (우측). 기본 420px (75% of 560)
  const comment = useDrawerResize({
    defaultWidth: 420, min: 360, max: () => window.innerWidth * 0.9, anchor: 'right',
  });
  // Phase 62 D13 — 우측 단(탭·메뉴·메타)도 같은 문법으로 조절한다. 메뉴 열이라 폭 수치는 별도.
  const rightCol = useDrawerResize({ defaultWidth: 220, min: 150, max: 360, anchor: 'right' });
  const panelDragging = comment.dragging || rightCol.dragging;
  const [allComments, setAllComments] = useState<ProblemComment[]>([]);
  const [sessions, setSessions] = useState<DiscussionSession[]>([]);
  const commentSessionId = useMemo(
    () => sessions.find((s) => s.type === 'comment')?.id ?? null,
    [sessions],
  );
  const commentCount = useMemo(
    () => countComments(allComments, commentSessionId, { unresolvedOnly: true }),
    [allComments, commentSessionId],
  );
  const agentCount = useMemo(() => countAgentSessions(sessions), [sessions]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  /* Phase 62 D16(결정 2) — 댓글·agent 패널이 열려 있는 동안 우측 단은 존재하지 않는다.
     패널(min 360)이 단(max 360)을 완전히 덮어, 남겨 두면 보이지 않는 열과 그 위에 뜨는
     핸들(zIndex 100 > 패널 50)·무의미한 토글 버튼이 생긴다. */
  const rightColShown = rightOpen && !panelMode;

  /* ─── 데이터 로드 ─── */
  const load = useCallback(async () => {
    setLoading(true);
    const data = await getProblemWithBlocks(problemId);
    setProblem(data);
    if (data) {
      const tabs = data.tabs || DEFAULT_TABS;
      // 기본: 모든 탭 펼침
      const next: Record<string, boolean> = {};
      tabs.forEach((t) => { next[t.id] = true; });
      setOpenTabs(next);
      // 저자 프로필 로드 (실패는 조용히 무시)
      if (data.authorUid) {
        getUserProfile(data.authorUid).then(setAuthorProfile).catch(() => setAuthorProfile(null));
      }
    }
    setLoading(false);
  }, [problemId]);

  useEffect(() => { load(); }, [load]);

  // 댓글 실시간 구독 — 삭제·추가가 즉시 반영되도록 (권한 오류는 조용히 빈 배열)
  useEffect(() => {
    if (!problemId) return;
    let unsub: (() => void) | null = null;
    try {
      unsub = watchAllComments(problemId, setAllComments);
    } catch {
      setAllComments([]);
    }
    return () => { if (unsub) unsub(); };
  }, [problemId]);

  // Phase 47: 세션 목록 (댓글 세션 id · agent 카운트용). 패널 닫을 때 갱신.
  const loadSessions = useCallback(() => {
    if (!problemId) return;
    listSessions(problemId).then(setSessions).catch(() => setSessions([]));
  }, [problemId]);
  useEffect(() => { loadSessions(); }, [loadSessions]);

  /* ─── 글꼴 크기 로드 ─── */
  useEffect(() => {
    const stored = localStorage.getItem(FONT_SIZE_KEY);
    if (stored) {
      const n = parseInt(stored, 10);
      if (!isNaN(n) && n >= 11 && n <= 24) setContentFontSize(n);
    }
    const handleStorage = (e: StorageEvent) => {
      if (e.key === FONT_SIZE_KEY && e.newValue) {
        const n = parseInt(e.newValue, 10);
        if (!isNaN(n)) setContentFontSize(n);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  /* ─── 글꼴 크기 조절 ─── */
  const handleFontSizeChange = (delta: number) => {
    setContentFontSize((prev) => {
      const next = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, prev + delta));
      localStorage.setItem(FONT_SIZE_KEY, String(next));
      return next;
    });
  };

  /* ─── 탭 토글 ─── */
  const toggleTab = (tabId: string) => {
    /* D25′ — 문제 탭 라벨 클릭은 "탭 열고 닫기"가 아니라 **접힘 미리보기 토글**이다.
       (수동 조작은 최상단으로 돌아갈 때까지 자동접힘을 이긴다) */
    if (tabId === 'question') {
      manualQuestionRef.current = true;
      setQuestionCollapsed((v) => !v);
      return;
    }
    setOpenTabs((prev) => ({ ...prev, [tabId]: !prev[tabId] }));
  };

  /* ═══ Phase 61b: 정밀 검증 (열람뷰) ═══
     편집창과 같은 흐름(`lib/verifyFlow.ts`)을 쓴다. 여기서는 항상 저장본이므로
     편집창에 있는 "dirty면 저장 먼저" 단계가 없다 — 그것이 유일한 차이다. */
  const verifyCharCount = useCallback(
    (kind: VerifyKind) => (problem ? verifyCharCountOf(problem.tabBlocks, kind) : 0),
    [problem],
  );

  const handleRunVerify = useCallback(async (kind: VerifyKind, sessionId: string) => {
    if (!problem || !user) throw new Error('문항 정보를 불러오지 못했습니다');
    const { report, commentId } = await runVerifyFlow({
      kind, problemId: problem.id, sessionId,
      tabId: (problem.tabs || DEFAULT_TABS)[0]?.id || 'question',
      idToken: await user.getIdToken(),
      tabs: problem.tabs || DEFAULT_TABS,
      blocksByTab: problem.tabBlocks,
      title: problem.title, answer: problem.answer || '',
      tabLoadErrors: problem.tabLoadErrors,
      buildMarkdown: buildReportMarkdown,
    });
    setProblem((prev) => (prev ? {
      ...prev,
      verification: {
        ...(prev.verification || {}),
        [kind]: {
          verdict: report.verdict, verifiedAt: report.verifiedAt,
          contentHash: '', stale: false, reportCommentId: commentId,
        },
      },
    } : prev));
  }, [problem, user]);

  /**
   * 리포트 지적 → 그 인용 자리로. 앵커는 block_key다 — doc id는 저장마다 갈린다.
   *
   * 편집창과 달리 CodeMirror가 없으므로 강조는 DOM에 직접 건다:
   *   인용이 수식이면 그 `.katex`에 `math-highlight-active`(편집창 미리보기와 같은 클래스),
   *   산문이면 블록 자체를 잠깐 비춘다.
   * ⚠ 열람뷰는 탭이 접혀 있을 수 있다 → 먼저 펴고 렌더를 기다린 뒤 스크롤한다.
   */
  /** 검증 계열 게이트. ⚠ `isOwnerView`는 authorUid 없는 레거시 문항을 오너로 치는데,
   *  규칙상 그런 문항은 AI 댓글 작성이 막힌다 → 여기서는 authorUid 일치를 요구한다
   *  (CommentPanel의 칩 게이트 `currentUid === ownerUid`와 같은 기준). */
  const isVerifyOwner = !!user && !!problem?.authorUid && problem.authorUid === user.uid;

  const handleJumpToBlock = useCallback((blockKey: string, quote: string) => {
    if (!problem) return;
    for (const tab of (problem.tabs || DEFAULT_TABS)) {
      const blk = (problem.tabBlocks[tab.id] || []).find((b) => blockKeyOf(b) === blockKey);
      if (!blk) continue;
      if (!openTabs[tab.id]) setOpenTabs((prev) => ({ ...prev, [tab.id]: true }));

      // 인용이 몇 번째 수식인지 (raw_text 기준 — 미리보기의 data-math-id와 같은 순서)
      const range = findQuoteRange(blk.raw_text || '', quote);
      const mathId = range
        ? findMathIdAtCursor(buildMathIndex(blk.raw_text || ''), range.from)
        : -1;

      setTimeout(() => {
        requestAnimationFrame(() => {
          const container = contentScrollRef.current;
          const el = container?.querySelector(`[data-block-id="${blk.id}"]`) as HTMLElement | null;
          if (!container || !el) return;

          // 이전 강조 정리 (연속 클릭 시 두 곳이 동시에 켜지지 않게)
          container.querySelectorAll('.math-highlight-active')
            .forEach((c) => c.classList.remove('math-highlight-active'));
          container.querySelectorAll('.verify-jump-flash')
            .forEach((c) => c.classList.remove('verify-jump-flash'));

          const mathEl = mathId >= 0
            ? el.querySelector(`.katex[data-math-id="${mathId}"]`) as HTMLElement | null
            : null;
          const target = mathEl ?? el;
          (mathEl ?? el).classList.add(mathEl ? 'math-highlight-active' : 'verify-jump-flash');

          /* 강조 대상을 화면 세로 중앙에 (화면보다 크면 상단 기준).
             ⚠ D29′ — sticky 문제 행이 상단을 덮으므로 그만큼 더 올려야 대상이 그 뒤로
               숨지 않는다. 중앙 정렬이라 대개는 안전하지만, 화면보다 큰 블록은 상단
               기준(−80)이라 정확히 그 자리에서 가려진다. */
          const stickyH = questionRowRef.current?.offsetHeight ?? 0;
          const r = target.getBoundingClientRect();
          const cr = container.getBoundingClientRect();
          const top = r.height < cr.height - stickyH
            ? r.top - cr.top + container.scrollTop + r.height / 2 - (cr.height + stickyH) / 2
            : r.top - cr.top + container.scrollTop - 80 - stickyH;
          fastScrollTo(container, Math.max(0, top), 300);

          // 수식 강조는 잠깐만 — 남아 있으면 "지금 여기"라는 신호가 죽는다
          if (mathEl) {
            window.setTimeout(() => mathEl.classList.remove('math-highlight-active'), 4000);
          }
        });
      }, 60);
      return;
    }
  }, [problem, openTabs]);

  /* ═══ D51 — sticky 문제 행의 높이를 CSS 변수로 (풀이 라벨 열의 sticky top) ═══
     ResizeObserver를 상시 돌리지 않는다(Q10 우려). 값이 달라질 수 있는 계기에만 1회 잰다:
     문제 카드 접힘 토글 · 글꼴 크기 · 본문 폭 · 문항 로드. */
  const lastQHRef = useRef(0);
  useLayoutEffect(() => {
    const h = questionRowRef.current?.offsetHeight ?? 0;
    setQStickyH(h);

    /* D27′ — 문제 카드 높이가 급변하면 아래 내용이 그만큼 위로 올라와 화면이 튄다.
       (sticky라 화면 위쪽에 고정돼 있어도 **흐름상의 자리**는 문서 최상단이므로
        그 높이가 줄면 아래가 전부 당겨 올라온다.)
       useOutlineState의 keepAnchor와 같은 처방 — 델타만큼 scrollTop을 되돌린다.
       ⚠ 다만 T1 아래로는 내리지 않는다. 그대로 보정하면 접힘 직후 scrollTop이
         임계값 밑으로 떨어져 자동으로 다시 펼쳐지고, 그 진동이 반복된다. */
    const prev = lastQHRef.current;
    lastQHRef.current = h;
    const el = contentScrollRef.current;
    if (el && prev && h && prev !== h && el.scrollTop > 0) {
      const delta = prev - h;
      el.scrollTop = Math.max(M2_COLLAPSE.T1 + 1, el.scrollTop - delta);
    }
  }, [questionCollapsed, contentFontSize, widthEm, problem, openTabs]);

  /* ═══ D27′ — 스크롤 자동접힘 (문제 탭만) ═══
     순방향: T1 초과 → 제목행 슬림 → DELAY_MS 뒤 문제 카드 접힘.
     역방향: T2 이하(최상단) → 문제 펼침 → 제목행 복원.
     ⚠ 히스테리시스: T1 ≠ T2 + 쿨다운. 없으면 경계 스크롤에서 진동한다.
     ⚠ 제목행 접힘은 scrollTop을 바꾸지 않고 컨테이너 clientHeight만 키운다 →
       스크롤 여유가 없으면 브라우저가 scrollTop을 클램프해 다시 T1 아래로 떨어뜨린다.
       하단 스페이서(70vh)가 그것을 막는다 — **스페이서를 줄이거나 없애지 말 것**(D28′).
     ⚠ 사용자가 라벨을 눌러 직접 토글했으면 최상단 복귀까지 자동접힘을 보류한다. */
  const collapseTimerRef = useRef<number | null>(null);
  const lastFlipRef = useRef(0);
  const handleContentScroll = useCallback(() => {
    const el = contentScrollRef.current;
    if (!el) return;
    const y = el.scrollTop;
    const now = performance.now();

    if (y > M2_COLLAPSE.T1) {
      if (!headerSlim && now - lastFlipRef.current > M2_COLLAPSE.COOLDOWN_MS) {
        lastFlipRef.current = now;
        setHeaderSlim(true);
        if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = window.setTimeout(() => {
          if (!manualQuestionRef.current) setQuestionCollapsed(true);
        }, M2_COLLAPSE.DELAY_MS);
      }
    } else if (y <= M2_COLLAPSE.T2) {
      if (collapseTimerRef.current) { window.clearTimeout(collapseTimerRef.current); collapseTimerRef.current = null; }
      manualQuestionRef.current = false;            // 최상단 복귀 = 수동 조작 해제
      if (questionCollapsed) setQuestionCollapsed(false);
      if (headerSlim && now - lastFlipRef.current > M2_COLLAPSE.COOLDOWN_MS) {
        lastFlipRef.current = now;
        setHeaderSlim(false);
      }
    }
  }, [headerSlim, questionCollapsed]);
  useEffect(() => () => {
    if (collapseTimerRef.current) window.clearTimeout(collapseTimerRef.current);
  }, []);

  /* ─── 탭 Markdown 복사 ─── */
  const handleCopyTabMarkdown = async (tabId: string) => {
    if (!problem) return;
    const blocks = problem.tabBlocks[tabId] || [];
    const markdown = blocks.map((b) => b.raw_text).join('\n\n');
    try {
      await navigator.clipboard.writeText(markdown);
      setCopiedTab(tabId);
      setTimeout(() => setCopiedTab(null), 2000);
    } catch (err) {
      console.error('클립보드 복사 실패:', err);
    }
  };

  /* ─── 메타 인라인 편집 (undefined 는 빈 문자열로 변환 — Firestore가 undefined 거부) ─── */
  const updateField = async (patch: Record<string, any>) => {
    if (!problem) return;
    const clean: Record<string, any> = {};
    for (const k in patch) {
      clean[k] = patch[k] === undefined ? '' : patch[k];
    }
    setProblem({ ...problem, ...clean } as ProblemWithBlocks);
    try {
      await updateProblem(problem.id, clean as any);
      onUpdated?.();
    } catch (err) {
      console.error('저장 실패:', err);
    }
  };

  /* ─── MD 다운로드 ─── */
  const handleDownloadMarkdown = () => {
    if (!problem) return;
    const tabs = problem.tabs || DEFAULT_TABS;
    let md = `# ${problem.title}\n\n`;
    for (const tab of tabs) {
      const blocks = problem.tabBlocks[tab.id] || [];
      if (blocks.length === 0) continue;
      md += `## ${tab.label}\n\n`;
      md += blocks.map((b) => b.raw_text).join('\n\n');
      md += '\n\n';
    }
    const safeTitle = problem.title.replace(/[\/\\:*?"<>|]/g, '_').trim() || '수학 문제';
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeTitle}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ─── PDF ─── */
  const handlePdfConfirm = async (selectedTabIds: string[]) => {
    if (!problem) return;
    setIsPrinting(true);
    try {
      const tabs = problem.tabs || DEFAULT_TABS;
      const printTabs: PdfPrintTab[] = tabs
        .filter((t) => selectedTabIds.includes(t.id))
        .map((t) => ({
          id: t.id,          // Phase 58 P2 — 인쇄 톤 스코프 판정용
          label: t.label,
          blocks: (problem.tabBlocks[t.id] || []).map((b) => ({
            id: b.id, type: b.type, raw_text: b.raw_text, imageWidth: b.imageWidth,
            imageTreatment: b.imageTreatment, imageGray: b.imageGray,
            svg_initial_view: b.svg_initial_view, svg_height: b.svg_height,
            ggb_initial_coords: b.ggb_initial_coords, ggb_height: b.ggb_height,
          })),
        }));
      await printProblemPdf({ title: problem.title, tabs: printTabs });
    } catch (e) {
      console.error('PDF 생성 오류:', e);
      await alertDialog('PDF 생성 중 오류가 발생했습니다.');
    } finally {
      setTimeout(() => setIsPrinting(false), 1200);
      setPdfOpen(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>로딩 중...</div>;
  }
  if (!problem) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>문제를 찾을 수 없습니다.</div>;
  }

  const allTabs = problem.tabs || DEFAULT_TABS;
  // Stage 2: 멤버는 memberTabVisibility에 따라 일부 탭만 봄. 오너는 항상 모두.
  const isOwnerView = !!user && (!problem.authorUid || user.uid === problem.authorUid);
  const tabs = isOwnerView
    ? allTabs
    : allTabs.filter((t) => problem.memberTabVisibility?.[t.id] !== false);
  const isMemberView = !isOwnerView && !!user && (problem.memberUids?.includes(user.uid) ?? false);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 6,
    padding: '6px 8px',
    fontSize: 13,
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)',
    outline: 'none',
    transition: 'border-color 0.15s, background 0.15s',
    boxSizing: 'border-box',
  };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'var(--accent-primary)';
    e.target.style.background = 'var(--bg-hover)';
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    e.target.style.borderColor = 'transparent';
    e.target.style.background = 'transparent';
  };

  const metaLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: 'var(--text-muted)',
    letterSpacing: 0.3, marginBottom: 4, fontFamily: 'var(--font-ui)',
  };
  const metaRowStyle: React.CSSProperties = { marginBottom: 14 };

  const compactInputStyle = (editable: boolean): React.CSSProperties => ({
    width: '100%',
    border: 'none', background: 'transparent',
    fontSize: 12, color: 'var(--text-primary)',
    fontFamily: 'var(--font-ui)', textAlign: 'right',
    cursor: editable ? 'pointer' : 'default',
    padding: '2px 0', outline: 'none',
    boxSizing: 'border-box',
  });

  interface MenuItem {
    label: string;
    icon: React.ReactNode;
    action: () => void;
    danger?: boolean;
    /** 공유 항목 — 클릭 시 인라인 펼침. > 기호가 우측에 표시되고 ↓로 회전. */
    kind?: 'share' | 'spacer';
  }

  const menuItems: MenuItem[] = isOwnerView ? [
    { label: '편집', icon: <IconEdit size={14} />, action: () => onEdit?.(problem) },
    { label: '사본 만들기', icon: <IconCopy size={14} />, action: () => onDuplicate?.(problem) },
    { label: 'PDF 다운로드', icon: <IconDownload size={14} />, action: () => setPdfOpen(true) },
    { label: 'MD 다운로드', icon: <IconDownload size={14} />, action: handleDownloadMarkdown },
    { label: '휴지통', icon: <IconTrash size={14} />, action: () => onTrash?.(problem), danger: true },
    { label: 'spacer', icon: null, action: () => {}, kind: 'spacer' },
    { label: '공유', icon: <IconShare size={14} />, action: () => setShareOpen((v) => !v), kind: 'share' },
  ] : [
    // 멤버 / 공유받은 사용자: 편집 관련 메뉴 제거. 다운로드는 허용.
    { label: 'PDF 다운로드', icon: <IconDownload size={14} />, action: () => setPdfOpen(true) },
    { label: 'MD 다운로드', icon: <IconDownload size={14} />, action: handleDownloadMarkdown },
  ];


  // ─── 제목바용 계산값 (IIFE에서 컴포넌트 스코프로 호이스팅) ───
  const fid = problem.folder_id || '';
  const isTrash = fid === TRASH_FOLDER_ID;
  const folderLabel = isTrash ? '휴지통' : (folders.find((f) => f.id === fid)?.name || '미분류');
  const targetId = isTrash ? TRASH_FOLDER_ID : (fid || '__unassigned__');
  const folderPath = (!isTrash && fid) ? getFolderPath(folders, fid) : [];
  const hasAncestors = folderPath.length > 1;
  const expanded = folderPathHover && hasAncestors;
  /* D40″ — 제목행 gap을 TabBody와 **같은 식**으로 통일한다.
     Phase 59a가 TabBody만 2.8em으로 비례화하고 제목행은 28px 고정으로 남겨 둬,
     제목 좌단(165@15)과 탭 본문 좌단(179@15)이 이미 14px 어긋나 있었다(fs24에서 39px).
     여기서 잠복 비정합까지 함께 해소한다. */
  const LABEL_GAP = LABEL_GAP_EM * contentFontSize;
  const labelColStyle: React.CSSProperties = {
    width: 7 * contentFontSize, flexShrink: 0,
    textAlign: 'left', fontFamily: 'var(--font-ui)',
  };
  /* ⚠ TabBody의 사본과 **같은 값**이어야 한다(D24″) — 제목과 카드 우단이 함께 움직인다. */
  const mainColStyle: React.CSSProperties = {
    width: widthEm * contentFontSize, flexShrink: 0,
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0, width: '100%',
      background: 'var(--bg-functional)', fontSize: contentFontSize,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ 제목바: U자 밖 아이보리 chrome — [폴더경로 | 제목]. 아래 빈 공간은 추후 메타데이터 ═══ */}
      {/* D50 — 접힘은 **height 애니메이션**이다(transform 금지: 공간을 회수하지 못한다).
          제목행은 스크롤 컨테이너의 형제라 높이가 바뀌어도 sticky top 계산에 영향이 없다.
          ⚠ 접힘 상태에서는 EditorView와의 가로 경계선 Y 정렬(98)이 의도적으로 깨진다
            — 배경 차이를 감수한 E-M2-2와 같은 범위의 수용이다(v3 W10). */}
      <div style={{
        flexShrink: 0, background: 'var(--bg-functional)',
        height: headerSlim ? HEADER_H.slim : HEADER_H.open,
        overflow: 'hidden',
        paddingRight: panelMode ? `calc(${comment.width}px + 8px)` : 0,
        transition: panelDragging ? 'none' : 'padding-right 0.18s ease, height 0.2s ease',
        display: 'flex', justifyContent: 'center',
        alignItems: headerSlim ? 'center' : 'flex-start',
        borderBottom: headerSlim ? '0.5px solid var(--border-light)' : 'none',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: LABEL_GAP,
          padding: headerSlim ? `0 ${OUTER_PAD}px` : `22px ${OUTER_PAD}px 0`,
          boxSizing: 'border-box',
        }}>
          {/* 헤더 라벨 박스 — 폭 7em 고정. 경로는 absolute 오버레이, 제목은 transform 슬라이드 */}
          {/* ⚠ 슬림에서도 이 박스는 **자리를 지킨다**(opacity만 0) — 폭이 사라지면
              제목 좌단이 좌측으로 튀어 접힘/펼침에서 제목이 가로로 움직인다(D40″). */}
          <div
            ref={labelBoxRef}
            onMouseEnter={() => { if (hasAncestors && !headerSlim) setFolderPathHover(true); }}
            onMouseLeave={() => setFolderPathHover(false)}
            style={{
              opacity: headerSlim ? 0 : 1,
              pointerEvents: headerSlim ? 'none' : 'auto',
              transition: 'opacity 0.15s',
              ...labelColStyle,
              position: 'relative', height: '1.5em',
              display: 'flex', alignItems: 'center',
            }}
          >
            {/* 접힘: ‹ leaf 폴더명 */}
            <div
              onClick={() => onNavigateFolder?.(targetId)}
              style={{
                position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                display: 'inline-flex', alignItems: 'center', gap: 2,
                fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap', cursor: 'pointer',
                opacity: expanded ? 0 : 1, pointerEvents: expanded ? 'none' : 'auto',
                transition: 'opacity 0.15s, color 0.15s',
                maxWidth: '7em', overflow: 'hidden', textOverflow: 'ellipsis',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
              title={hasAncestors ? '폴더로 이동 (hover 시 전체 경로)' : '폴더로 이동'}
            >
              <IconChevronLeft size={14} />
              {folderLabel}
            </div>
            {/* 펼침: 전체 경로 (측정용으로 항상 렌더, 평소 opacity 0) */}
            {hasAncestors && (
              <div
                ref={folderPathRef}
                style={{
                  position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap',
                  opacity: expanded ? 1 : 0, pointerEvents: expanded ? 'auto' : 'none',
                  transition: 'opacity 0.2s',
                  background: 'var(--bg-functional)', paddingRight: 8, zIndex: 2,
                }}
              >
                {folderPath.map((seg, i) => (
                  <span key={seg.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {i > 0 && <span style={{ color: 'var(--text-faint)' }}>/</span>}
                    <span
                      onClick={() => onNavigateFolder?.(seg.id)}
                      style={{
                        cursor: 'pointer', transition: 'color 0.15s',
                        fontWeight: i === folderPath.length - 1 ? 600 : 400,
                      }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'; }}
                      title={`${seg.name}(으)로 이동`}
                    >
                      {seg.name}
                    </span>
                  </span>
                ))}
              </div>
            )}
          </div>
          {/* D39′ — 슬림 바는 **축약 제목 + 버튼**이다(A안=버튼만은 폐기).
              버튼만 남기면 그 버튼이 무엇에 속한 것인지 읽히지 않고, 스크롤 중에
              지금 보는 문항이 무엇인지도 알 수 없다(v2 D-16 실물 스케치).
              ⚠ 구현 함정 2건(v2 D-17): ① text-overflow는 flex 컨테이너가 아니라
                **텍스트를 담은 자식**에 걸어야 말줄임이 나온다 ② 긴 제목이 폭을 다 먹으면
                버튼이 밀려나 사라진다 → .btns에 flexShrink:0, 컨테이너에 minWidth:0.
              ⚠ 폭·좌단은 펼침과 같다(D40″) — 접힘/펼침에서 제목이 가로로 움직이면 안 된다. */}
          <h1
            onClick={() => { if (isOwnerView && !headerSlim) onEdit?.(problem); }}
            style={{
              ...mainColStyle,
              width: (mainColStyle.width as number) + CARD_PAD_L + CARD_PAD_R,
              paddingLeft: CARD_PAD_L, boxSizing: 'border-box',
              minWidth: 0,
              fontSize: headerSlim ? 12.5 : 22, fontWeight: 600,
              color: headerSlim ? 'var(--text-secondary)' : 'var(--text-primary)',
              margin: 0, lineHeight: headerSlim ? 1 : 1.2,
              fontFamily: 'var(--font-ui)',
              cursor: isOwnerView && !headerSlim ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center',
              transform: expanded && !headerSlim ? `translateX(${titleSlide}px)` : 'translateX(0)',
              transition: 'color 0.15s, transform 0.25s ease, font-size 0.2s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                headerSlim ? 'var(--text-secondary)' : 'var(--text-primary)';
            }}
            title="클릭하여 편집"
          >
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>{problem.title}</span>
            {!headerSlim && <BlockchainBadge problem={problem} size={16} />}
            {/* Phase 47: 댓글 버튼 — 오너 OR (멤버 && 댓글 보임) */}
            {user && (isOwnerView || (isMemberView && problem.commentsVisible !== false)) && (
              <button
                onClick={(e) => { e.stopPropagation(); setPanelMode((m) => m === 'comments' ? null : 'comments'); }}
                title="댓글 열기"
                style={{
                  marginLeft: 10, display: 'inline-flex', alignItems: 'center', gap: 3,
                  flexShrink: 0,   // ⚠ 긴 제목이 폭을 다 먹어도 버튼은 살아남아야 한다(D-17)
                  border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-ui)',
                  color: panelMode === 'comments' ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                💬{commentCount ? ` ${commentCount}` : ''}
              </button>
            )}
            {/* Phase 47: agent 버튼 — 오너 전용 */}
            {user && isOwnerView && (
              <button
                onClick={(e) => { e.stopPropagation(); setPanelMode((m) => m === 'agent' ? null : 'agent'); }}
                title="agent 열기"
                style={{
                  marginLeft: 2, display: 'inline-flex', alignItems: 'center', gap: 3,
                  flexShrink: 0,
                  border: 'none', background: 'none', cursor: 'pointer', padding: '2px 6px',
                  borderRadius: 6, fontSize: 13, fontFamily: 'var(--font-ui)',
                  color: panelMode === 'agent' ? 'var(--accent-primary)' : 'var(--text-muted)',
                }}
              >
                <span style={{ fontWeight: 600, letterSpacing: 0.3 }}>AI</span>{agentCount ? ` ${agentCount}` : ''}
              </button>
            )}
          </h1>
        </div>
      </div>

      {/* ═══ 컨텐츠 행: 본문 + 메타 (패널·핸들은 컨테이너 직속, 전체 높이) ═══ */}
      <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
      {/* ═══ 왼쪽 + 가운데: 본문 스크롤 컨테이너 ═══ */}
      {/* 외부 래퍼: 패널 자리 확보(아이보리 백드롭), 경계선 없음 — 패널과 컨텐츠가 절대 겹치지 않음 */}
      <div style={{
        flex: 1, minWidth: 0, display: 'flex', minHeight: 0,
        paddingRight: panelMode ? `calc(${comment.width}px + 8px)` : 0,
        transition: panelDragging ? 'none' : 'padding-right 0.18s ease',
      }}>
        {/* 내부 U-프레임: 클레이 + 3면 경계 + 상단 14px 라운드 (스크롤). 패널 열려도 경계선 유지 */}
        {/* ═══ 개선묶음 M2 D20′·D23′ — U자 클레이 프레임을 걷어내고 바탕을 아이보리로.
             클레이는 이제 탭 카드가 담당한다(FolderView가 Phase 62에서 한 것과 같은 이동).
             ⚠ EditorView는 U-프레임을 유지한다(E-M2-2) — CLAUDE.md의 "둘을 항상 함께"
               규약을 **의도적으로 깬 자리**다.
             ⚠ display:flex → block. 이유가 둘이다:
               ① flex + justify-content:center는 좌측 넘침이 **스크롤 영역에 포함되지 않아**
                  overflow-x를 auto로 바꿔도 닿을 수 없다(실측: 자식 780인데 scrollWidth 690).
                  block + margin:auto는 scrollWidth 780·좌단 0으로 양끝에 닿는다(Phase 62 K1 해소).
               ② flex 기본 align-items:stretch가 자식 높이를 컨테이너 높이로 눌러
                  **sticky가 죽는다**(실측: 300px 스크롤 후 −220px로 흘러감). D25′의 전제다. */}
        <div className="no-scrollbar" ref={contentScrollRef}
          onScroll={handleContentScroll}
          style={{
            flex: 1, minWidth: 0,
            overflowY: 'auto',
            overflowX: 'auto',
            background: 'var(--bg-functional)',
            display: 'block',
          }}>
        {/* ─── 가운데 영역: 각 행이 [라벨 | 카드] 구조 ─── */}
        {/* 개선묶음 M2 C — 참조 hover 말풍선 게이트(D16′).
            ⚠ **탭 전체를 감싸는 여기**에 붙여야 한다. 정의부 탐색이 이 서브트리
              안에서만 일어나므로, TabBody(탭 한 행)에 붙이면 "문제 탭에서 정의하고
              풀이 탭에서 인용"이라는 지배적 사용 형태가 통째로 안 잡힌다.
            ⚠ D45′ — 폭은 `fit-content`가 아니라 `max-content`다. 둘 다 지금은 통과하지만
              fit-content는 정의상 가용폭으로 **클램프**해서, 나중에 카드 폭이 유동이 되면
              조용히 잘리기 시작한다. 의미가 곧 의도인 쪽을 쓴다.
            ⚠ 패널 열림 시의 우측 정렬은 `margin-left:auto`로 등가 이전(구 unsafe flex-end).
            ⚠ --m2-q-sticky-h: 풀이 라벨 열의 sticky top (D51). */}
        <div data-ref-tooltip style={{
          width: 'max-content',
          margin: panelMode ? '0 0 0 auto' : '0 auto',
          padding: `0 ${OUTER_PAD}px`,
          boxSizing: 'border-box',
          ['--m2-q-sticky-h' as any]: `${qStickyH}px`,
        }}>
          {(() => {
            return (
              <>
                {/* 탭 행: [탭 라벨 | 탭 본문] — 라벨은 항상 표시, 본문은 토글.
                    Phase 59: 탭별 요약 보기 상태를 들어야 해서 TabBody로 분리했다. */}
                {tabs.map((tab, tabIdx) => {
                  const isQ = tab.id === 'question';
                  const body = (
                    <TabBody
                      key={tab.id}
                      tab={tab}
                      blocks={problem.tabBlocks[tab.id] || []}
                      tabIdx={tabIdx}
                      isOpen={!!openTabs[tab.id]}
                      copied={copiedTab === tab.id}
                      contentFontSize={contentFontSize}
                      widthEm={widthEm}
                      collapsedPreview={isQ && questionCollapsed}
                      onToggleTab={() => toggleTab(tab.id)}
                      onCopy={() => handleCopyTabMarkdown(tab.id)}
                    />
                  );
                  if (!isQ) return body;
                  /* D25′ — 문제 카드는 스크롤 컨테이너 안에서 상단에 고정된다.
                     ⚠ 래퍼가 아이보리를 칠해야 한다. 안 칠하면 스크롤된 풀이 카드가
                       고정된 문제 행의 위·아래 여백을 **통과하며 비친다**
                       (ListView.tsx:100-107이 같은 함정에 대해 남긴 주석과 같은 처방).
                     ⚠ sticky는 스크롤 컨테이너가 block이어야 동작한다(D46′). */
                  return (
                    <div key={tab.id} ref={questionRowRef} style={{
                      position: 'sticky', top: 0, zIndex: 3,
                      background: 'var(--bg-functional)',
                      paddingTop: 12, marginTop: -12,
                    }}>
                      {body}
                    </div>
                  );
                })}

                {/* 하단 여백 — width:0으로 fit-content 부모의 폭 계산에 영향 안 주도록 */}
                <div style={{ height: '70vh', width: 0 }} />
              </>
            );
          })()}
        </div>
        </div>
      </div>

      {/* ═══ 글자크기·가로폭 조절 (콘텐츠 우상단, 패널 열려도 콘텐츠 옆에 유지) ═══
          ⚠ D49 — 이 컨트롤은 **루트 기준** absolute다(컨텐츠 행 기준이 아니다).
            제목행이 98→36으로 접히면 좌표를 함께 내려야 콘텐츠 카드 위로 겹치지 않는다.
          ⚠ 컨텐츠 행(:793)에 position:relative를 주지 말 것 — 그 순간 이 컨트롤과
            우측 단 토글이 제목바 높이만큼 통째로 내려간다(Phase 62 규약). */}
      <div style={{
        position: 'absolute', top: headerSlim ? HEADER_H.slim + 8 : 16,
        right: 16 + (panelMode ? comment.width + 8 : (rightColShown ? rightCol.width : 0)),
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 4,
        transition: panelDragging ? 'none' : 'right 0.18s ease',
      }}>
        {/* D24′ — 가로폭 스테퍼(em). 글자크기 옆에 같은 문법으로 둔다.
            ⚠ 최소는 기본값과 같은 35em이다 — "현재 폭을 최소 한계로, 그 미만 축소 불가"(메모). */}
        <span style={{
          fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
          minWidth: 26, textAlign: 'right', userSelect: 'none',
        }} title="본문 가로폭(em)">{widthEm}em</span>
        <div style={{ display: 'flex', flexDirection: 'column', marginRight: 6 }}>
          <button
            onClick={() => handleWidthChange(1)}
            disabled={widthEm >= WIDTH_EM_MAX}
            title="본문 넓히기"
            style={{
              border: 'none', background: 'transparent', padding: 0, width: 14, height: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: widthEm >= WIDTH_EM_MAX ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)', opacity: widthEm >= WIDTH_EM_MAX ? 0.3 : 1,
            }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 5 L5 1 L9 5" />
            </svg>
          </button>
          <button
            onClick={() => handleWidthChange(-1)}
            disabled={widthEm <= WIDTH_EM_MIN}
            title="본문 좁히기"
            style={{
              border: 'none', background: 'transparent', padding: 0, width: 14, height: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: widthEm <= WIDTH_EM_MIN ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)', opacity: widthEm <= WIDTH_EM_MIN ? 0.3 : 1,
            }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 1 L5 5 L9 1" />
            </svg>
          </button>
        </div>
        <span style={{
          fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)',
          minWidth: 18, textAlign: 'right', userSelect: 'none',
        }} title="본문 글자 크기(px)">{contentFontSize}</span>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <button
            onClick={() => handleFontSizeChange(FONT_SIZE_STEP)}
            disabled={contentFontSize >= FONT_SIZE_MAX}
            title="글꼴 확대"
            style={{
              border: 'none', background: 'transparent', padding: 0, width: 14, height: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: contentFontSize >= FONT_SIZE_MAX ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)', opacity: contentFontSize >= FONT_SIZE_MAX ? 0.3 : 1,
            }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 5 L5 1 L9 5" />
            </svg>
          </button>
          <button
            onClick={() => handleFontSizeChange(-FONT_SIZE_STEP)}
            disabled={contentFontSize <= FONT_SIZE_MIN}
            title="글꼴 축소"
            style={{
              border: 'none', background: 'transparent', padding: 0, width: 14, height: 11,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: contentFontSize <= FONT_SIZE_MIN ? 'not-allowed' : 'pointer',
              color: 'var(--text-muted)', opacity: contentFontSize <= FONT_SIZE_MIN ? 0.3 : 1,
            }}
          >
            <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor"
              strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M1 1 L5 5 L9 1" />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ 오른쪽 단 토글 버튼 (접힘/펼침 모두 글자크기 버튼 바로 아래, 같은 우측 정렬) ═══
          Phase 62 F5 — 패널 열림 중에는 우측 단이 없으므로 이 버튼도 렌더하지 않는다
          (보이지 않는 것을 켜고 끄는 버튼을 남기지 않는다). */}
      {!panelMode && <button
        onClick={() => setRightOpen((o) => !o)}
        title={rightOpen ? '우측 패널 닫기' : '우측 패널 열기'}
        style={{
          // D49 — 제목행 접힘에 연동(글자크기 컨트롤 바로 아래 유지)
          position: 'absolute', top: headerSlim ? HEADER_H.slim + 44 : 52,
          right: 16 + (panelMode ? comment.width + 8 : (rightColShown ? rightCol.width : 0)),
          zIndex: 11, width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'var(--text-muted)', transition: panelDragging ? 'none' : 'right 0.18s ease',
        }}
      >
        {rightOpen ? <IconChevron size={16} /> : <IconChevronLeft size={16} />}
      </button>}

      {/* ═══ 오른쪽 단: 독립 스크롤, 탭 + 메뉴 + 메타 ═══ */}
      {rightColShown && <div style={{
        width: rightCol.width, flexShrink: 0,
        padding: '32px 16px',
        overflowY: 'auto',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        background: 'var(--bg-functional)',
        position: 'relative',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 닫기 버튼은 상단 토글 버튼으로 통합됨 (글자크기 버튼 아래 행) */}
        {/* ───── 메뉴 모음 (편집/사본/PDF/MD/휴지통 → spacer → 공유) ───── */}
        <div style={{ marginBottom: 18 }}>
          {menuItems.map((item, i) => {
            if (item.kind === 'spacer') {
              return <div key={i} style={{ height: 14 }} />;
            }
            const isShare = item.kind === 'share';
            const isExpanded = isShare && shareOpen;
            return (
              <div key={i}>
                <button
                  onClick={item.action}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '7px 10px',
                    border: 'none', background: 'none',
                    cursor: 'pointer',
                    fontSize: 13, fontFamily: 'var(--font-ui)',
                    color: item.danger ? 'var(--accent-danger)' : 'var(--text-primary)',
                    borderRadius: 6, textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = item.danger
                      ? 'var(--accent-danger-bg, rgba(229,57,53,0.08))'
                      : 'var(--bg-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'none';
                  }}
                >
                  <span style={{ opacity: 0.7, display: 'flex' }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {isShare && (
                    <span style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-muted)',
                      transition: 'transform 0.15s',
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                    }}>
                      <IconChevron size={12} />
                    </span>
                  )}
                </button>
                {isShare && isExpanded && user && (
                  <div style={{ padding: '6px 10px 10px' }}>
                    <ShareSettingsPanel
                      problemId={problem.id}
                      ownerUid={user.uid}
                      tabs={allTabs}
                      onManageMembers={() => onManageShare?.(problem)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ───── 문제정보 (폴더/대단원/배점/정답 통합, 접힘 토글) ───── */}
        <div style={{ marginBottom: 18 }}>
          <button onClick={toggleProblemInfo}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '7px 10px',
              border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-ui)',
              color: 'var(--text-primary)', borderRadius: 6, textAlign: 'left',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
          >
            <span style={{ opacity: 0.7, display: 'flex' }}><IconDocLines size={14} /></span>
            <span style={{ flex: 1 }}>문제정보</span>
            <span style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)',
              transition: 'transform 0.15s',
              transform: problemInfoOpen ? 'rotate(90deg)' : 'rotate(0deg)',
            }}>
              <IconChevron size={12} />
            </span>
          </button>

          {problemInfoOpen && (
            <div style={{ padding: '6px 10px 4px' }}>
              <CompactRow label="폴더">
                <select
                  value={problem.folder_id || ''}
                  onChange={(e) => updateField({ folder_id: e.target.value || undefined } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  <option value="">미분류</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="대단원">
                <select
                  value={problem.category || ''}
                  onChange={(e) => updateField({ category: e.target.value, subject: e.target.value } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  <option value="">선택</option>
                  {CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="배점">
                <select
                  value={problem.difficulty}
                  onChange={(e) => updateField({ difficulty: Number(e.target.value) } as any)}
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                >
                  {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </CompactRow>
              <CompactRow label="정답">
                <input
                  value={problem.answer || ''}
                  onChange={(e) => setProblem({ ...problem, answer: e.target.value })}
                  onBlur={(e) => updateField({ answer: e.target.value } as any)}
                  placeholder="정답"
                  disabled={!isOwnerView}
                  style={compactInputStyle(isOwnerView)}
                />
              </CompactRow>
            </div>
          )}
        </div>

        {/* ───── 하단 정보 묶음: 저자 / 생성 / 수정 / 원본인증 — 사이드바 맨 아래로 ───── */}
        <div style={{
          marginTop: 'auto', paddingTop: 14,
          borderTop: '1px solid var(--border-light)',
        }}>
          {/* 저자 / 생성 / 수정 — 라벨 width 동일하게 맞춰 값 시작 x 정렬 */}
          {problem.authorUid && (
            <BottomRow label="Writer">
              {authorProfile?.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authorProfile.photoURL} alt={authorProfile.displayName}
                  referrerPolicy="no-referrer"
                  style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                  background: '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 600, color: '#666',
                }}>
                  {((authorProfile?.email || authorProfile?.displayName || '?').charAt(0)).toUpperCase()}
                </div>
              )}
              <span style={{ color: 'var(--text-secondary)' }}>
                {(authorProfile?.email || '').split('@')[0] || authorProfile?.displayName || '—'}
              </span>
            </BottomRow>
          )}
          <BottomRow label="Created">{formatDateTime(problem.created_at)}</BottomRow>
          <BottomRow label="Modified">{formatDateTime(problem.updated_at)}</BottomRow>
          <div style={{ height: 10 }} />
          {/* 원본인증 */}
          <CopyrightPanel
            problem={problem}
            isOwner={!!user && (!problem.authorUid || user.uid === problem.authorUid)}
            currentUserUid={user?.uid}
            onUpdated={load}
          />
        </div>
      </div>}
      </div>

      <PdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        tabs={tabs}
        onConfirm={handlePdfConfirm}
        isPrinting={isPrinting}
      />

      {/* 댓글/agent 패널 — 우측 슬라이드 */}
      {panelMode && user && (
        <CommentPanel
          problemId={problem.id}
          ownerUid={problem.authorUid || ''}
          tabs={tabs}
          activeTabId={tabs[0]?.id || 'question'}
          currentUid={user.uid}
          canComment={canCommentOnProblem(problem, user.uid)}
          mode={panelMode}
          bodyFontSize={contentFontSize}
          onClose={() => { setPanelMode(null); loadSessions(); }}
          onCommentsChange={setAllComments}
          onRunVerify={handleRunVerify}
          onJumpToBlock={isVerifyOwner ? handleJumpToBlock : undefined}
          verifyCharCount={verifyCharCount}
          width={comment.width}
        />
      )}

      {/* Phase 62 D12: 댓글 패널 좌측변 드래그 리사이즈 핸들 (우측 패널만) ───
          offset = panelWidth + 3 → 10px strip의 가운데가 U자 컨텐츠 우측 경계선(panelWidth+8)에 온다 */}
      {panelMode && (
        <DrawerResizeHandle
          side="right"
          offset={comment.width + 3}
          active={comment.dragging || comment.hover}
          {...comment.handleProps}
        />
      )}

      {/* Phase 62 D17: 우측 단 좌변 리사이즈 핸들 ───
          ⚠ 우측 단 안쪽에 두면 그 열의 overflowY:auto가 가로까지 잘라내므로 루트에 둔다.
          ⚠ 컨텐츠 행에 position:relative를 주는 우회도 금지 — 글자크기·토글이 98px 내려간다.
          offset = rightWidth - 5 → 10px strip의 가운데가 우측 단 좌변(= 경계선)에 온다.
          (댓글 패널은 8px 갭 뒤에 경계가 있어 +3, 여기는 자기 좌변이 곧 경계라 -5) */}
      {rightColShown && (
        <DrawerResizeHandle
          side="right"
          offset={rightCol.width - 5}
          active={rightCol.dragging || rightCol.hover}
          {...rightCol.handleProps}
        />
      )}
    </div>
  );
}
