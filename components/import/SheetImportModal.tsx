'use client';

/**
 * Phase 61a — 시트 가져오기 마법사
 * 시트 선택 → 행 지정 → 폴더 선택 → 미리보기 → 저장.
 *
 * ⚠️ **미리보기와 저장은 같은 배열을 본다(계획서 Y1).**
 *    `toPersistedBlock`이 `raw_text`를 정규화(`$$` 앞뒤 빈 줄)하므로, 정규화 **전** 텍스트를
 *    그리면 화면과 저장 결과가 갈린다. 미리보기 진입 시점에 persisted 배열을 확정하고
 *    화면과 저장이 그것을 공유한다. `block_key`도 여기서 정해져 재시도에 안정적이다.
 *
 * ⚠️ **블록 렌더는 타입 분기가 필수다(계획서 X3).** `EditorPreview`는 마크다운 문자열
 *    렌더러라 choices를 모른다 — 그냥 넘기면 선택지가 마크다운 원문으로 보인다.
 *
 * ⚠️ **중복 판정 키는 `source_id` 단독이 아니다(계획서 D11).** 실측에서 시트에 id가 같고
 *    본문이 다른 그룹이 67개 나왔다 — id만 보면 서로 다른 문항을 조용히 건너뛴다.
 *
 * ⚠️ **그림은 Y1의 유일한 예외다(Phase 61e).** image 블록의 `raw_text`는 미리보기에서 blob URL,
 *    저장본에서 Storage URL을 갖는다 — 그 `src` 한 곳 말고는 미리보기와 저장이 같은 배열이다.
 *    파일명은 `draft.blocksByTab[tab][i].figName`에 있고 `persisted[tab][i]`와 **인덱스가 정렬**된다
 *    (`persisted`를 `.map()`으로 만들기 때문). 그 정렬을 깨지 말 것.
 *
 * ⚠️ **휴지통 문항은 중복이 아니다(D15).** Mathory의 '삭제'는 영구 삭제가 아니라 휴지통
 *    이동(`folder_id = TRASH_FOLDER_ID`)이라 문서가 그대로 남는다. 이를 중복으로 세면
 *    "지웠는데도 다시 가져올 수 없는" 상태가 된다 — 실제로 그렇게 막혔다.
 *    또한 중복이어도 **체크를 막지는 않는다**. 기본만 해제하고 판단은 사용자에게 남긴다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Block, Folder, ImportSource } from '../../types/problem';
import {
  rowToDraft, isDraftError,
  type ImportRow, type ProblemDraft, type DraftBlock,
} from '../../lib/sheetImport';
import { toPersistedBlock, type PersistedBlockData } from '../../lib/blocks/normalize';
import { autoFixDeterministicIssues } from '../../lib/proofread';
import { imageTreatmentStyle } from '../../lib/imageTreatment';
import { uploadImage, deleteUploadedFile } from '../../lib/storage';
import { createProblem, saveTabBlock, deleteProblem, createFolder, listProblems, TRASH_FOLDER_ID } from '../../lib/firestore';
import { buildFolderTree, flattenVisible, getChildren } from '../../lib/folder-tree';
import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { IconClose, IconChevron, IconChevronDown, IconFolder, IconPlus } from '../ui/Icons';
import FolderGlyph from '../ui/FolderGlyph';
import { promptDialog } from '../../lib/dialogs';

type SheetName = 'Data_DS' | 'Stack';

interface ApiResponse {
  header: string[];
  headerWarnings: string[];
  rows: ImportRow[];
}

/** 한 행의 미리보기 단위. `persisted`가 화면과 저장이 공유하는 단일 진실이다(Y1). */
interface PreviewItem {
  rowIndex: number;
  draft: ProblemDraft | null;
  error: string | null;
  persisted: Record<string, PersistedBlockData[]>;
  /** 이 문항이 쓰는 Drive 그림 파일명(중복 제거). 지연 로딩·저장이 이것을 순회한다. */
  figNames: string[];
  /** 결정적 자동 수정이 고친 건수. 0이면 배지를 띄우지 않는다. */
  autoFixCount: number;
  /** none=새 문항 · existing=내 문항에 있음 · inSelection=이번 선택 안 중복 · trashed=휴지통에만 있음 */
  dupe: 'none' | 'existing' | 'inSelection' | 'trashed';
}

/** 그림 한 장의 상태. 키는 파일명이라 문제·해설이 같은 그림을 가리켜도 **한 번만** 받는다(D17). */
/** ⚠ 판별자는 **문자열**이다 — tsconfig가 `strict: false`라 boolean 리터럴로는 좁혀지지 않는다. */
type FigEntry = { kind: 'ok'; blobUrl: string; blob: Blob; type: string; dupes: number }
              | { kind: 'error'; error: string };

interface SaveOutcome {
  rowIndex: number;
  title: string;
  status: 'ok' | 'fail';
  detail?: string;
}

/** 61e-2차 D27 — GAS `pv_load_`가 검증 실행마다 Data_DS를 **통째로 비우고 다시 채운다**
 *  (M열 체크박스까지 지워진다 — N8). 그래서 Data_DS는 "마지막 검증 실행분", 누적본은 Stack이다. */
const SHEETS: { id: SheetName; label: string; hint: string }[] = [
  { id: 'Data_DS', label: 'Data_DS', hint: '마지막 검증 실행분 (불러올 때마다 교체됨)' },
  { id: 'Stack', label: 'Stack', hint: '누적 (전체 세트)' },
];

