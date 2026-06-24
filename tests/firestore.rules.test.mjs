/**
 * Firestore 보안 규칙 스모크 테스트 (Phase 51)
 *
 * 실행: `npm run test:rules`
 *   → firebase emulators:exec가 Firestore 에뮬레이터를 띄우고 이 파일을 node --test로 실행한다.
 *   → DB 변경 없음(에뮬레이터 인메모리). 운영에 영향 없음.
 *
 * 커버하는 케이스(Phase 51 §4-1·§4-2·§4-4):
 *   블록 읽기   1) public·비로그인·공개탭 허용  2) public·비공개탭 거부  3) private 거부
 *   댓글 읽기   4) public·비로그인 허용(핵심)   5) commentsVisible=false 거부  6) private 거부
 *   댓글 생성   7) 비멤버 로그인 거부(멤버 전용)  8) commenter 멤버 허용
 *   댓글 삭제   9) 오너 모더레이션 허용  10) 무관 사용자 거부  11) 오너의 AI 댓글 삭제 허용
 */
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';

const PROJECT_ID = 'mathory-rules-test';
const OWNER = 'ownerUid';
const COMMENTER = 'commenterUid';
const STRANGER = 'strangerUid';
const OTHER_AUTHOR = 'otherAuthorUid';

let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
  await testEnv.clearFirestore();

  // 시드 (규칙 우회)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();

    // 공개 문항: commentsVisible/Writable 미설정 = 기본 true, solution 탭 비공개
    await setDoc(doc(db, 'problems/pub'), {
      authorUid: OWNER,
      visibility: 'public',
      members: { [COMMENTER]: 'commenter' },
      memberUids: [COMMENTER],
      memberTabVisibility: { solution: false },
    });
    await setDoc(doc(db, 'problems/pub/question_blocks/b1'), { order: 0, type: 'text', raw_text: 'Q' });
    await setDoc(doc(db, 'problems/pub/solution_blocks/b1'), { order: 0, type: 'text', raw_text: 'S' });
    await setDoc(doc(db, 'problems/pub/tab_comments/c_human'), {
      tabId: 'question', authorType: 'human', authorUid: OTHER_AUTHOR,
      content: 'hello', parentCommentId: null, resolved: false,
    });
    await setDoc(doc(db, 'problems/pub/tab_comments/c_ai'), {
      tabId: 'question', authorType: 'ai', authorUid: 'ai:claude',
      content: 'ai answer', parentCommentId: null, resolved: false,
    });

    // 공개지만 댓글 숨김
    await setDoc(doc(db, 'problems/pubNoComments'), {
      authorUid: OWNER, visibility: 'public', commentsVisible: false,
    });
    await setDoc(doc(db, 'problems/pubNoComments/tab_comments/c1'), {
      tabId: 'question', authorType: 'human', authorUid: OTHER_AUTHOR,
      content: 'x', parentCommentId: null, resolved: false,
    });

    // 비공개 문항
    await setDoc(doc(db, 'problems/priv'), { authorUid: OWNER, visibility: 'private' });
    await setDoc(doc(db, 'problems/priv/question_blocks/b1'), { order: 0, type: 'text', raw_text: 'Q' });
    await setDoc(doc(db, 'problems/priv/tab_comments/c1'), {
      tabId: 'question', authorType: 'human', authorUid: OTHER_AUTHOR,
      content: 'x', parentCommentId: null, resolved: false,
    });
  });
});

after(async () => {
  await testEnv?.cleanup();
});

const anon = () => testEnv.unauthenticatedContext().firestore();
const as = (uid) => testEnv.authenticatedContext(uid).firestore();

// ── 블록 읽기 (§4-1) ──
test('1. public·비로그인·공개탭 블록 read 허용', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'problems/pub/question_blocks/b1')));
});
test('2. public·비로그인·비공개탭(memberTabVisibility=false) 블록 read 거부', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/pub/solution_blocks/b1')));
});
test('3. private·비로그인 블록 read 거부', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/priv/question_blocks/b1')));
});

// ── 댓글 읽기 (§4-2) ──
test('4. public·비로그인·commentsVisible 기본 댓글 read 허용 (핵심)', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'problems/pub/tab_comments/c_human')));
});
test('5. public·비로그인·commentsVisible=false 댓글 read 거부', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/pubNoComments/tab_comments/c1')));
});
test('6. private·비로그인 댓글 read 거부', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/priv/tab_comments/c1')));
});

// ── 댓글 생성 (§4-3 무변경: 멤버 전용) ──
test('7. public·비멤버 로그인 댓글 create 거부 (작성 멤버 전용)', async () => {
  await assertFails(setDoc(doc(as(STRANGER), 'problems/pub/tab_comments/new1'), {
    tabId: 'question', authorType: 'human', authorUid: STRANGER,
    content: 'hi', parentCommentId: null, resolved: false,
  }));
});
test('8. commenter 멤버·commentsWritable 댓글 create 허용', async () => {
  await assertSucceeds(setDoc(doc(as(COMMENTER), 'problems/pub/tab_comments/new2'), {
    tabId: 'question', authorType: 'human', authorUid: COMMENTER,
    content: 'hi', parentCommentId: null, resolved: false,
  }));
});

// ── 댓글 삭제 (§4-4 모더레이션) ──
test('9. 오너가 타인 human 댓글 삭제 허용 (모더레이션)', async () => {
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'problems/pub/tab_comments/c_human')));
});
test('10. 무관 로그인 사용자가 타인 댓글 삭제 거부', async () => {
  await assertFails(deleteDoc(doc(as(STRANGER), 'problems/pub/tab_comments/c_ai')));
});
test('11. 오너가 AI 댓글 삭제 허용 (기존 보존)', async () => {
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'problems/pub/tab_comments/c_ai')));
});
