import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  limit,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { deleteAllVersions } from './version/prune';
import { Problem, Block, ProblemWithBlocks, Folder, TabMeta, DEFAULT_TABS, tabSubcollection, VerifyKind, VerificationState } from '../types/problem';

// ===== 특수 폴더 상수 =====
export const TRASH_FOLDER_ID = '__trash__';
export const UNASSIGNED_FOLDER_ID = '__unassigned__';
// Stage 2: 멤버 공유로 받은 문항 가상 폴더
export const SHARED_WITH_ME_FOLDER_ID = '__shared_with_me__';

// ===== Problem CRUD =====

export async function createProblem(data: Omit<Problem, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  // Firestore는 undefined 값을 거부하므로 사전 제거
  const cleaned: Record<string, any> = {};
  for (const k in data) {
    const v = (data as any)[k];
    if (v !== undefined) cleaned[k] = v;
  }
  const docRef = await addDoc(collection(db, 'problems'), {
    ...cleaned,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function getProblem(problemId: string): Promise<Problem | null> {
  const docSnap = await getDoc(doc(db, 'problems', problemId));
  if (!docSnap.exists()) return null;

  const data = docSnap.data();
  return {
    id: docSnap.id,
    ...data,
    created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
    updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
  } as Problem;
}

export async function updateProblem(problemId: string, data: Partial<Problem>): Promise<void> {
  const { id, created_at, ...updateData } = data as Problem;
  await updateDoc(doc(db, 'problems', problemId), {
    ...updateData,
    updated_at: serverTimestamp(),
  });
}

/**
 * Phase 61b: 검증 상태만 갱신.
 *
 * ⚠️ `updateProblem`을 쓰면 안 된다 — 그쪽은 무조건 `updated_at`을 serverTimestamp로
 *    갱신하는데 목록이 `updated_at desc` 정렬이라, 편집하지도 않은 문항이 검증만으로
 *    맨 위로 올라온다.
 */
export async function setVerification(
  problemId: string,
  kind: VerifyKind,
  patch: NonNullable<VerificationState[VerifyKind]>,
): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    [`verification.${kind}`]: patch,
  });
}

/** Phase 47: 댓글 가시성 토글 (오너 전용). false = 멤버에게 댓글 숨김 */
export async function setCommentsVisible(problemId: string, visible: boolean): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    commentsVisible: visible,
    updated_at: serverTimestamp(),
  });
}

/**
 * Phase 51: 실시간 공개 ON/OFF (오너 전용).
 * 공개 시 publishedAt을 1회 스탬프(비공개→재공개 시 갱신 → PublishList 상단 복귀).
 * 일반 편집(updateProblem)은 publishedAt을 건드리지 않으므로 정렬이 출렁이지 않는다.
 * 비공개 전환 시 publishedAt은 보존(재공개 때 갱신).
 */
export async function setProblemPublic(problemId: string, isPublic: boolean): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), isPublic
    ? { visibility: 'public', publishedAt: serverTimestamp(), updated_at: serverTimestamp() }
    : { visibility: 'private', updated_at: serverTimestamp() });
}

/** Phase 47: 댓글 쓰기 허용 토글 (오너 전용). false = 멤버 작성 동결 */
export async function setCommentsWritable(problemId: string, writable: boolean): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    commentsWritable: writable,
    updated_at: serverTimestamp(),
  });
}

// Phase 52(N1): 공개 댓글 작성 opt-in. 멤버용 commentsWritable과 분리(두 청중 독립 제어).
export async function setPublicCommentsEnabled(problemId: string, enabled: boolean): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    publicCommentsEnabled: enabled,
    updated_at: serverTimestamp(),
  });
}

export async function deleteProblem(problemId: string): Promise<void> {
  // 탭 메타데이터 읽기 (없으면 기본 2탭)
  const problem = await getProblem(problemId);
  const tabs = problem?.tabs || DEFAULT_TABS;

  const deletes: Promise<void>[] = [];
  for (const tab of tabs) {
    const subcol = tabSubcollection(tab.id);
    const snap = await getDocs(collection(db, 'problems', problemId, subcol));
    snap.docs.forEach((d) => deletes.push(deleteDoc(d.ref)));
  }
  await Promise.all(deletes);
  await deleteAllVersions(problemId);   // Phase 55: versions + payload cascade 정리
  await deleteDoc(doc(db, 'problems', problemId));
}

