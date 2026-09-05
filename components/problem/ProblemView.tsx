'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ProblemWithBlocks, TabMeta, DEFAULT_TABS, Folder } from '../../types/problem';
import { getProblemWithBlocks, updateProblem, TRASH_FOLDER_ID } from '../../lib/firestore';
import { getFolderPath } from '../../lib/folder-tree';
import {
  DIFFICULTIES, CATEGORY_OPTIONS,
  WIDTH_EM_KEY, WIDTH_EM_DEFAULT, WIDTH_EM_MIN, WIDTH_EM_MAX,
} from '../../lib/constants';
import TabBody, { LABEL_GAP_EM, CARD_PAD_L_EM, CARD_PAD_R_EM, CARD_RADIUS } from './TabBody';
import PdfDialog from './PdfDialog';
import CopyrightPanel from './CopyrightPanel';
import BlockchainBadge from '../ui/BlockchainBadge';
import useAuth from '../../hooks/useAuth';
import { useDrawerResize } from '../../hooks/useDrawerResize';
import DrawerResizeHandle from '../ui/DrawerResizeHandle';
import { DRAWER_INSET, DRAWER_RADIUS, DRAWER_BORDER, DRAWER_ROW1_H, PANEL_WIDTH_DEFAULT, PANEL_WIDTH_MIN } from '../ui/dialogStyles';
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
  IconChevron, IconChevronLeft, IconComment, IconTextWidth,
} from '../ui/Icons';
import { alertDialog } from '../../lib/dialogs';
import SizeStepper, { FontSizeGlyph } from '../ui/SizeStepper';

const FONT_SIZE_KEY = 'mathory-content-font-size';
const FONT_SIZE_DEFAULT = 15;
const FONT_SIZE_MIN = 11;
const FONT_SIZE_MAX = 24;
const FONT_SIZE_STEP = 1;


/* ═══ v3 P — 제목행 고정 · 문제 카드는 흐름 그대로 · hold-to-peek ═══
   M2의 스크롤 자동접힘(M2_COLLAPSE·HEADER_H 2단)은 **통째로 철거**됐다.
   덕수 판정: "처음엔 신기했는데 반복 사용하니 시각적 피로감" · "카드가 사라지고
   나타나는 순간 화면이 튄다". 그래서 v3는 튐을 보정하지 않고 **튈 일을 만들지 않는다** —
   문제 카드를 숨기지도 고정하지도 않고 흐름대로 밀려 올라가게 둔다.
   ⚠ 되살리지 말 것. 레이아웃을 바꾸는 코드가 하나도 없다는 것이 이 설계의 값이다:
     scrollTop 보정 · 진동 쿨다운 · 접힘 높이 델타가 전부 필요 없어졌고, 무엇보다
     **참조 말풍선 회귀 위험이 원천 소멸**했다(카드가 늘 정상 상태로 DOM에 있다). */

/** 제목행 높이 = 앱 전역의 **1행**(덕수 요청 2026-08-30: 아래 빈 2행은 공간 낭비).
 *  옛 98은 EditorView의 Row1+Row2 두 행치 높이였는데 ProblemView는 1행 내용만 담아
 *  아래 ~50px이 빈 띠로 남았다("추후 메타데이터"용으로 잡아 뒀지만 끝내 오지 않았다).
 *  ⚠ 57은 임의값이 아니라 앱이 이미 쓰는 1행 높이다 — dialogHead·dialogFoot ·
 *    BatchVerifyDialog · EditorView Row1(minHeight 57 + borderBottom 1px --border-light) ·
 *    DRAWER_ROW1_H(= 57 - inset 8 - 테두리 1)이라 **모든 드로어의 첫 가로선이 y=57**이다.
 *    ProblemView 자신의 우측 단도 드로어라, 이제 중앙 제목행 아래 선과 우측 단 1행
 *    아래 선이 정확히 같은 Y에 선다(옛 98은 드로어의 **둘째** 선과 맞던 값이다).
 *  ⚠ minHeight가 아니라 height다. 제목 span이 nowrap + ellipsis라 줄바꿈이 없으므로
 *    안전하고, 고정이어야 가로선 Y가 문항마다 흔들리지 않는다. */
const HEADER_H = 57;

/** hold-to-peek 알약. 좌측 라벨 거터의 풀이 라벨 **바로 위**에 산다.
 *  ⚠ ON/OFF가 달라야 한다(히스테리시스). 같으면 경계 스크롤에서 깜빡인다. */
