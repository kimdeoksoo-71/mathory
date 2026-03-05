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
import { Problem, Block, ProblemWithBlocks, Folder } from '../types/problem';

// ===== Problem CRUD =====

export async function createProblem(data: Omit<Problem, 'id' | 'created_at' | 'updated_at'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'problems'), {
    ...data,
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
  const qBlocks = await getDocs(collection(db, 'problems', problemId, 'question_blocks'));
  const sBlocks = await getDocs(collection(db, 'problems', problemId, 'solution_blocks'));

  const deletes = [
    ...qBlocks.docs.map((d) => deleteDoc(d.ref)),
    ...sBlocks.docs.map((d) => deleteDoc(d.ref)),
  ];
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

export async function listProblems(filter?: ProblemFilter): Promise<Problem[]> {
  let q = query(collection(db, 'problems'), orderBy('updated_at', 'desc'));

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
export async function listRecentProblems(maxCount: number = 10): Promise<Problem[]> {
  const q = query(
    collection(db, 'problems'),
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

  const qSnap = await getDocs(
    query(collection(db, 'problems', problemId, 'question_blocks'), orderBy('order'))
  );
  const sSnap = await getDocs(
    query(collection(db, 'problems', problemId, 'solution_blocks'), orderBy('order'))
  );

  const question_blocks = qSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Block));
  const solution_blocks = sSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Block));

  return { ...problem, question_blocks, solution_blocks };
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

export async function updateFolder(folderId: string, data: { name?: string; order?: number }): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteFolder(folderId: string): Promise<void> {
  // 폴더 삭제 시 해당 폴더의 문항들은 미분류로 변경
  const q = query(collection(db, 'problems'), where('folder_id', '==', folderId));
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
export async function getFolderProblemCount(folderId: string): Promise<number> {
  const q = query(collection(db, 'problems'), where('folder_id', '==', folderId));
  const snapshot = await getDocs(q);
  return snapshot.size;
}