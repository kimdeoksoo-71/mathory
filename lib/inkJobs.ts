/**
 * Phase 69 — iPad 필기 입력의 Firestore·Storage 접촉 전부.
 *
 *   users/{uid}/ink_jobs/{jobId}     iPad가 만들고(ready) 데스크톱이 inserted로 바꾸거나 지운다. inserted = 그 문항의 필기 첨부
 *   users/{uid}/ink_state/presence   데스크톱 EditorView가 쓰는 준비 상태(판정은 lib/ink/presence)
 *   ink/{uid}/{jobId}.png · .json    원본 PNG · 획 JSON(Mathpix strokes 형식)
 *
 * ⚠ `lib/ink/`에 두지 말 것 — 그 폴더는 import 0 순수 모듈(`test:ink`)이다(lib/askQuestions·lib/verifyFlow와 같은 규약).
 * ⚠ `lib/ocr.ts`(교정 엔진 1,155행)·`lib/storage.ts`(DOMPurify)를 import하지 않는다 — `/ink` 번들에 실린다.
 * ⚠ `problems/{id}/…` 밑에 두지 말 것 — 그 와일드카드 규칙은 _blocks 아닌 서브컬렉션을 공개·멤버에게 read 허용한다.
 */
import {
  collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, getDocs, serverTimestamp,
  type Unsubscribe, type DocumentData,
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { app, db } from './firebase';
import type { PresenceDoc, PresenceReason } from './ink/presence';

const storage = getStorage(app);

export interface InkJob {
  id: string;
  status: 'ready' | 'inserted';
  /** Mathpix `text`(정규화 전 원문) */
  ocrText: string;
  /** Mathpix `latex_styled` — 이미지 전체가 식 하나일 때만 */
  ocrLatex?: string;
  confidence?: number;
  isHandwritten?: boolean;
  ocrError?: string;
  imagePath: string;
  imageUrl: string;
  strokesPath: string;
  createdAtMs: number | null;
  problemId?: string;
  tabId?: string;
  blockId?: string;
  finalText?: string;
  insertedAtMs?: number | null;
}

const jobsCol = (uid: string) => collection(db, 'users', uid, 'ink_jobs');
const presenceRef = (uid: string) => doc(db, 'users', uid, 'ink_state', 'presence');

function tsMs(v: unknown): number | null {
  return v && typeof (v as { toMillis?: unknown }).toMillis === 'function' ? (v as { toMillis(): number }).toMillis() : null;
}

function toJob(id: string, d: DocumentData): InkJob {
  return {
    id,
    status: d.status === 'inserted' ? 'inserted' : 'ready',
    ocrText: typeof d.ocrText === 'string' ? d.ocrText : '',
    ocrLatex: typeof d.ocrLatex === 'string' ? d.ocrLatex : undefined,
    confidence: typeof d.confidence === 'number' ? d.confidence : undefined,
    isHandwritten: typeof d.isHandwritten === 'boolean' ? d.isHandwritten : undefined,
    ocrError: typeof d.ocrError === 'string' ? d.ocrError : undefined,
    imagePath: d.imagePath ?? '',
    imageUrl: d.imageUrl ?? '',
    strokesPath: d.strokesPath ?? '',
    createdAtMs: tsMs(d.createdAt),
    problemId: d.problemId,
    tabId: d.tabId,
    blockId: d.blockId,
    finalText: typeof d.finalText === 'string' ? d.finalText : undefined,
    insertedAtMs: tsMs(d.insertedAt),
  };
}

/** 쓰기 전에 id만 받는다(Storage 경로에 같은 id를 쓴다) */
export function newInkJobId(uid: string): string {
  return doc(jobsCol(uid)).id;
}

/**
 * 완료 = [PNG 업로드 → URL] · [획 JSON 업로드] · [`/api/ocr` withLatex] 병렬 → job 문서(ready).
 * OCR 실패는 `ocrError`로 남기고 계속(데스크톱 카드에서 직접 입력) · 업로드·문서 쓰기 실패는 throw(올라간 파일은 best-effort 삭제).
 */
export async function sendInkJob(inp: {
  uid: string; jobId: string; png: Blob; pngDataUrl: string; strokesJson: string;
}): Promise<void> {
  const { uid, jobId } = inp;
  const imagePath = `ink/${uid}/${jobId}.png`;
  const strokesPath = `ink/${uid}/${jobId}.json`;
  const pngRef = ref(storage, imagePath);
  const jsonRef = ref(storage, strokesPath);
  const cleanup = () => Promise.allSettled([deleteObject(pngRef), deleteObject(jsonRef)]);

  const upPng = uploadBytes(pngRef, inp.png, { contentType: 'image/png' }).then(() => getDownloadURL(pngRef));
  const upJson = uploadBytes(jsonRef, new Blob([inp.strokesJson], { type: 'application/json' }), { contentType: 'application/json' });
  const ocr = fetch('/api/ocr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ src: inp.pngDataUrl, withLatex: true }),
  })
    .then(async (r) => {
      const d = await r.json().catch(() => ({}));
      return r.ok ? d : { error: d?.error || `OCR 실패 (${r.status})` };
    })
    .catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));

  const [pngRes, jsonRes, ocrRes] = await Promise.allSettled([upPng, upJson, ocr]);
  if (pngRes.status === 'rejected' || jsonRes.status === 'rejected') {
    await cleanup();
    throw pngRes.status === 'rejected' ? pngRes.reason : (jsonRes as PromiseRejectedResult).reason;
  }
  const o = (ocrRes.status === 'fulfilled' ? ocrRes.value : { error: String(ocrRes.reason) }) as Record<string, unknown>;

  const data: Record<string, unknown> = {
    status: 'ready',
    ocrText: typeof o.text === 'string' ? o.text : '',
    imagePath,
    imageUrl: pngRes.value,
    strokesPath,
    createdAt: serverTimestamp(),
  };
  if (typeof o.latex === 'string' && o.latex.trim()) data.ocrLatex = o.latex;
  if (typeof o.confidence === 'number') data.confidence = o.confidence;
  if (typeof o.isHandwritten === 'boolean') data.isHandwritten = o.isHandwritten;
  if (o.error) data.ocrError = String(o.error).slice(0, 300);

  try {
    await setDoc(doc(jobsCol(uid), jobId), data);
  } catch (e) {
    await cleanup();
    throw e;
  }
}