export interface ProblemFilter {
  year?: number;
  exam_type?: string;
  category?: string;
  difficulty?: number;
  searchText?: string;
  folder_id?: string;
}

export async function listProblems(userId: string, filter?: ProblemFilter): Promise<Problem[]> {
  // Stage 0: Firestore Rules가 authorUid 기반 인가를 하므로 쿼리에도 명시 필요
  let q = query(
    collection(db, 'problems'),
    where('authorUid', '==', userId),
    orderBy('updated_at', 'desc')
  );

  if (filter?.year) q = query(q, where('year', '==', filter.year));
  if (filter?.exam_type) q = query(q, where('exam_type', '==', filter.exam_type));
  if (filter?.category) q = query(q, where('category', '==', filter.category));
  if (filter?.difficulty) q = query(q, where('difficulty', '==', filter.difficulty));
  if (filter?.folder_id) q = query(q, where('folder_id', '==', filter.folder_id));

  const snapshot = await getDocs(q);
  let results = snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
      // Phase 51: 실시간 공개 정렬용. 없으면 undefined(PublishList가 created_at으로 폴백)
      publishedAt: (data.publishedAt as Timestamp | undefined)?.toDate(),
    } as Problem;
  });

  if (filter?.searchText) {
    const text = filter.searchText.toLowerCase();
    results = results.filter(
      (p) =>
        p.title.toLowerCase().includes(text) ||
        p.tags?.some((t) => t.toLowerCase().includes(text))
    );
  }

  return results;
}

// Phase 6: 최근 문항 조회
export async function listRecentProblems(userId: string, maxCount: number = 10): Promise<Problem[]> {
  const q = query(
    collection(db, 'problems'),
    where('authorUid', '==', userId),
    orderBy('updated_at', 'desc'),
    limit(maxCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as Problem;
  });
}

// Phase 6: 문항의 폴더 변경
// Phase 63 D20′(Q14) — 이동은 편집이 아니다: updated_at을 찍지 않는다. 목록이 updated_at
// 정렬이라 이동만으로 문항이 "최근 수정"으로 둔갑하던 것을 끊는다(61b가 검증에 내린 것과
// 같은 판단). ⚠ 휴지통으로의 이동(moveToTrash)만 예외로 찍는다 — 휴지통에서 updated_at은
// 사실상 "버린 시각"이고 휴지통 기본 정렬(최근 버린 순)이 그 값을 읽는다.
export async function moveProblemToFolder(problemId: string, folderId: string | null): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    folder_id: folderId,
  });
}

/** Phase 63 D19 — 다중 선택 일괄 이동. writeBatch 500 한도는 청크 루프로.
 *  스탬프 규칙은 함수 내부에(호출부 분기 금지 — 갈래 방지): 휴지통 타깃만 updated_at을
 *  찍는다(Q14 — 휴지통에서 그 값은 "버린 시각"이고 기본 정렬이 읽는다). */
export async function moveProblemsToFolder(problemIds: string[], folderId: string | null): Promise<void> {
  for (let i = 0; i < problemIds.length; i += 500) {
    const chunk = problemIds.slice(i, i + 500);
    const batch = writeBatch(db);
    for (const id of chunk) {
      batch.update(doc(db, 'problems', id),
        folderId === TRASH_FOLDER_ID
          ? { folder_id: folderId, updated_at: serverTimestamp() }
          : { folder_id: folderId });
    }
    await batch.commit();
  }
}

// ===== Block CRUD =====