/** 저장 동시성. 문항 1건이 문서 1 + 블록 2~5개라 왕복이 많다. 너무 높이면
 *  Firestore 클라이언트가 큐를 쌓고 진행률이 뭉텅이로 뛴다. */
const SAVE_CONCURRENCY = 4;

const dupeKey = (sourceId: string, stemHash: string) => `${sourceId}|${stemHash}`;

/**
 * 편집창 [교정]의 **결정적 자동 수정**을 가져오기 경로에도 태운다(Phase 61e D8·D9).
 *
 * 제외 규칙은 편집창(`EditorView.AUTOFIX_EXCLUDED_TYPES` = image·svg·ggb)과 같다.
 * `choices`는 `skipJamoRefs`로 `(ㄱ)→(1)`만 끄고 숫자 수식화 등은 받는다(편집창과 동일).
 *
 * ⚠ **그림이 남은 choices 블록은 통째로 건너뛴다**(D3′). 선택지 셀 안 그림은
 *   실측 0건이라 인라인 처리를 만들지 않았고, 문자열로 남은 것을 자동 수정에 넣을 이유가 없다.
 *   (제어열 보호는 `lib/proofread.ts`가 이미 하지만, 손댈 이유가 없는 블록은 손대지 않는다.)
 * ⚠ **두 형식을 함께 본다**(61e-2차) — 구형 태그와 GAS 패치 11의 `![이름](Drive링크)`.
 *   ⚠ 근거는 **기존 가드와의 대칭**이지 "수식화 방지"가 아니다. 마크다운 이미지의 alt·URL은
 *     `lib/proofread.ts:342·403`(`!?\[…\](…)` 보호)이 이미 지킨다 — 실행 프로브로 확인했고
 *     `tests/proofread.test.mjs` P-9·P-10이 고정한다. 거짓 근거를 남기면 나중에 이 가드를
 *     지우려는 사람이 없는 위험과 씨름한다.
 */
const CHOICE_FIG_RE = /\\includegraphics|!\[[^\]\n]*\]\([ \t]*https:\/\/drive\.google\.com\//;

function applyAutoFix(b: DraftBlock, enabled: boolean): { text: string; count: number } {
  if (!enabled || b.type === 'image') return { text: b.raw_text, count: 0 };
  if (b.type === 'choices' && CHOICE_FIG_RE.test(b.raw_text)) return { text: b.raw_text, count: 0 };
  const { fixed, count } = autoFixDeterministicIssues(b.raw_text, { skipJamoRefs: b.type === 'choices' });
  return { text: fixed, count };
}

/**
 * Drive 그림을 프록시로 받아 `파일명 → FigEntry` 목록을 만든다. **미리보기와 저장이 공유한다.**
 *
 * ⚠ 인증 헤더가 필요하므로 `<img src="/api/…">`로는 못 쓴다 — 401이 된다(계획서 N-5).
 *   `fetch` → `blob()` → `createObjectURL`이 유일한 경로다.
 * ⚠ 만든 blob URL은 `sink`에 모아 언마운트에서 회수한다. 대량 가져오기에서 수백 장이 쌓인다.
 */
async function fetchFigures(
  names: string[], idToken: string, sink: string[],
): Promise<[string, FigEntry][]> {
  const out: [string, FigEntry][] = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(SAVE_CONCURRENCY, names.length) }, async () => {
      while (cursor < names.length) {
        const name = names[cursor++];
        try {
          const res = await fetch(`/api/sheet-import/figure?name=${encodeURIComponent(name)}`, {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (!res.ok) {
            const msg = (await res.json().catch(() => null))?.error ?? `그림을 가져오지 못했습니다 (HTTP ${res.status})`;
            out.push([name, { kind: 'error', error: msg }]);
            continue;
          }
          const blob = await res.blob();
          const blobUrl = URL.createObjectURL(blob);
          sink.push(blobUrl);
          out.push([name, {
            kind: 'ok', blobUrl, blob,
            type: res.headers.get('content-type') || blob.type || 'image/jpeg',
            dupes: Number(res.headers.get('x-fig-duplicates') ?? '1'),
          }]);
        } catch {
          out.push([name, { kind: 'error', error: '그림을 가져오는 중 문제가 생겼습니다' }]);
        }
      }
    }),
  );
  return out;
}

/**
 * image 블록의 `raw_text`를 저장 직전에 확정한다.
 *
 * `persisted[tab][i]`(저장형)와 `draft.blocksByTab[tab][i]`(파일명 보유)는 **인덱스가 정렬**돼 있다.
 * 그림을 받지 못했으면 **`\includegraphics{…}` 리터럴을 넣은 text 블록으로 되돌린다**(D5) —
 * `(이미지 없음)`만 남기면 원인 추적이 안 되고, 리터럴이면 나중에 검색으로 되찾을 수 있다.
 *
 * ⚠ 이 리터럴 자체는 autoFix **이후**에 삽입되므로 `lib/proofread.ts`를 지나지 않는다.
 *   제어열 보호(D15)가 실제로 일하는 자리는 **분할하지 않는 텍스트에 남은 그림 표기**다 —
 *   O열(AI 정답)·선택지의 구형 `\includegraphics{…}`는 `collectControlSeqRanges`가,
 *   같은 자리의 신형 `![이름](링크)`는 `proofread.ts:342·403`이 지킨다. 그 보호를 걷어내면
 *   `\$includegraphics${…}`로 조각나 **복구 경로가 통째로 죽는다.**
 * ⚠ 신형식이어도 폴백은 **구형 리터럴**이다(61e-2차 D30) — `![이름](Drive링크)`를 되살리면
 *   저장본에 **깨진 이미지**가 남아, 이번에 고친 "주소만 붙는" 증상과 구별되지 않는다.
 */
