/**
 * Firestore 보안 규칙 스모크 테스트 (Phase 51 + Phase 52)
 *
 * 실행: `npm run test:rules`
 *   → firebase emulators:exec가 Firestore 에뮬레이터를 띄우고 이 파일을 node --test로 실행한다.
 *   → DB 변경 없음(에뮬레이터 인메모리). 운영에 영향 없음.
 *   ⚠️ firebase-tools는 JDK 21+ 요구. java 8이면 JAVA_HOME=/opt/homebrew/opt/openjdk@21 지정.
 *
 * 커버하는 케이스:
 *   [Phase 51 §4-1·§4-2·§4-4]
 *   블록 읽기   1) public·비로그인·공개탭 허용  2) public·비공개탭 거부  3) private 거부
 *   댓글 읽기   4) public·비로그인 허용(핵심)   5) commentsVisible=false 거부  6) private 거부
 *   댓글 생성   7) 비멤버 로그인 거부(멤버 전용)  8) commenter 멤버 허용
 *   댓글 삭제   9) 오너 모더레이션 허용  10) 무관 사용자 거부  11) 오너의 AI 댓글 삭제 허용
 *   [Phase 52 §4-2 공개 댓글 작성 (C3·N1·F5·F6)]
 *   12) public+플래그ON+세션일치 비멤버 로그인 허용(핵심)  13) 비로그인 거부  14) 잘못된 세션 거부(F6)
 *   15) sid null 거부(F6)  16) 플래그 없음(기본 false) 거부(N1 자동개방 차단)  17) commentsVisible=false 거부(F5)
 *   [Phase 52 §4-1 bazaar_posts (F7·F1)]
 *   18) 본인 public 문항 live 등록 허용  19) private 문항 live 등록 거부(F1)
 *   20) 남의 문항 등록 거부  21) snapshot+shareId 누락 거부(F7)  22) live+shareId 존재 거부(F7)
 *   23) snapshot은 private여도 허용(F1 우회 정상)  24) tags 11개 거부(F7)  25) ownerUid 위조 거부
 *   26) update: tags만 허용·mode 변경 거부  27) delete: 본인 허용·타인 거부
 */
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, updateDoc } from 'firebase/firestore';

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

    // ── Phase 52 시드 ──
    // 광장 등록 + 공개댓글 ON: commentSessionId 비정규화 + publicCommentsEnabled(N1 opt-in)
    await setDoc(doc(db, 'problems/pubBazaar'), {
      authorUid: OWNER, visibility: 'public', commentSessionId: 'cs1', publicCommentsEnabled: true,
    });
    // 공개지만 플래그 없음(기본 false) — 기존 public 문항 시뮬. 공개작성 차단되어야 함(N1)
    await setDoc(doc(db, 'problems/pubNoFlag'), {
      authorUid: OWNER, visibility: 'public', commentSessionId: 'cs4',
    });
    // 플래그 ON이지만 댓글 숨김(commentsVisible=false) — 공개작성도 막혀야 함(F5)
    await setDoc(doc(db, 'problems/pubHidden'), {
      authorUid: OWNER, visibility: 'public', commentSessionId: 'cs3',
      publicCommentsEnabled: true, commentsVisible: false,
    });
    // 타인 소유 공개 문항(남의 문항 등록 거부 테스트용)
    await setDoc(doc(db, 'problems/otherPub'), {
      authorUid: OTHER_AUTHOR, visibility: 'public',
    });
    // 갱신/삭제 테스트용 기존 광장 게시물(OWNER 소유, live)
    await setDoc(doc(db, 'bazaar_posts/seedLive'), {
      mode: 'live', problemId: 'pub', ownerUid: OWNER,
      authorNickname: 'kds', authorNickname_lower: 'kds',
      title: 'Seed', title_lower: 'seed', tags: ['x'], createdAt: new Date(),
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

// ══ Phase 52: 공개 댓글 작성 (§4-2 C3·N1·F5·F6) ══
// 공개 댓글 페이로드 빌더(human, 해당 문항 commentSessionId 참조)
const pubComment = (uid, sid) => ({
  tabId: '', authorType: 'human', authorUid: uid,
  content: 'public note', parentCommentId: null, resolved: false,
  ...(sid !== undefined ? { discussionSessionId: sid } : {}),
});

test('12. public+플래그ON+세션일치 비멤버 로그인 댓글 create 허용 (C3·N1 핵심)', async () => {
  await assertSucceeds(setDoc(
    doc(as(STRANGER), 'problems/pubBazaar/tab_comments/pc1'), pubComment(STRANGER, 'cs1')));
});
test('13. public 비로그인 댓글 create 거부 (읽기 전용)', async () => {
  await assertFails(setDoc(
    doc(anon(), 'problems/pubBazaar/tab_comments/pc2'), pubComment(STRANGER, 'cs1')));
});
test('14. public+잘못된 세션(commentSessionId 불일치) create 거부 (F6 agent세션 우회 차단)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pubBazaar/tab_comments/pc3'), pubComment(STRANGER, 'agentSess')));
});
test('15. public+세션 null create 거부 (F6 null 우회 차단)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pubBazaar/tab_comments/pc4'), pubComment(STRANGER, undefined)));
});
test('16. public+플래그 없음(기본 false) 공개 작성 거부 (N1 기존 public 자동개방 차단)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pubNoFlag/tab_comments/pc5'), pubComment(STRANGER, 'cs4')));
});
test('17. public+플래그ON+commentsVisible=false 공개 작성 거부 (F5 모순 방지)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pubHidden/tab_comments/pc6'), pubComment(STRANGER, 'cs3')));
});