export async function getProblemWithBlocks(problemId: string): Promise<ProblemWithBlocks | null> {
  const problem = await getProblem(problemId);
  if (!problem) return null;

  // 탭 메타데이터 (없으면 기본 2탭)
  const tabs = problem.tabs || DEFAULT_TABS;

  // 각 탭의 블록 로드 — 권한 거부(예: 멤버에게 숨겨진 탭)는 빈 배열로 처리하고 계속 진행
  const tabBlocks: Record<string, Block[]> = {};
  // Phase 55(F7): 로드 실패 탭을 밖으로 노출 → "정상적으로 빈 탭" vs "로드 실패" 구분.
  //   catch가 모든 에러를 빈 배열로 삼키므로 여기서 기록하지 않으면 adapter가 구분 불가.
  const tabLoadErrors: Record<string, string> = {};
  for (const tab of tabs) {
    const subcol = tabSubcollection(tab.id);
    try {
      const snap = await getDocs(
        query(collection(db, 'problems', problemId, subcol), orderBy('order'))
      );
      tabBlocks[tab.id] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Block));
    } catch (err: any) {
      // permission-denied는 정상 (해당 탭이 멤버에게 비공개) — 그 외 에러도 일단 비우고 계속
      console.warn(`[getProblemWithBlocks] ${tab.id} 로드 스킵:`, err?.code || err?.message);
      tabBlocks[tab.id] = [];
      tabLoadErrors[tab.id] = err?.code || err?.message || 'unknown';
    }
  }

  return {
    ...problem,
    tabs,
    question_blocks: tabBlocks['question'] || [],
    solution_blocks: tabBlocks['solution'] || [],
    tabBlocks,
    ...(Object.keys(tabLoadErrors).length ? { tabLoadErrors } : {}),
  };
}

/** 문제의 question 탭 블록만 경량 로딩 (FolderView 미리보기용) */
export async function getQuestionBlocks(problemId: string): Promise<Block[]> {
  const subcol = tabSubcollection('question');
  const snap = await getDocs(
    query(collection(db, 'problems', problemId, subcol), orderBy('order'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Block));
}

/** 검색 인덱스용 — 한 문항의 모든 탭 블록 raw_text를 이어붙여 소문자로 반환 */
export async function getProblemSearchText(problemId: string, tabs: TabMeta[]): Promise<string> {
  const ordered = (tabs && tabs.length > 0) ? tabs : DEFAULT_TABS;
  const parts: string[] = [];
  for (const tab of ordered) {
    try {
      const snap = await getDocs(
        query(collection(db, 'problems', problemId, tabSubcollection(tab.id)), orderBy('order'))
      );
      for (const d of snap.docs) {
        const block = d.data() as Block;
        if (block.raw_text) parts.push(block.raw_text);
        if (block.title) parts.push(block.title);
      }
    } catch {
      // 권한 거부된 탭은 스킵
    }
  }
  return parts.join('\n').toLowerCase();
}

/** 카드 미리보기용 — 첫 비어있지 않은 탭의 블록을 반환 (question 비면 solution → 그다음 탭…). */
export async function getPreviewBlocks(problemId: string, tabs: TabMeta[]): Promise<Block[]> {
  const ordered = (tabs && tabs.length > 0) ? tabs : DEFAULT_TABS;
  for (const tab of ordered) {
    try {
      const snap = await getDocs(
        query(collection(db, 'problems', problemId, tabSubcollection(tab.id)), orderBy('order'))
      );
      const blocks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Block));
      // 실제 내용이 있는 블록이 하나라도 있으면 채택
      const hasContent = blocks.some((b) => (b.raw_text || '').trim() !== '');
      if (hasContent) return blocks;
    } catch {
      // 권한 거부 등은 건너뛰고 다음 탭으로
    }
  }
  return [];
}

/**
 * Phase 51: problems/{id} 문서 실시간 구독 (공개 live 뷰어용).
 * 비공개 문항을 비오너가 구독하면 permission-denied → onError로 전달(뷰어가 "비공개" 안내).
 * @returns 구독 해제 함수
 */
export function watchProblem(
  problemId: string,
  callback: (problem: Problem | null) => void,
  onError?: (err: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, 'problems', problemId),
    (snap) => {
      if (!snap.exists()) { callback(null); return; }
      const data = snap.data();
      callback({
        id: snap.id,
        ...data,
        created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
        updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
        publishedAt: (data.publishedAt as Timestamp | undefined)?.toDate(),
      } as Problem);
    },
    (err) => onError?.(err),
  );
}