function materializeImage(
  block: PersistedBlockData, draftBlock: DraftBlock | undefined, urlByFig: Map<string, string>,
): PersistedBlockData {
  if (block.type !== 'image') return block;
  const figName = draftBlock?.figName ?? '';
  const url = urlByFig.get(figName);
  if (!url) return { ...block, type: 'text', raw_text: `\\includegraphics{${figName}}` };
  return { ...block, raw_text: `<img src="${url}" alt="${figName}" width="400" />` };
}

/* ═══ 스타일 ═══ */

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9000,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties,
  modal: {
    background: 'var(--bg-card, #fff)', borderRadius: 10,
    width: 'min(920px, 94vw)', maxHeight: '88vh',
    display: 'flex', flexDirection: 'column',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    fontFamily: 'var(--font-ui)',
  } as React.CSSProperties,
  head: {
    display: 'flex', alignItems: 'center', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderBottom: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  body: { padding: 16, overflowY: 'auto', flex: 1 } as React.CSSProperties,
  foot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    minHeight: 57, padding: '0 16px',
    borderTop: '1px solid var(--border-light, #eee)',
  } as React.CSSProperties,
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #888)', marginBottom: 6 } as React.CSSProperties,
  input: {
    width: '100%', padding: '8px 10px', fontSize: 13,
    fontFamily: 'var(--font-ui)', color: 'var(--text-primary, #222)',
    background: 'var(--bg-input, #fff)',
    border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
  } as React.CSSProperties,
};

const ACCENT = 'var(--mathory-red-dark, #BC5F3F)';

const btn = (kind: 'primary' | 'ghost', disabled = false): React.CSSProperties => ({
  padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 6,
  fontFamily: 'var(--font-ui)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.5 : 1,
  border: kind === 'primary' ? 'none' : '1px solid var(--border-light, #ddd)',
  background: kind === 'primary' ? ACCENT : 'transparent',
  color: kind === 'primary' ? '#fff' : 'var(--text-primary, #222)',
});

const badge = (tone: 'warn' | 'muted' | 'ok'): React.CSSProperties => ({
  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
  fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
  background: tone === 'warn' ? 'rgba(188,95,63,0.12)' : tone === 'ok' ? 'rgba(60,130,80,0.12)' : 'var(--bg-hover, #f3f3f3)',
  color: tone === 'warn' ? ACCENT : tone === 'ok' ? '#3c8250' : 'var(--text-muted, #888)',
});

/* ═══ 컴포넌트 ═══ */