/** `ready` job 구독 — 단일 조건(복합 인덱스 0) · 클라 정렬 createdAt 오름차순 */
export function subscribeReadyJobs(uid: string, cb: (jobs: InkJob[]) => void, onError?: (e: Error) => void): Unsubscribe {
  return onSnapshot(
    query(jobsCol(uid), where('status', '==', 'ready')),
    (snap) => {
      const jobs = snap.docs.map((d) => toJob(d.id, d.data({ serverTimestamps: 'estimate' })));
      jobs.sort((a, b) => (a.createdAtMs ?? Infinity) - (b.createdAtMs ?? Infinity));
      cb(jobs);
    },
    (e) => onError?.(e),
  );
}

export async function markInserted(uid: string, jobId: string, at: {
  problemId: string; tabId: string; blockId: string; finalText: string;
}): Promise<void> {
  await updateDoc(doc(jobsCol(uid), jobId), { status: 'inserted', ...at, insertedAt: serverTimestamp() });
}

/** 취소·첨부 삭제 — 문서는 기다리고, Storage 2파일은 best-effort */
export async function discardJob(uid: string, job: Pick<InkJob, 'id' | 'imagePath' | 'strokesPath'>): Promise<void> {
  await deleteDoc(doc(jobsCol(uid), job.id));
  const paths = [job.imagePath, job.strokesPath].filter(Boolean);
  await Promise.allSettled(paths.map((p) => deleteObject(ref(storage, p))));
}

/** 문항의 필기 첨부(= inserted job) — `problemId` 단일 조건 + 클라 필터, insertedAt 내림차순 */
export async function listAttachments(uid: string, problemId: string): Promise<InkJob[]> {
  const snap = await getDocs(query(jobsCol(uid), where('problemId', '==', problemId)));
  return snap.docs
    .map((d) => toJob(d.id, d.data({ serverTimestamps: 'estimate' })))
    .filter((j) => j.status === 'inserted')
    .sort((a, b) => (b.insertedAtMs ?? 0) - (a.insertedAtMs ?? 0));
}

export const deleteAttachment = discardJob;

/* ── presence ── */

export async function writePresence(uid: string, p: { canInsert: boolean; reason?: PresenceReason; label?: string }): Promise<void> {
  const data: Record<string, unknown> = { canInsert: p.canInsert, updatedAt: serverTimestamp() };
  if (p.reason) data.reason = p.reason;
  if (p.label) data.label = p.label;
  await setDoc(presenceRef(uid), data);
}

export async function clearPresence(uid: string): Promise<void> {
  await deleteDoc(presenceRef(uid));
}

export function subscribePresence(uid: string, cb: (p: PresenceDoc | null) => void): Unsubscribe {
  return onSnapshot(
    presenceRef(uid),
    (snap) => {
      if (!snap.exists()) { cb(null); return; }
      const d = snap.data({ serverTimestamps: 'estimate' });
      cb({
        canInsert: d.canInsert === true,
        reason: d.reason,
        label: typeof d.label === 'string' ? d.label : undefined,
        updatedAtMs: tsMs(d.updatedAt),
      });
    },
    () => cb(null),
  );
}