/**
 * Phase 51(P2): 한 탭의 블록을 실시간 구독 (공개 live 뷰어용).
 * 비공개 탭은 규칙(4-1)이 막아 permission-denied → 에러 콜백에서 무시(빈 상태 유지).
 * live 뷰어는 getPreviewBlocks를 쓰지 말 것(첫 탭만 반환 + 권한 에러 silent → 다중 탭 부적합).
 * visible 탭마다 watchTabBlocks를 구독한다.
 * @returns 구독 해제 함수
 */
export function watchTabBlocks(
  problemId: string,
  tabId: string,
  callback: (blocks: Block[]) => void,
): () => void {
  const q = query(
    collection(db, 'problems', problemId, tabSubcollection(tabId)),
    orderBy('order'),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Block))),
    (err) => console.warn(`[watchTabBlocks] ${tabId} 구독 오류:`, err),
  );
}

async function saveBlock(
  problemId: string,
  subcollection: string,
  block: Omit<Block, 'id'>
): Promise<string> {
  const docRef = await addDoc(
    collection(db, 'problems', problemId, subcollection),
    block
  );
  return docRef.id;
}

export async function saveQuestionBlock(problemId: string, block: Omit<Block, 'id'>): Promise<string> {
  return saveBlock(problemId, 'question_blocks', block);
}

export async function saveSolutionBlock(problemId: string, block: Omit<Block, 'id'>): Promise<string> {
  return saveBlock(problemId, 'solution_blocks', block);
}

/** 범용 탭 블록 저장 */
export async function saveTabBlock(problemId: string, tabId: string, block: Omit<Block, 'id'>): Promise<string> {
  return saveBlock(problemId, tabSubcollection(tabId), block);
}

export async function updateBlock(
  problemId: string,
  subcollection: string,
  blockId: string,
  data: Partial<Block>
): Promise<void> {
  const { id, ...updateData } = data as Block;
  await updateDoc(doc(db, 'problems', problemId, subcollection, blockId), updateData);
}

export async function deleteBlock(
  problemId: string,
  subcollection: string,
  blockId: string
): Promise<void> {
  await deleteDoc(doc(db, 'problems', problemId, subcollection, blockId));
}

/** 탭의 모든 블록 삭제 */
export async function deleteAllTabBlocks(problemId: string, tabId: string): Promise<void> {
  const subcol = tabSubcollection(tabId);
  const snap = await getDocs(collection(db, 'problems', problemId, subcol));
  const deletes = snap.docs.map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
}

// ===== Folder CRUD (Phase 6) =====