export default function SheetImportModal({
  user, folders: initialFolders, onClose, onImported,
}: {
  user: User;
  folders: Folder[];
  onClose: () => void;
  /** 저장이 하나라도 성공하면 호출 — AppShell이 목록·카운트를 다시 읽는다 */
  onImported: () => void;
}) {
  const [phase, setPhase] = useState<'form' | 'preview' | 'saving' | 'done'>('form');
  const [sheet, setSheet] = useState<SheetName>('Stack');
  const [rowsText, setRowsText] = useState('');
  const [includePreselected, setIncludePreselected] = useState(true);

  const [folders, setFolders] = useState<Folder[]>(initialFolders);
  const [folderId, setFolderId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headerWarnings, setHeaderWarnings] = useState<string[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [fetchedSheet, setFetchedSheet] = useState<SheetName>('Stack');
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  const [progress, setProgress] = useState(0);
  const [outcomes, setOutcomes] = useState<SaveOutcome[]>([]);

  /** Phase 61e D9 — 가져오면서 편집창과 같은 결정적 자동 수정을 태운다. 기본 ON. */
  const [autoFix, setAutoFix] = useState(true);

  /** 파일명 → 그림. state로 두어야 다운로드가 끝나면 미리보기가 다시 그려진다. */
  const [figs, setFigs] = useState<Map<string, FigEntry>>(new Map());
  /** blobUrl 회수용 — state는 리렌더마다 새 Map이라 정리 시점에 놓칠 수 있다. */
  const blobUrlsRef = useRef<string[]>([]);
  /** 같은 파일을 두 번 요청하지 않기 위한 진행 중 집합(state 갱신 전에도 막아야 한다). */
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'saving') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, phase]);

  // N-5 — blob URL은 명시적으로 회수한다. 대량 가져오기에서 수백 장이 쌓인다.
  useEffect(() => () => { for (const u of blobUrlsRef.current) URL.revokeObjectURL(u); }, []);

  /**
   * Drive 그림을 받아 캐시에 넣는다(미리보기용). 실제 다운로드는 `fetchFigures`가 한다.
   *
   * ⚠ 이미 받았거나 받는 중인 이름은 건너뛴다 — 문제·해설이 같은 그림을 가리키는 것이 정상이다(D17).
   */
  const loadFigures = useCallback(async (names: string[]) => {
    const todo = names.filter((n) => !figs.has(n) && !inFlightRef.current.has(n));
    if (todo.length === 0) return;
    for (const n of todo) inFlightRef.current.add(n);
    try {
      const got = await fetchFigures(todo, await user.getIdToken(), blobUrlsRef.current);
      setFigs((prev) => { const next = new Map(prev); for (const [k, v] of got) next.set(k, v); return next; });
    } finally {
      for (const n of todo) inFlightRef.current.delete(n);
    }
  }, [figs, user]);

  const canSubmit = rowsText.trim() !== '' || includePreselected;
  const folderName = folderId ? (folders.find((f) => f.id === folderId)?.name ?? '') : '최상위(미지정)';

  /* ── 폴더 새로 만들기 (AppShell 관례와 동일: prompt + order = 형제 수) ── */
  const handleNewFolder = async () => {
    const parent = folderId ?? null;
    const name = await promptDialog({
      title: parent ? '하위 폴더 만들기' : '새 폴더',
      message: parent ? `"${folders.find((f) => f.id === parent)?.name}" 안에 만듭니다.` : undefined,
      placeholder: '폴더 이름',
    });
    if (!name?.trim()) return;
    try {
      const id = await createFolder({
        name: name.trim(), user_id: user.uid,
        order: getChildren(folders, parent).length, parent_id: parent,
      });
      const created: Folder = { id, name: name.trim(), user_id: user.uid, order: 0, parent_id: parent };
      setFolders((prev) => [...prev, created]);
      setFolderId(id);
      onImported();                       // 사이드바 폴더 목록 갱신
    } catch {
      setError('폴더를 만들지 못했습니다');
    }
  };

  /* ── 미리보기 ── */
  const fetchRows = async () => {
    setBusy(true); setError(null);
    try {
      // Y4: ID 토큰을 릴레이한다. 라우트가 accounts:lookup으로 검증하고 허용목록으로 좁힌다.
      const idToken = await user.getIdToken();
      const res = await fetch('/api/sheet-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ sheet, rows: rowsText.trim(), includePreselected }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json?.error ?? '시트를 가져오지 못했습니다'); return; }
      const data = json as ApiResponse;

      // 이미 가져온 문항 집합. import_source는 listProblems의 `...data` 스프레드로 그대로 온다.
      // D15: 휴지통 문항은 살아 있는 문항과 따로 센다 — 지운 것을 다시 가져올 수 있어야 한다.
      const existing = new Set<string>();
      const trashed = new Set<string>();
      try {
        const mine = await listProblems(user.uid);
        for (const p of mine) {
          const src = p.import_source as ImportSource | undefined;
          if (!src?.source_id) continue;
          const key = dupeKey(src.source_id, src.stem_hash ?? '');
          (p.folder_id === TRASH_FOLDER_ID ? trashed : existing).add(key);
        }
      } catch {
        setError('기존 문항을 읽지 못해 중복 검사를 건너뜁니다 — 저장 전에 확인하세요');
      }

      const seen = new Set<string>();
      const next: PreviewItem[] = data.rows.map((row) => {
        const d = rowToDraft(row);
        if (isDraftError(d)) {
          return { rowIndex: row.rowIndex, draft: null, error: d.error, persisted: {},
                   figNames: [], autoFixCount: 0, dupe: 'none' as const };
        }
        // Y1·Y2·Y3 — 저장형을 여기서 확정하고 화면이 그것을 그린다.
        // 순서가 규칙이다: rowToDraft → splitFigures(라이브러리) → autoFix → toPersistedBlock.
        //   autoFix가 `\[..\]`·tabular를 새 `$$`로 바꾸고, `toPersistedBlock`이 그 `$$` 앞뒤
        //   빈 줄을 소유한다. 뒤집으면 새로 생긴 `$$`가 정규화를 못 받는다.
        const persisted: Record<string, PersistedBlockData[]> = {};
        const figNames: string[] = [];
        let autoFixCount = 0;
        for (const [tabId, blocks] of Object.entries(d.blocksByTab)) {
          persisted[tabId] = blocks.map((b, i) => {
            if (b.type === 'image' && b.figName && !figNames.includes(b.figName)) figNames.push(b.figName);
            const { text, count } = applyAutoFix(b, autoFix);
            autoFixCount += count;
            return toPersistedBlock({ id: '', order: i, type: b.type, raw_text: text } as Block, i);
          });
        }
        const key = dupeKey(d.sourceId, d.stemHash);
        const dupe: PreviewItem['dupe'] =
          existing.has(key) ? 'existing'
          : seen.has(key) ? 'inSelection'
          : trashed.has(key) ? 'trashed'          // 휴지통에만 있음 → 가져올 수 있다
          : 'none';
        seen.add(key);
        return { rowIndex: row.rowIndex, draft: d, error: null, persisted, figNames, autoFixCount, dupe };
      });

      setItems(next);
      setFetchedSheet(sheet);
      setHeaderWarnings(data.headerWarnings ?? []);
      // D3′(D15): 중복은 기본 해제. 다만 **막지는 않는다** — 배지로 알리고 선택은 사용자가 한다.
      //   휴지통에만 있는 것은 사실상 지운 문항이므로 기본 선택에 포함한다.
      setChecked(new Set(
        next.filter((i) => i.draft && (i.dupe === 'none' || i.dupe === 'trashed')).map((i) => i.rowIndex),
      ));
      setExpanded(null);
      setPhase('preview');
    } catch {
      setError('시트를 가져오는 중 문제가 생겼습니다 — 잠시 후 다시 시도하세요');
    } finally {
      setBusy(false);
    }
  };

  /* ── 저장 ── */
  const runImport = async () => {
    const targets = items.filter((i) => i.draft && checked.has(i.rowIndex));
    if (targets.length === 0) return;

    setPhase('saving'); setProgress(0); setError(null);

    // D16 — 미리보기는 펼친 행만 받았다. 저장 대상의 그림은 여기서 전건 확보한다.
    // ⚠ `setFigs`는 비동기 반영이라 이번 저장이 쓸 **스냅샷을 직접** 들고 간다.
    //   state가 갱신되기를 기다리면 첫 문항이 그림 없이 저장된다.
    const figSnapshot = new Map(figs);
    const missing = Array.from(new Set(targets.flatMap((t) => t.figNames))).filter((n) => !figSnapshot.has(n));
    if (missing.length > 0) {
      const got = await fetchFigures(missing, await user.getIdToken(), blobUrlsRef.current);
      for (const [k, v] of got) figSnapshot.set(k, v);
      setFigs(new Map(figSnapshot));          // 화면(결과 화면·되돌아가기)도 같은 것을 보게 한다
    }

    const results: SaveOutcome[] = [];

    const saveOne = async (item: PreviewItem) => {
      const d = item.draft!;
      let problemId: string | null = null;
      const uploaded: string[] = [];        // D7″ 롤백 대상
      try {
        const importSource: ImportSource = {
          provider: 'audition-sheet',
          sheet: fetchedSheet,
          row: item.rowIndex,
          source_id: d.sourceId,
          stem_hash: d.stemHash,
          imported_at: Date.now(),
        };
        problemId = await createProblem({
          title: d.title,
          source: d.source,                        // D4 — A열은 문자 그대로 "문제 출처"
          answer: d.answer,                        // D12 — D열만 쓴다. 비면 빈 값
          year: new Date().getFullYear(),          // 이하 AppShell 신규 문항 관례
          exam_type: '', category: '', difficulty: 3, tags: [],
          authorUid: user.uid,
          visibility: 'private',
          tabs: d.tabs,
          ...(folderId ? { folder_id: folderId } : {}),
          import_source: importSource,
        });
        // ── 그림: 파일명 → Storage URL (문항 안에서 한 번씩만, D17) ──
        const urlByFig = new Map<string, string>();
        let figFailed = 0;
        for (const figName of item.figNames) {
          const entry = figSnapshot.get(figName);
          if (entry?.kind !== 'ok') { figFailed++; continue; }
          // N-9: content-type을 실어야 uploadImage가 확장자를 옳게 고른다.
          const file = new File([entry.blob], figName, { type: entry.type });
          const url = await uploadImage(file, problemId);
          uploaded.push(url);
          urlByFig.set(figName, url);
        }

        for (const tab of d.tabs) {
          const blocks = item.persisted[tab.id] ?? [];
          for (let i = 0; i < blocks.length; i++) {
            await saveTabBlock(problemId, tab.id, materializeImage(blocks[i], d.blocksByTab[tab.id]?.[i], urlByFig));
          }
        }
        results.push({
          rowIndex: item.rowIndex, title: d.title, status: 'ok',
          ...(figFailed > 0 ? { detail: `그림 ${figFailed}개를 가져오지 못했습니다 — 본문에 파일명이 남습니다` } : {}),
        });
      } catch {
        // D7: 블록이 없는 고아 문항을 남기지 않는다. 방금 만든 것이라 잃을 게 없다.
        let detail = '저장 실패';
        if (problemId) {
          try { await deleteProblem(problemId); }
          catch { detail = '저장 실패 — 만들다 만 문항이 남았습니다. 수동 삭제가 필요합니다'; }
        }
        // D7″: deleteProblem은 Storage를 건드리지 않는다 — 방금 올린 그림을 따로 지운다(best-effort).
        for (const url of uploaded) {
          try { await deleteUploadedFile(url); }
          catch (e) { console.warn('[SheetImport] 롤백 중 그림 삭제 실패:', e); }
        }
        results.push({ rowIndex: item.rowIndex, title: d.title, status: 'fail', detail });
      } finally {
        setProgress((n) => n + 1);
      }
    };

    let cursor = 0;
    await Promise.all(
      Array.from({ length: Math.min(SAVE_CONCURRENCY, targets.length) }, async () => {
        while (cursor < targets.length) await saveOne(targets[cursor++]);
      }),
    );

    results.sort((a, b) => a.rowIndex - b.rowIndex);
    setOutcomes(results);
    setPhase('done');
    if (results.some((r) => r.status === 'ok')) onImported();
  };

  const toggle = (rowIndex: number) => setChecked((prev) => {
    const n = new Set(prev);
    if (n.has(rowIndex)) n.delete(rowIndex); else n.add(rowIndex);
    return n;
  });

  const failedRows = items.filter((i) => !i.draft).length;
  const dupeRows = items.filter((i) => i.dupe === 'existing' || i.dupe === 'inSelection').length;
  const trashedRows = items.filter((i) => i.dupe === 'trashed').length;
  const targetCount = items.filter((i) => i.draft && checked.has(i.rowIndex)).length;

  return (
    <div style={S.overlay} onClick={phase === 'saving' ? undefined : onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>

        <div style={S.head}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #222)', flex: 1 }}>
            시트에서 가져오기
            {phase === 'preview' && (
              <span style={{ marginLeft: 8, fontWeight: 500, color: 'var(--text-muted, #888)' }}>
                미리보기 · {items.length}행 → {folderName}
              </span>
            )}
          </div>
          {phase !== 'saving' && (
            <button onClick={onClose} title="닫기" style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted, #888)', display: 'flex' }}>
              <IconClose />
            </button>
          )}
        </div>

        <div style={S.body}>
          {phase === 'form' && (
            <FormPane
              sheet={sheet} setSheet={setSheet}
              rowsText={rowsText} setRowsText={setRowsText}
              includePreselected={includePreselected} setIncludePreselected={setIncludePreselected}
              autoFix={autoFix} setAutoFix={setAutoFix}
              folders={folders} folderId={folderId} setFolderId={setFolderId}
              onNewFolder={handleNewFolder}
              onEnter={() => { if (canSubmit && !busy) fetchRows(); }}
              error={error}
            />
          )}

          {phase === 'preview' && (
            <>
              {headerWarnings.map((w, i) => (
                <div key={i} style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>
                  ⚠ {w}
                </div>
              ))}
              {error && <div style={{ marginBottom: 8, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>{error}</div>}
              {items.length === 0 && (
                <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: 'var(--text-muted, #888)' }}>
                  조건에 맞는 행이 없습니다.
                </div>
              )}
              {items.map((item) => (
                <PreviewRow
                  key={item.rowIndex}
                  item={item}
                  figs={figs}
                  checked={checked.has(item.rowIndex)}
                  expanded={expanded === item.rowIndex}
                  onToggleCheck={() => toggle(item.rowIndex)}
                  onToggleExpand={() => {
                    const open = expanded === item.rowIndex ? null : item.rowIndex;
                    setExpanded(open);
                    // D16 — 펼칠 때 그 행의 그림만 받는다. 500행을 가져와도 아무도 안 볼 그림은 받지 않는다.
                    if (open !== null && item.figNames.length > 0) void loadFigures(item.figNames);
                  }}
                />
              ))}
            </>
          )}

          {phase === 'saving' && (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: 'var(--text-primary, #222)', marginBottom: 12 }}>
                가져오는 중… {progress} / {targetCount}
              </div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover, #eee)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${targetCount ? (progress / targetCount) * 100 : 0}%`, background: ACCENT, transition: 'width .2s' }} />
              </div>
            </div>
          )}

          {phase === 'done' && <DonePane outcomes={outcomes} folderName={folderName} />}
        </div>

        <div style={S.foot}>
          <div style={{ fontSize: 12, color: 'var(--text-muted, #888)' }}>
            {phase === 'preview' && (
              <>
                선택 {checked.size}건
                {dupeRows > 0 && ` · 이미 가져옴 ${dupeRows}건`}
                {trashedRows > 0 && ` · 휴지통에 있음 ${trashedRows}건`}
                {failedRows > 0 && ` · 오류 ${failedRows}건`}
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {phase === 'preview' && <button style={btn('ghost')} onClick={() => setPhase('form')}>뒤로</button>}
            {phase === 'form' && (
              <button style={btn('primary', !canSubmit || busy)} disabled={!canSubmit || busy} onClick={fetchRows}>
                {busy ? '불러오는 중…' : '미리보기'}
              </button>
            )}
            {phase === 'preview' && (
              <button style={btn('primary', targetCount === 0)} disabled={targetCount === 0} onClick={runImport}>
                {targetCount}건 가져오기
              </button>
            )}
            {phase === 'done' && <button style={btn('primary')} onClick={onClose}>닫기</button>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══ 설정 화면 ═══ */

function FormPane({
  sheet, setSheet, rowsText, setRowsText, includePreselected, setIncludePreselected,
  autoFix, setAutoFix, folders, folderId, setFolderId, onNewFolder, onEnter, error,
}: {
  sheet: SheetName; setSheet: (s: SheetName) => void;
  rowsText: string; setRowsText: (s: string) => void;
  includePreselected: boolean; setIncludePreselected: (b: boolean) => void;
  autoFix: boolean; setAutoFix: (b: boolean) => void;
  folders: Folder[]; folderId: string | null; setFolderId: (id: string | null) => void;
  onNewFolder: () => void; onEnter: () => void; error: string | null;
}) {
  const tree = useMemo(() => flattenVisible(buildFolderTree(folders), new Set()), [folders]);

  const row = (active: boolean, depth: number): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
    padding: '6px 10px', paddingLeft: 10 + depth * 14,
    border: 'none', borderRadius: 4, cursor: 'pointer', textAlign: 'left',
    fontSize: 13, fontFamily: 'var(--font-ui)',
    fontWeight: active ? 700 : 500,
    background: active ? 'rgba(188,95,63,0.10)' : 'transparent',
    color: active ? ACCENT : 'var(--text-primary, #222)',
  });

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={S.label}>원본 시트</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {SHEETS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSheet(s.id)}
              style={{
                flex: 1, padding: '10px 12px', textAlign: 'left', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-ui)',
                border: `1px solid ${sheet === s.id ? ACCENT : 'var(--border-light, #ddd)'}`,
                background: sheet === s.id ? 'rgba(188,95,63,0.06)' : 'transparent',
                color: 'var(--text-primary, #222)',
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>{s.hint}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={S.label}>행 범위</div>
        <input
          style={S.input}
          value={rowsText}
          onChange={(e) => setRowsText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onEnter(); }}
          placeholder="예: 15-32  또는  15, 17, 20-25"
        />
        <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 6 }}>
          시트의 실제 행 번호입니다(1행은 헤더이므로 데이터는 2행부터).
        </div>
      </div>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 18 }}>
        <input type="checkbox" checked={includePreselected} onChange={(e) => setIncludePreselected(e.target.checked)} style={{ marginTop: 2 }} />
        <span style={{ fontSize: 13, color: 'var(--text-primary, #222)' }}>
          사전 선별(M열 체크 표시)된 문제 포함하기
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>
            행 범위를 비워 두면 사전 선별 문제만 가져옵니다. 둘 다 쓰면 합집합입니다.
            <br />⚠ Data_DS는 검증을 새로 돌릴 때마다 M열 체크까지 비워집니다 — 체크는 Stack에서 하세요.
          </span>
        </span>
      </label>

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', marginBottom: 18 }}>
        <input type="checkbox" checked={autoFix} onChange={(e) => setAutoFix(e.target.checked)} style={{ marginTop: 2 }} />
        <span style={{ fontSize: 13, color: 'var(--text-primary, #222)' }}>
          가져오면서 문법 자동 수정 적용
          <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 2 }}>
            편집창 [교정]의 결정적 규칙과 같습니다 — 지수 중괄호, 맨 숫자·영문자 수식화,
            수식 뒤 조사 공백, tabular → 표, (ㄱ) → (1). 결과는 미리보기에서 확인하세요.
          </span>
        </span>
      </label>

      <div>
        <div style={S.label}>저장할 폴더</div>
        <div style={{
          border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
          maxHeight: 200, overflowY: 'auto', padding: 4,
        }}>
          <button style={row(folderId === null, 0)} onClick={() => setFolderId(null)}>
            <IconFolder size={14} /> 최상위(미지정)
          </button>
          {tree.map((n) => (
            <button key={n.folder.id} style={row(folderId === n.folder.id, n.depth + 1)} onClick={() => setFolderId(n.folder.id)}>
              <FolderGlyph folder={n.folder} size={14} /> {n.folder.name}
            </button>
          ))}
        </div>
        <button
          onClick={onNewFolder}
          style={{
            marginTop: 6, display: 'flex', alignItems: 'center', gap: 5,
            padding: '6px 10px', fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border-light, #ddd)', borderRadius: 6,
            background: 'transparent', color: 'var(--text-primary, #222)',
            cursor: 'pointer', fontFamily: 'var(--font-ui)',
          }}
        >
          <IconPlus /> 폴더 새로 만들기
        </button>
      </div>

      {error && <div style={{ marginTop: 14, padding: '8px 10px', borderRadius: 6, background: 'rgba(188,95,63,0.08)', fontSize: 12, color: ACCENT }}>{error}</div>}
    </>
  );
}