// ══ Phase 52: bazaar_posts (§4-1 F7·F1) ══
const bazaar = (over = {}) => ({
  mode: 'live', problemId: 'pub', ownerUid: OWNER,
  authorNickname: 'kds', authorNickname_lower: 'kds',
  title: 'Sample', title_lower: 'sample', tags: [], createdAt: new Date(),
  ...over,
});

test('18. 본인 public 문항 live 등록 허용', async () => {
  await assertSucceeds(setDoc(doc(as(OWNER), 'bazaar_posts/b18'), bazaar()));
});
test('19. 본인 private 문항 live 등록 거부 (F1: live는 public 필요)', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b19'), bazaar({ problemId: 'priv' })));
});
test('20. 남의 문항 등록 거부', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b20'), bazaar({ problemId: 'otherPub' })));
});
test('21. snapshot+shareId 누락 거부 (F7 정합)', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b21'), bazaar({ mode: 'snapshot' })));
});
test('22. live+shareId 존재 거부 (F7 정합)', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b22'), bazaar({ shareId: 's1' })));
});
test('23. snapshot은 private 문항이어도 허용 (F1 우회 정상)', async () => {
  await assertSucceeds(setDoc(doc(as(OWNER), 'bazaar_posts/b23'),
    bazaar({ mode: 'snapshot', problemId: 'priv', shareId: 's23' })));
});
test('24. tags 11개 등록 거부 (F7 한도)', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b24'),
    bazaar({ tags: Array.from({ length: 11 }, (_, i) => `t${i}`) })));
});
test('25. ownerUid 위조(타인) 등록 거부', async () => {
  await assertFails(setDoc(doc(as(OWNER), 'bazaar_posts/b25'), bazaar({ ownerUid: STRANGER })));
});
test('26a. 본인 게시물 tags 수정 허용', async () => {
  await assertSucceeds(updateDoc(doc(as(OWNER), 'bazaar_posts/seedLive'), { tags: ['y', 'z'] }));
});
test('26b. mode 변경 거부 (불변 필드)', async () => {
  await assertFails(updateDoc(doc(as(OWNER), 'bazaar_posts/seedLive'), { mode: 'snapshot' }));
});
test('27a. 타인 게시물 삭제 거부', async () => {
  await assertFails(deleteDoc(doc(as(STRANGER), 'bazaar_posts/seedLive')));
});
test('27b. 본인 게시물 삭제 허용 (중단)', async () => {
  await assertSucceeds(deleteDoc(doc(as(OWNER), 'bazaar_posts/seedLive')));
});