const PEEK = {
  BTN_TOP: 12,   // 스크롤 영역 상단 ↔ 알약 (라벨 sticky top 40보다 위)
  ON: 0,         // 카드 하단 <= 컨테이너 상단 + ON  -> 등장
  OFF: 8,        // 카드 하단 >= 컨테이너 상단 + OFF -> 소멸
};

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

  /* v3 P3 — 문제 카드가 화면 밖으로 완전히 나갔는가. **알약 표시만** 좌우하고
     레이아웃은 건드리지 않는다(그래서 진동이 구조적으로 불가능하다). */
  const [problemOffscreen, setProblemOffscreen] = useState(false);
  /* v3 P6 — 알약을 누르고 있는 동안만 true. 토글이 아니다: 손을 떼면 원상복귀라
     "되돌리는 것을 잊는" 상태가 남지 않는다. */
  const [peeking, setPeeking] = useState(false);
  /* 문제 행 실측용(P3 판정 전용). ⚠ 더 이상 sticky가 아니다. */
  const questionRowRef = useRef<HTMLDivElement>(null);
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
    defaultWidth: PANEL_WIDTH_DEFAULT, min: PANEL_WIDTH_MIN, max: () => window.innerWidth * 0.9, anchor: 'right',
  });
  /* Phase 62 D13 — 우측 단도 같은 문법으로 조절한다.
     ⚠ 덕수 요청(2026-08-28)으로 **폭 수치까지** 다른 패널과 통일했다(구 220/150/360).
        패널을 오갈 때 본문 폭이 계단처럼 튀지 않게 하려는 것이다. */
  const rightCol = useDrawerResize({
    defaultWidth: PANEL_WIDTH_DEFAULT, min: PANEL_WIDTH_MIN, max: () => window.innerWidth * 0.9, anchor: 'right',
  });
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
  /* 덕수 요청(2026-08-28) — 우측 단도 다른 패널처럼 **화면 위쪽 끝까지** 올린다.
     그러려면 컨텐츠 행의 flex 형제가 아니라 루트 기준 absolute여야 한다(제목행 위로 올라가야 하므로).
     ⚠ 자리를 flex가 잡아 주지 않게 되므로 제목행·본문이 **직접 paddingRight로 비켜야** 한다.
       이 값 하나가 그 셋(제목행·본문·토글 좌표)의 유일한 원천이다.

     ⚠ 값의 정의는 "**드로어 카드의 좌측 경계선까지**"다 — 그보다 크면 그 차이만큼
       빈 띠가 생겨 컨텐츠가 잘려 나간 것처럼 보인다(덕수 지적).
       두 경우의 좌변 위치가 다르므로 식도 다르다:
         댓글·agent : right = 8(inset) + width        → 예약 = width + 8
         우측 단     : right = 8(inset) + (width−16)   → 예약 = width − 8
       (우측 단만 바깥 자리를 width로 잡고 카드를 그 안에 8px씩 넣기 때문이다) */
  const rightReserve = panelMode
    ? comment.width + DRAWER_INSET
    : (rightColShown ? rightCol.width - DRAWER_INSET : 0);

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
    /* v3 P15 — 문제 탭의 접힘 개념이 사라졌다. 라벨·카드 클릭 토글도 함께 제거했고
       openTabs['question']은 항상 true다. 되살리지 말 것: 접기가 있으면 그 순간
       레이아웃이 바뀌고, v3가 없앤 튐이 그 경로로 되돌아온다. */
    if (tabId === 'question') return;
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
             ⚠ v3 P16 — D29′의 sticky 오프셋을 걷어냈다. 문제 행이 더 이상 상단을
               덮지 않으므로 보정할 것이 없다. 카드를 "먼저 되살리는" 처리도 불필요하다. */
          const r = target.getBoundingClientRect();
          const cr = container.getBoundingClientRect();
          const top = r.height < cr.height
            ? r.top - cr.top + container.scrollTop + r.height / 2 - cr.height / 2
            : r.top - cr.top + container.scrollTop - 80;
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

  /* ═══ v3 P3 — 문제 카드가 완전히 화면 밖으로 나갔는가 ═══
     ⚠ 여기서 하는 일은 **불리언 하나를 뒤집는 것**이 전부다. scrollTop을 쓰지도,
       되돌리지도 않는다. M2의 D51 높이 측정 effect와 D27′ 자동접힘 effect는
       통째로 사라졌다 — 레이아웃이 변하지 않으므로 잴 것도 보정할 것도 없다.
     ⚠ 히스테리시스(ON 0 / OFF 8): 같은 임계값이면 경계에서 알약이 깜빡인다.
     ⚠ rect 비교라 스크롤 위치와 무관하게 항상 옳다. 스페이서·패딩·글꼴이 바뀌어도
       "카드 하단이 컨테이너 상단 위로 갔는가"는 그대로 성립한다. */
  const handleContentScroll = useCallback(() => {
    const el = contentScrollRef.current;
    const row = questionRowRef.current;
    if (!el || !row) return;
    const gap = row.getBoundingClientRect().bottom - el.getBoundingClientRect().top;
    setProblemOffscreen((prev) => (prev ? gap < PEEK.OFF : gap <= PEEK.ON));
  }, []);

  /* 문항이 바뀌면 초기화. 새 문항은 최상단에서 시작하므로 알약이 남아 있으면 거짓말이 된다. */
  useEffect(() => { setProblemOffscreen(false); setPeeking(false); }, [problem?.id]);

  /* ═══ v3 P6·P7 — hold-to-peek ═══
     ⚠ setPointerCapture 필수: 누른 채 알약 밖으로 나가서 떼면 pointerup이 알약에
       오지 않아 **카드가 안 닫힌다**. 캡처하면 뗀 위치와 무관하게 여기로 온다.
     ⚠ blur·pointercancel도 닫아야 한다(탭 전환·시스템 제스처로 포인터가 증발한다).
     ⚠ keydown은 길게 누르면 반복 발화하므로 이미 열려 있으면 무시한다. */
  const startPeek = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 캡처 실패해도 열기는 한다 */ }
    setPeeking(true);
  }, []);
  const endPeek = useCallback(() => setPeeking(false), []);

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

  /* 덕수 요청(2026-08-28) — 글자크기·가로폭 스테퍼를 **우측 패널 상단**으로 옮겼다.
     본문 위에 떠 있던 절대배치를 걷어내 댓글·agent 패널과 머리 모양이 통일된다.
     ⚠ 대가: 우측 패널이 닫혀 있거나 댓글·agent 패널이 열린 동안에는 이 컨트롤에
       닿을 수 없다(그때는 우측 단이 아예 존재하지 않는다 — Phase 62 D16).
       글꼴·폭을 바꾸려면 우측 패널을 먼저 열어야 한다. */
  const viewControls = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* M3 A5(D14) — 폭·글자 스테퍼는 SizeStepper 공용. 'em' 단위는 화면에서 제거,
            의미는 아이콘(IconTextWidth · 큰A작은A)과 title 툴팁이 나른다.
            ⚠ 최소 폭 35em = 기본값과 같다 — "현재 폭을 최소 한계로"(D24′ 메모) 불변. */}
        <SizeStepper
          icon={<IconTextWidth size={27} color="var(--text-muted)" />}
          value={widthEm} min={WIDTH_EM_MIN} max={WIDTH_EM_MAX}
          onStep={(d) => handleWidthChange(d)}
          titleUp="본문 넓히기" titleDown="본문 좁히기" title="본문 가로폭(em)"
          numberStyle={{ minWidth: 20 }}
          style={{ marginRight: 6 }}
        />
        <SizeStepper
          icon={<FontSizeGlyph />}
          value={contentFontSize} min={FONT_SIZE_MIN} max={FONT_SIZE_MAX}
          onStep={(d) => handleFontSizeChange(d * FONT_SIZE_STEP)}
          titleUp="글꼴 확대" titleDown="글꼴 축소" title="본문 글자 크기(px)"
          numberStyle={{ minWidth: 18 }}
        />
    </div>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      flex: 1, minHeight: 0, width: '100%',
      background: 'var(--bg-functional)', fontSize: contentFontSize,
      overflow: 'hidden', position: 'relative',
    }}>
      {/* ═══ 제목바: U자 밖 아이보리 chrome — [폴더경로 | 제목] 한 행 ═══ */}
      {/* v3 P1 — 제목행은 스크롤과 무관하게 위치·크기를 그대로 유지한다(덕수: 안정감).
          M2의 슬림 접힘(height 애니메이션 98↔36)은 철거했다.
          ⚠ height는 고정값이다. minHeight로 두면 제목이 줄바꿈할 때 커져 EditorView와의
            가로선 Y 정렬(98)이 깨진다.
          v3 P18 — 아래 경계선은 **상시**다. 제목행과 스크롤 영역이 둘 다 아이보리라
          선이 없으면 클레이 카드가 보이지 않는 경계에서 잘려 "왜 잘렸지"가 된다.
          ⚠ 값은 EditorView Row1과 **같아야** 한다(1px --border-light) — 두 화면을 오갈 때
            첫 가로선의 굵기·색이 달라지면 그것이 곧 불안정으로 읽힌다. */}
      <div style={{
        flexShrink: 0, background: 'var(--bg-functional)',
        height: HEADER_H,
        overflow: 'hidden',
        paddingRight: rightReserve,
        transition: panelDragging ? 'none' : 'padding-right 0.18s ease',
        display: 'flex', justifyContent: 'center',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-light)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: LABEL_GAP,
          padding: `0 ${OUTER_PAD}px`,
          boxSizing: 'border-box',
        }}>
          {/* 헤더 라벨 박스 — 폭 7em 고정. 경로는 absolute 오버레이, 제목은 transform 슬라이드 */}
          {/* ⚠ 슬림에서도 이 박스는 **자리를 지킨다**(opacity만 0) — 폭이 사라지면
              제목 좌단이 좌측으로 튀어 접힘/펼침에서 제목이 가로로 움직인다(D40″). */}
          <div
            ref={labelBoxRef}
            onMouseEnter={() => { if (hasAncestors) setFolderPathHover(true); }}
            onMouseLeave={() => setFolderPathHover(false)}
            style={{
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
            onClick={() => { if (isOwnerView) onEdit?.(problem); }}
            style={{
              ...mainColStyle,
              width: (mainColStyle.width as number) + CARD_PAD_L_EM * contentFontSize + CARD_PAD_R_EM * contentFontSize,
              paddingLeft: CARD_PAD_L_EM * contentFontSize, boxSizing: 'border-box',
              minWidth: 0,
              fontSize: 22, fontWeight: 600,
              color: 'var(--text-primary)',
              margin: 0, lineHeight: 1.2,
              fontFamily: 'var(--font-ui)',
              cursor: isOwnerView ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center',
              transform: expanded ? `translateX(${titleSlide}px)` : 'translateX(0)',
              transition: 'color 0.15s, transform 0.25s ease',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = 'var(--accent-primary)'; }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.color =
                'var(--text-primary)';
            }}
            title="클릭하여 편집"
          >
            <span style={{
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
            }}>{problem.title}</span>
            <BlockchainBadge problem={problem} size={16} />
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
                <IconComment size={13} />{commentCount ? ` ${commentCount}` : ''}
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
        paddingRight: rightReserve,
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
            ⚠ v3 P13 — hold-to-peek로 띄우는 문제 카드는 **이 게이트 밖**에 그려야 한다.
              같은 블록을 두 번 그리는 것이라 안에 두면 보기(ㄱ.·(가)·①)의 정의부가
              두 벌이 되어 "참조보다 앞선 것 중 가장 가까운 것"이라는 탐색이 흔들린다. */}
        <div data-ref-tooltip style={{
          width: 'max-content',
          margin: panelMode ? '0 0 0 auto' : '0 auto',
          padding: `0 ${OUTER_PAD}px`,
          boxSizing: 'border-box',
        }}>
          {/* ═══ v3 P5 — hold-to-peek 알약 ═══
              좌측 라벨 거터의 **풀이 라벨 바로 위**. 방금 `문제` 라벨이 밀려 올라간 자리라
              "문제가 있던 그 자리"로 읽힌다(덕수).
              ⚠ 높이 0 sticky 상자 안의 absolute다 — 흐름 높이를 차지하지 않으므로
                등장·소멸이 **아무것도 밀지 않는다**. 자리 예약도 필요 없다.
              ⚠ sticky를 탭(TabBody) 안에 두지 말 것: 탭이 여럿이면 아래 탭으로 스크롤할 때
                알약이 함께 사라진다. 여기(탭 전체의 첫 형제)라야 스크롤 내내 상단에 남는다.
              ⚠ 마운트/언마운트가 아니라 opacity로 여닫는다 — 페이드가 살고, 어차피
                흐름 밖이라 레이아웃 비용이 0이다. */}
          <div style={{ position: 'sticky', top: 0, height: 0, zIndex: 4 }}>
            <button
              onPointerDown={startPeek}
              onPointerUp={endPeek}
              onPointerCancel={endPeek}
              onBlur={endPeek}
              onKeyDown={(e) => {
                /* ⚠ 길게 누르면 keydown이 반복 발화한다 — 이미 열려 있으면 무시할 것. */
                if ((e.key === 'Enter' || e.key === ' ') && !peeking) { e.preventDefault(); setPeeking(true); }
              }}
              onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') setPeeking(false); }}
              onContextMenu={(e) => e.preventDefault()}
              title="누르고 있는 동안 문제가 보입니다"
              aria-label="문제 잠깐 보기"
              style={{
                position: 'absolute', top: PEEK.BTN_TOP, left: 0,
                padding: '4px 10px', border: 'none', borderRadius: 999,
                background: 'var(--accent-primary)', color: '#fff',
                fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-ui)',
                whiteSpace: 'nowrap', cursor: 'pointer',
                /* 터치에서 길게 누르기가 스크롤·선택·컨텍스트 메뉴로 새지 않도록 */
                touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
                opacity: problemOffscreen ? 1 : 0,
                pointerEvents: problemOffscreen ? 'auto' : 'none',
                transition: 'opacity 0.15s',
              }}
            >
              문제
            </button>
          </div>

          {/* 탭 행: [탭 라벨 | 탭 본문].
              ⚠ v3 P2 — 문제 행에 더는 sticky·가로선·페이드가 없다. 그냥 흐름대로
                밀려 올라간다. 래퍼 div는 **실측 전용**이다(P3 판정). */}
          {tabs.map((tab, tabIdx) => {
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
                onToggleTab={() => toggleTab(tab.id)}
                onCopy={() => handleCopyTabMarkdown(tab.id)}
              />
            );
            if (tab.id !== 'question') return body;
            return <div key={tab.id} ref={questionRowRef}>{body}</div>;
          })}

          {/* 하단 여백 — width:0으로 max-content 부모의 폭 계산에 영향 안 주도록 */}
          <div style={{ height: '70vh', width: 0 }} />
        </div>
        </div>
      </div>


      {/* ═══ v3 P6·P9~P14 — hold-to-peek: 누르고 있는 동안만 문제 카드가 화면 중앙에 ═══
          ⚠ 별도 팝업 크롬(제목바·닫기·모달 테두리)을 만들지 않는다 — 이질적인 상자는
            그 자체로 시각적 불안 요소다(덕수). 흐름에 있을 때와 **같은 카드**를 그대로 띄운다.
          ⚠ 딤을 쓰지 않는다. 배경과의 구분은 아래로 떨어지는 그림자(--drawer-shadow,
            우측 패널 4종이 쓰는 2겹)가 담당한다.
          ⚠ [data-ref-tooltip] **밖**이다(P13).
          ⚠ 컨테이너는 pointerEvents:none, 카드만 auto — 긴 문제를 hold 중에 휠로 넘길 수
            있어야 하는데(P11) 컨테이너까지 none이면 휠이 뒤 컨텐츠로 빠진다.
            뗄 때의 pointerup은 setPointerCapture 덕분에 알약으로 간다(P7).
          ⚠ 라벨은 띄우지 않는다(P14) — 좌측에 빈 열이 생겨 카드가 중앙에서 어긋나 보인다. */}
      {peeking && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 40,
          paddingRight: rightReserve,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none', animation: 'peekIn 0.08s ease-out',
        }}>
          <div style={{
            maxHeight: '80vh', overflow: 'auto', pointerEvents: 'auto',
            borderRadius: CARD_RADIUS, boxShadow: 'var(--drawer-shadow)',
          }}>
            <TabBody
              tab={tabs.find((t) => t.id === 'question') ?? tabs[0]}
              blocks={problem.tabBlocks['question'] || []}
              tabIdx={0}
              isOpen
              copied={false}
              contentFontSize={contentFontSize}
              widthEm={widthEm}
              hideLabel
              onToggleTab={() => {}}
              onCopy={() => {}}
            />
          </div>
        </div>
      )}

      {/* ═══ 오른쪽 단 토글 버튼 (접힘/펼침 모두 글자크기 버튼 바로 아래, 같은 우측 정렬) ═══
          Phase 62 F5 — 패널 열림 중에는 우측 단이 없으므로 이 버튼도 렌더하지 않는다
          (보이지 않는 것을 켜고 끄는 버튼을 남기지 않는다). */}
      {/* 덕수 요청 — 닫기는 패널 **안** 1행 왼쪽 버튼이 담당한다.
          바깥의 이 버튼은 '열기' 전용이라 패널이 열려 있으면 렌더하지 않는다
          (같은 일을 하는 버튼이 둘이면 어느 것이 무엇인지 알 수 없다). */}
      {!panelMode && !rightColShown && <button
        onClick={() => setRightOpen(true)}
        title="우측 패널 열기"
        style={{
          /* D49 — 제목행 접힘에 연동. 스테퍼가 우측 패널로 들어가면서 이 버튼이
             콘텐츠 우상단의 유일한 떠 있는 컨트롤이 됐다(ctrlW 보정 불필요). */
          position: 'absolute', top: 16,
          right: 16 + rightReserve,
          zIndex: 11, width: 26, height: 26,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: 'var(--text-muted)', transition: panelDragging ? 'none' : 'right 0.18s ease',
        }}
      >
        <IconChevronLeft size={16} />   {/* 열기 전용 — 닫기는 패널 안 1행 왼쪽 */}
      </button>}

      {/* ═══ 오른쪽 단: 독립 스크롤, 탭 + 메뉴 + 메타 ═══ */}
      {/* 덕수 요청(2026-08-28) — 우측 단도 드로어 3종과 같은 **떠 있는 카드**로 통일.
          ⚠ 바깥 자리(flex item 차지 폭)는 `rightCol.width` 그대로 유지한다:
            margin(8×2) + width(w−16) = w. 이 등식이 깨지면 글자크기 컨트롤·우측 단
            토글의 `right` 계산(전부 rightCol.width 기준)이 한꺼번에 어긋난다.
          ⚠ 리사이즈 활성선은 이제 **카드 좌변**이다 → 핸들 offset도 함께 −8 했다. */}
      {rightColShown && <div style={{
        /* 루트 기준 absolute — 제목행 위까지 올라가 댓글·agent·버전 드로어와 같은 높이가 된다.
           ⚠ 바깥 자리는 flex가 아니라 rightReserve(= rightCol.width)가 잡는다.
              width(w−16) + 좌우 inset(8×2) = w 라는 등식이 그 전제다. */
        position: 'absolute', top: DRAWER_INSET, right: DRAWER_INSET, bottom: DRAWER_INSET,
        width: rightCol.width - DRAWER_INSET * 2,
        zIndex: 40,                 // 댓글·agent 패널(50)보다 아래
        padding: 0,                 // 헤더 행은 전폭 — 패딩은 아래 본문 div가 갖는다
        overflow: 'hidden',
        fontSize: 13,
        fontFamily: 'var(--font-ui)',
        background: 'var(--bg-drawer)',
        borderRadius: DRAWER_RADIUS,
        border: DRAWER_BORDER,
        boxShadow: 'var(--drawer-shadow)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* 덕수 요청(2026-08-28) — 머리 행은 댓글·agent·버전 드로어의 **1행 규격**을 따른다:
            minHeight 57 · padding '0 16px' · gap 12 · 아래 구분선.
            그래야 패널을 오갈 때 첫 가로선의 Y가 흔들리지 않는다.
            왼쪽 = 접는 버튼(패널 밖에 떠 있던 것을 안으로), 오른쪽 = 보기 컨트롤.
            ⚠ 규격을 바꿀 때는 CommentPanel·VersionDrawer의 1행도 함께 볼 것. */}
        <div style={{
          minHeight: DRAWER_ROW1_H, flexShrink: 0, padding: '0 16px',
          display: 'flex', alignItems: 'center', gap: 12,
          borderBottom: '1px solid var(--border-light)',
        }}>
          <button
            onClick={() => setRightOpen(false)}
            title="우측 패널 닫기"
            style={{
              width: 26, height: 26, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <IconChevron size={16} />
          </button>
          <div style={{ flex: 1 }} />
          {viewControls}
        </div>
        <div style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '20px 16px', display: 'flex', flexDirection: 'column',
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
          ⚠ 덕수 요청으로 우측 단이 **떠 있는 카드**가 되면서(사면 8px 여백) 활성선 기준이
            자기 열의 좌변이 아니라 **카드 좌변**으로 바뀌었다:
            strip 가운데 = offset + 5 = 카드 좌변 = w − 8  →  offset = w − 13.
            (댓글 패널은 8px 갭 뒤에 경계가 있어 +3 — 결국 세 곳의 활성선이 같은 문법이다) */}
      {rightColShown && (
        <DrawerResizeHandle
          side="right"
          offset={rightCol.width - 13}
          active={rightCol.dragging || rightCol.hover}
          {...rightCol.handleProps}
        />
      )}
    </div>
  );
}
