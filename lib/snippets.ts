import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { MathSnippet } from '../types/snippet';

function snippetsCollection(userId: string) {
  return collection(db, 'users', userId, 'math_snippets');
}

export async function listSnippets(userId: string): Promise<MathSnippet[]> {
  const q = query(snippetsCollection(userId), orderBy('shortcutIndex', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      shortcutIndex: data.shortcutIndex,
      content: data.content,
      order: data.order ?? data.shortcutIndex,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as MathSnippet;
  });
}

export async function createSnippet(
  userId: string,
  data: { name: string; shortcutIndex: number; content: string }
): Promise<string> {
  const docRef = await addDoc(snippetsCollection(userId), {
    name: data.name,
    shortcutIndex: data.shortcutIndex,
    content: data.content,
    order: data.shortcutIndex,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateSnippet(
  userId: string,
  snippetId: string,
  data: Partial<{ name: string; shortcutIndex: number; content: string }>
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'math_snippets', snippetId), {
    ...data,
    updated_at: serverTimestamp(),
  });
}

export async function deleteSnippet(userId: string, snippetId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'math_snippets', snippetId));
}