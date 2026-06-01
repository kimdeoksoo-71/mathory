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
} from 'firebase/firestore';
import { db } from './firebase';
import { Problem, Block, ProblemWithBlocks, Folder, TabMeta, DEFAULT_TABS, tabSubcollection } from '../types/problem';

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
export async function moveProblemToFolder(problemId: string, folderId: string | null): Promise<void> {
  await updateDoc(doc(db, 'problems', problemId), {
    folder_id: folderId,
    updated_at: serverTimestamp(),
  });
}

// ===== Block CRUD =====

export async function getProblemWithBlocks(problemId: string): Promise<ProblemWithBlocks | null> {
  const problem = await getProblem(problemId);
  if (!problem) return null;

  // 탭 메타데이터 (없으면 기본 2탭)
  const tabs = problem.tabs || DEFAULT_TABS;

  // 각 탭의 블록 로드 — 권한 거부(예: 멤버에게 숨겨진 탭)는 빈 배열로 처리하고 계속 진행
  const tabBlocks: Record<string, Block[]> = {};
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
    }
  }

  return {
    ...problem,
    tabs,
    question_blocks: tabBlocks['question'] || [],
    solution_blocks: tabBlocks['solution'] || [],
    tabBlocks,
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

export async function createFolder(data: { name: string; user_id: string; order?: number }): Promise<string> {
  const docRef = await addDoc(collection(db, 'folders'), {
    name: data.name,
    user_id: data.user_id,
    order: data.order ?? 0,
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

export async function updateFolder(folderId: string, data: { name?: string; order?: number; icon?: string }): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteFolder(folderId: string, userId: string): Promise<void> {
  // 폴더 삭제 시 해당 폴더의 문항들은 미분류로 변경
  // Stage 0: Rules가 authorUid 기반 인가 → 쿼리에도 명시
  const q = query(
    collection(db, 'problems'),
    where('authorUid', '==', userId),
    where('folder_id', '==', folderId)
  );
  const snapshot = await getDocs(q);
  const updates = snapshot.docs.map((d) =>
    updateDoc(d.ref, { folder_id: null, updated_at: serverTimestamp() })
  );
  await Promise.all(updates);
  await deleteDoc(doc(db, 'folders', folderId));
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