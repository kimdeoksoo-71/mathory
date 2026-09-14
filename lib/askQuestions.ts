/**
 * Phase 66a — 문답 검증 질문 CRUD (`users/{uid}/ask_questions`)
 *
 * `lib/snippets.ts:16-64`(math_snippets)의 형태를 그대로 복제했다 — 규칙도 같은 문법이다
 * (`firestore.rules`의 `match /users/{userId}` 안, 본인만 read/write).
 *
 * ⚠ 이 파일을 `lib/ask/`에 두지 말 것 — 그 폴더는 import 0 순수 모듈 전용이고
 *   `npm run test:ask`가 tsc로 단독 컴파일한다. 여기는 firestore를 import한다.
 * ⚠ `orderBy('order')`는 그 필드가 **없는 문서를 결과에서 제외한다**. 콘솔에서 손으로 만든
 *   문서에 order가 빠지면 목록에서 조용히 사라진다 — 정상 경로(씨앗·생성·복제)는 항상 쓴다.
 */

import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  SEED_QUESTIONS, nextRev,
  type AskQuestion, type AskQuestionInput,
} from './ask/seed';

function askCollection(userId: string) {
  return collection(db, 'users', userId, 'ask_questions');
}

export async function listAskQuestions(userId: string): Promise<AskQuestion[]> {
  const q = query(askCollection(userId), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      label: String(data.label ?? ''),
      target: data.target === 'problem' ? 'problem' : 'solution',
      text: String(data.text ?? ''),
      order: typeof data.order === 'number' ? data.order : 0,
      enabled: data.enabled !== false,
      rev: typeof data.rev === 'number' ? data.rev : 1,
      created_at: (data.created_at as Timestamp)?.toDate() || new Date(),
      updated_at: (data.updated_at as Timestamp)?.toDate() || new Date(),
    } as AskQuestion;
  });
}

export async function createAskQuestion(userId: string, data: AskQuestionInput): Promise<string> {
  const ref = await addDoc(askCollection(userId), {
    ...data,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return ref.id;
}

/** 저장 = rev+1. 호출부가 현재 rev를 넘긴다(문서를 다시 읽지 않는다 — 1인 사용). */
export async function updateAskQuestion(
  userId: string, qid: string,
  data: Partial<Pick<AskQuestion, 'label' | 'target' | 'text' | 'order' | 'enabled'>>,
  currentRev: number,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'ask_questions', qid), {
    ...data,
    rev: nextRev(currentRev),
    updated_at: serverTimestamp(),
  });
}

/** 사용 여부 토글만 — rev를 올리지 않는다(문안이 안 바뀌었으므로 실험 판본이 같다). */
export async function setAskQuestionEnabled(
  userId: string, qid: string, enabled: boolean,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'ask_questions', qid), {
    enabled, updated_at: serverTimestamp(),
  });
}

/** D6·D18 — 복제본은 `rev 1`로 시작하고 원본 바로 아래에 선다. */
export async function duplicateAskQuestion(userId: string, src: AskQuestion): Promise<string> {
  return createAskQuestion(userId, {
    label: `${src.label} 사본`,
    target: src.target,
    text: src.text,
    order: src.order + 1,
    enabled: src.enabled,
    rev: 1,
  });
}

export async function deleteAskQuestion(userId: string, qid: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'ask_questions', qid));
}

/* ── 씨앗 (D4) ─────────────────────────────────────────────────
   트리거는 **팝오버 첫 열기**다(패널 마운트가 아니다) — 패널은 EditorView·ProblemView·
   폰에서 마운트되므로 마운트 훅이면 문항을 열 때마다 읽기가 돈다.
   ⚠ in-flight 약속은 **uid별**로 들 것. 전역 하나면 계정 전환 시 남의 약속을 재사용한다. */
const seeding = new Map<string, Promise<AskQuestion[]>>();

/** 비어 있으면 씨앗 3개를 만들고, 어느 쪽이든 현재 목록을 돌려준다. */
export async function ensureSeeded(userId: string): Promise<AskQuestion[]> {
  const inFlight = seeding.get(userId);
  if (inFlight) return inFlight;

  const p = (async () => {
    const existing = await listAskQuestions(userId);
    if (existing.length > 0) return existing;
    const batch = writeBatch(db);
    for (const s of SEED_QUESTIONS) {
      batch.set(doc(askCollection(userId)), {
        ...s, created_at: serverTimestamp(), updated_at: serverTimestamp(),
      });
    }
    await batch.commit();
    return listAskQuestions(userId);
  })();

  seeding.set(userId, p);
  try {
    return await p;
  } finally {
    // 실패했으면 다음 열기에서 다시 시도할 수 있게 비운다(규칙 미배포 등 일시 오류)
    seeding.delete(userId);
  }
}