/**
 * 미리보기의 그림 한 장. **저장 후 보게 될 모습과 같아야 한다**(D7·D18) —
 * `imageTreatmentStyle` 기본값(multiply 블렌드 + 흑백)과 폭 400을 `TabBody`와 똑같이 쓴다.
 *
 * 실패하면 `\includegraphics{…}` 리터럴을 보여 준다 — 저장본에 남을 것과 같은 모습이다(D5).
 */
function FigurePreview({ figName, figs }: { figName: string; figs: Map<string, FigEntry> }) {
  const entry = figs.get(figName);
  const box: React.CSSProperties = { textAlign: 'center', margin: '1.2em 0' };

  if (!entry) {
    return <div style={{ ...box, fontSize: 12, color: 'var(--text-muted, #888)' }}>그림을 불러오는 중… {figName}</div>;
  }
  if (entry.kind === 'error') {
    return (
      <div style={{ ...box, fontSize: 12, color: ACCENT }}>
        {entry.error}
        <div style={{ marginTop: 4, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-muted, #888)' }}>
          {`\\includegraphics{${figName}}`} 가 본문에 남습니다
        </div>
      </div>
    );
  }
  return (
    <div style={box}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={entry.blobUrl} alt="" style={{
        width: 400, maxWidth: '90%', height: 'auto',
        ...imageTreatmentStyle({}),
      }} />
      {entry.dupes > 1 && (
        <div style={{ marginTop: 4, fontSize: 11, color: ACCENT }}>
          Drive에 같은 이름의 파일이 {entry.dupes}개 있습니다 — 가장 최근 것을 씁니다
        </div>
      )}
    </div>
  );
}

/* ═══ 미리보기 한 행 ═══ */

function PreviewRow({
  item, figs, checked, expanded, onToggleCheck, onToggleExpand,
}: {
  item: PreviewItem;
  figs: Map<string, FigEntry>;
  checked: boolean;
  expanded: boolean;
  onToggleCheck: () => void;
  onToggleExpand: () => void;
}) {
  const { draft, error, persisted, dupe } = item;
  const warned = dupe === 'existing' || dupe === 'inSelection';
  // D15: 중복이어도 체크는 막지 않는다. 막을 것은 초안이 아예 없는 오류 행뿐이다.
  const blocked = !draft;

  const summary = useMemo(
    () => (draft ? draft.tabs.map((t) => `${t.label} ${persisted[t.id]?.length ?? 0}블록`).join(' · ') : ''),
    [draft, persisted],
  );

  return (
    <div style={{
      border: '1px solid var(--border-light, #eee)', borderRadius: 6,
      marginBottom: 6, background: blocked || warned ? 'var(--bg-hover, #f7f7f7)' : 'transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px' }}>
        <input
          type="checkbox" checked={checked} disabled={blocked} onChange={onToggleCheck}
          title={dupe === 'existing' ? '이미 가져온 문항입니다 — 체크하면 한 벌 더 만듭니다'
               : dupe === 'inSelection' ? '이 선택 안에서 앞선 행과 같은 문항입니다'
               : dupe === 'trashed' ? '전에 가져왔지만 지금은 휴지통에 있습니다' : undefined}
        />
        <div onClick={draft ? onToggleExpand : undefined} style={{ flex: 1, cursor: draft ? 'pointer' : 'default', minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: blocked || warned ? 'var(--text-muted, #888)' : 'var(--text-primary, #222)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            <span style={{ ...badge('muted'), marginRight: 6 }}>{item.rowIndex}행</span>
            {draft ? draft.title : `가져올 수 없음 — ${error}`}
          </div>
          {draft && (
            <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 3, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <span>{summary}</span>
              {draft.answer && <span style={badge('muted')}>정답 {draft.answer}</span>}
              {item.figNames.length > 0 && <span style={badge('muted')}>그림 {item.figNames.length}</span>}
              {item.figNames.length >= 3 && <span style={badge('warn')}>그림 많음</span>}
              {item.autoFixCount > 0 && <span style={badge('ok')}>자동 수정 {item.autoFixCount}</span>}
              {draft.warnings.length > 0 && <span style={badge('warn')}>경고 {draft.warnings.length}</span>}
              {dupe === 'existing' && <span style={badge('warn')}>이미 가져옴</span>}
              {dupe === 'inSelection' && <span style={badge('warn')}>선택 안 중복</span>}
              {dupe === 'trashed' && <span style={badge('muted')}>휴지통에 있음</span>}
            </div>
          )}
        </div>
        {draft && (
          <span style={{ display: 'flex', color: 'var(--text-muted, #888)' }}>
            {expanded ? <IconChevronDown /> : <IconChevron />}
          </span>
        )}
      </div>

      {/* 접으면 언마운트 — KaTeX 인스턴스를 남기지 않는다 (D9) */}
      {expanded && draft && (
        <div style={{ borderTop: '1px solid var(--border-light, #eee)', padding: '12px 14px' }}>
          {draft.warnings.length > 0 && (
            <ul style={{ margin: '0 0 12px', paddingLeft: 18 }}>
              {draft.warnings.map((w, i) => <li key={i} style={{ fontSize: 12, color: ACCENT }}>{w}</li>)}
            </ul>
          )}
          {draft.tabs.map((tab) => (
            <div key={tab.id} style={{ marginBottom: 16 }}>
              <div style={{ ...S.label, marginBottom: 4 }}>{tab.label}</div>
              <div style={{
                border: '1px solid var(--border-light, #eee)', borderRadius: 6,
                padding: '10px 14px', background: 'var(--bg-content, #fff)',
              }}>
                {(persisted[tab.id] ?? []).map((b, i) => (
                  /* X3 — 타입 분기 필수. EditorPreview는 choices도 image도 모른다.
                     ⚠ image를 raw로 흘리면 컬러 원본이 뜨고 저장 후에는 흑백 multiply라
                       "미리보기 = 저장될 실물"(D7)이 깨진다 → TabBody와 같은 마크업을 쓴다(D18). */
                  b.type === 'choices' ? <ChoicesBlock key={i} rawText={b.raw_text} locale="ko" />
                  : b.type === 'image' ? (
                      <FigurePreview key={i} figName={draft.blocksByTab[tab.id]?.[i]?.figName ?? ''} figs={figs} />
                    )
                  : <EditorPreview key={i} content={b.raw_text} borderless locale="ko" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ 결과 ═══ */

function DonePane({ outcomes, folderName }: { outcomes: SaveOutcome[]; folderName: string }) {
  const ok = outcomes.filter((o) => o.status === 'ok');
  const fail = outcomes.filter((o) => o.status === 'fail');
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <span style={{ ...badge('ok'), fontSize: 12, padding: '4px 10px' }}>성공 {ok.length}</span>
        {fail.length > 0 && <span style={{ ...badge('warn'), fontSize: 12, padding: '4px 10px' }}>실패 {fail.length}</span>}
        <span style={{ ...badge('muted'), fontSize: 12, padding: '4px 10px' }}>{folderName}</span>
      </div>
      {fail.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={S.label}>실패한 행</div>
          {fail.map((o) => (
            <div key={o.rowIndex} style={{ fontSize: 12, color: ACCENT, marginBottom: 3 }}>
              {o.rowIndex}행 · {o.title} — {o.detail}
            </div>
          ))}
        </div>
      )}
      {ok.length > 0 && (
        <div>
          <div style={S.label}>가져온 문항</div>
          <div style={{ maxHeight: 260, overflowY: 'auto' }}>
            {ok.map((o) => (
              <div key={o.rowIndex} style={{ fontSize: 12, color: 'var(--text-primary, #222)', marginBottom: 3 }}>
                <span style={{ ...badge('muted'), marginRight: 6 }}>{o.rowIndex}행</span>{o.title}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