export async function createFolder(data: { name: string; user_id: string; order?: number; parent_id?: string | null }): Promise<string> {
  const docRef = await addDoc(collection(db, 'folders'), {
    name: data.name,
    user_id: data.user_id,
    order: data.order ?? 0,
    parent_id: data.parent_id ?? null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function listFolders(userId: string): Promise<Folder[]> {
  const q = query(
    collection(db, 'folders'),
    where('user_id', '==', userId),
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as unknown as Folder;
  });
}

export async function updateFolder(folderId: string, data: { name?: string; order?: number; icon?: string; parent_id?: string | null }): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteFolder(folderId: string, userId: string): Promise<void> {
  // Phase 40: 하위 폴더까지 함께 삭제. 대상 폴더 + 모든 자손의 문항은 미분류로 이동.
  // Stage 0: Rules가 authorUid 기반 인가 → 쿼리에도 명시
  const allFolders = await listFolders(userId);
  const childrenOf = new Map<string, string[]>();
  for (const f of allFolders) {
    if (!f.parent_id) continue;
    if (!childrenOf.has(f.parent_id)) childrenOf.set(f.parent_id, []);
    childrenOf.get(f.parent_id)!.push(f.id);
  }
  // 삭제 대상(자기 + 자손) id 수집
  const targetIds: string[] = [];
  const stack = [folderId];
  const seen = new Set<string>();
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    targetIds.push(id);
    for (const childId of childrenOf.get(id) ?? []) stack.push(childId);
  }

  // 대상 폴더들의 문항을 미분류로 이동
  await Promise.all(targetIds.map(async (id) => {
    const q = query(
      collection(db, 'problems'),
      where('authorUid', '==', userId),
      where('folder_id', '==', id)
    );
    const snapshot = await getDocs(q);
    // Phase 63 D20′ — 폴더 삭제로 인한 미분류 이동도 편집이 아니다: updated_at 미갱신
    await Promise.all(snapshot.docs.map((d) =>
      updateDoc(d.ref, { folder_id: null })
    ));
  }));

  // 폴더 문서 삭제
  await Promise.all(targetIds.map((id) => deleteDoc(doc(db, 'folders', id))));
}

// Phase 10: 폴더 순서 일괄 업데이트
export async function updateFolderOrders(folderOrders: { id: string; order: number }[]): Promise<void> {
  const updates = folderOrders.map((f) =>
    updateDoc(doc(db, 'folders', f.id), {
      order: f.order,
      updated_at: serverTimestamp(),
    })
  );
  await Promise.all(updates);
}

// 폴더별 문항 수 조회
export async function getFolderProblemCount(folderId: string, userId: string): Promise<number> {
  const q = query(
    collection(db, 'problems'),
    where('authorUid', '==', userId),
    where('folder_id', '==', folderId)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
}

// ===== Phase 14: 문제 복제 =====
/** Firestore는 undefined 값을 거부하므로 undefined 필드를 제거 */
function stripUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key in obj) {
    if (obj[key] !== undefined) result[key] = obj[key];
  }
  return result;
}

export async function duplicateProblem(problemId: string, authorUid?: string): Promise<string> {
  const original = await getProblemWithBlocks(problemId);
  if (!original) throw new Error('원본 문제를 찾을 수 없습니다.');

  const tabs = original.tabs || DEFAULT_TABS;

  // 새 문제 생성 (제목에 "의 사본" 추가) — undefined 필드 제거
  // 사본은 새 작품으로 간주: copyright/blockchain 미상속, authorUid는 현재 사용자
  // visibility는 기본 'private' (사본은 원본의 공개 범위를 자동 상속하지 않음)
  const newId = await createProblem(stripUndefined({
    title: `${original.title}의 사본`,
    year: original.year,
    exam_type: original.exam_type,
    category: original.category,
    difficulty: original.difficulty,
    tags: [...original.tags],
    answer: original.answer,
    source: original.source,
    subject: original.subject,
    folder_id: original.folder_id,
    tabs,
    authorUid: authorUid ?? original.authorUid,
    visibility: 'private' as const,
  }) as any);

  // 각 탭의 블록 복제 — undefined 필드 제거
  for (const tab of tabs) {
    const blocks = original.tabBlocks[tab.id] || [];
    for (const block of blocks) {
      await saveTabBlock(newId, tab.id, stripUndefined({
        order: block.order,
        type: block.type,
        raw_text: block.raw_text,
        title: block.title,
        step_label: block.step_label,
        imageWidth: block.imageWidth,
        imageTreatment: block.imageTreatment,
        imageGray: block.imageGray,
        svg_initial_view: block.svg_initial_view,
        svg_height: block.svg_height,
        ggb_initial_coords: block.ggb_initial_coords,
        ggb_height: block.ggb_height,
      }) as any);
    }
  }

  return newId;
}

// ===== Phase 14: 휴지통 =====
export async function moveToTrash(problemId: string): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    folder_id: TRASH_FOLDER_ID,
    updated_at: serverTimestamp(),
  });
}

export async function emptyTrash(userId: string): Promise<void> {
  const q = query(
    collection(db, 'problems'),
    where('authorUid', '==', userId),
    where('folder_id', '==', TRASH_FOLDER_ID)
  );
  const snapshot = await getDocs(q);

  for (const docSnap of snapshot.docs) {
    await deleteProblem(docSnap.id);
  }
}