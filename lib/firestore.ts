import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Problem, Block, ProblemWithBlocks } from '../types/problem';

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
  // 블록들도 함께 삭제
  const qBlocks = await getDocs(collection(db, 'problems', problemId, 'question_blocks'));
  const sBlocks = await getDocs(collection(db, 'problems', problemId, 'solution_blocks'));

  const deletes = [
    ...qBlocks.docs.map((d) => deleteDoc(d.ref)),
    ...sBlocks.docs.map((d) => deleteDoc(d.ref)),
  ];
  await Promise.all(deletes);
  await deleteDoc(doc(db, 'problems', problemId));
}

export async function listProblems(): Promise<Problem[]> {
  const q = query(collection(db, 'problems'), orderBy('created_at', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as Problem;
  });
}

// ===== Block CRUD =====

async function getBlocks(problemId: string, subcollection: string): Promise<Block[]> {
  const q = query(
    collection(db, 'problems', problemId, subcollection),
    orderBy('order', 'asc')
  );
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as Block[];
}

export async function getQuestionBlocks(problemId: string): Promise<Block[]> {
  return getBlocks(problemId, 'question_blocks');
}

export async function getSolutionBlocks(problemId: string): Promise<Block[]> {
  return getBlocks(problemId, 'solution_blocks');
}

export async function getProblemWithBlocks(problemId: string): Promise<ProblemWithBlocks | null> {
  const problem = await getProblem(problemId);
  if (!problem) return null;

  const [question_blocks, solution_blocks] = await Promise.all([
    getQuestionBlocks(problemId),
    getSolutionBlocks(problemId),
  ]);

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