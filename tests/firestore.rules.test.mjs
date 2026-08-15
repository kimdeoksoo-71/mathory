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
 *   [Phase 52 §4-4 bazaar_reports + 관리자 takedown (A2)]
 *   28) 본인명의 신고 create 허용  29) reporterUid 위조 거부  30) 비로그인 거부
 *   31) 비관리자 read 거부  32) 관리자 read 허용  33) 비관리자 delete 거부
 *   34) 관리자 delete 허용  35) 관리자 bazaar_posts takedown 허용
 *   [Phase 52 B1: 공개 뷰어 agent 메시지 차단 (commentStream)]
 *   36) agent 메시지 공개 read 거부(핵심)  37) 스트림 댓글 공개 read 허용
 *   38) 필터 LIST 허용  39) 미필터 LIST 거부  40) 멤버 미필터 LIST 허용  41) 공개 작성 commentStream 누락 거부
 *   42) 오너 commentStream 백필 update 허용  43) 비오너 거부
 *   [Phase 52 D1: 공개 Bazaar 피드 비로그인 열람]
 *   44) 비로그인 bazaar_posts 단건 read 허용  45) 비로그인 피드 LIST 허용
 *   [Phase 55: 버전 스냅샷 규칙 (자체 VCS)]
 *   46) 공개 문항 versions 제3자 read 거부(F2)  47) 비로그인 read 거부(핵심)  48) 오너 read 허용
 *   49) 오너 create 허용  50) 비오너 create 거부(부모소유 불일치)  51) name·pinned update 허용
 *   52) 그 외 필드 update 거부(불변성)  53) payload 오너 read 허용  54) payload 제3자 read 거부  55) payload update 거부
 *   56) version+payload 트랜잭션 동시 생성(F10)  57) payload 제3자 create 거부
 *   58) 오너 LIST 허용(F11)  59) 제3자 LIST 거부  60) 비로그인 LIST 거부
 *   [Phase 55b: GitHub 내보내기 기록]
 *   61) github_export 단독 update 허용  62) name 동반 update 허용  63) content_hash 동반 update 거부
 */
import { readFileSync } from 'node:fs';
import { test, before, after } from 'node:test';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc, setDoc, getDoc, deleteDoc, updateDoc,
  collection, getDocs, query, where, orderBy, limit, runTransaction,
} from 'firebase/firestore';

const PROJECT_ID = 'mathory-rules-test';
const OWNER = 'ownerUid';
const COMMENTER = 'commenterUid';
const STRANGER = 'strangerUid';
const OTHER_AUTHOR = 'otherAuthorUid';
const ADMIN = 'adminUid';                 // admins/adminUid 시드 보유(A2)

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
      commentStream: true,                         // B1: 댓글 스트림 → 공개 read 대상
    });
    await setDoc(doc(db, 'problems/pub/tab_comments/c_ai'), {
      tabId: 'question', authorType: 'ai', authorUid: 'ai:claude',
      content: 'ai answer', parentCommentId: null, resolved: false,
    });
    // B1: agent('normal' 세션) 메시지 — commentStream 없음 → 공개 read 거부 대상
    await setDoc(doc(db, 'problems/pub/tab_comments/c_agent'), {
      tabId: 'question', authorType: 'human', authorUid: OWNER,
      content: 'agent note', parentCommentId: null, resolved: false,
      discussionSessionId: 'agentSess',
    });
    // B1: 삭제 테스트 영향 없는 스트림 댓글(공개 read 허용 검증용)
    await setDoc(doc(db, 'problems/pub/tab_comments/c_stream'), {
      tabId: 'question', authorType: 'human', authorUid: OTHER_AUTHOR,
      content: 'stream note', parentCommentId: null, resolved: false,
      commentStream: true,
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
    // admin takedown 테스트용 게시물(OWNER 소유, 별도 — seedLive는 #27b에서 삭제됨)
    await setDoc(doc(db, 'bazaar_posts/adminTarget'), {
      mode: 'live', problemId: 'pub', ownerUid: OWNER,
      authorNickname: 'kds', authorNickname_lower: 'kds',
      title: 'T', title_lower: 't', tags: [], createdAt: new Date(),
    });
    // D1: 공개 read 검증용(삭제 테스트 영향 없음)
    await setDoc(doc(db, 'bazaar_posts/readSeed'), {
      mode: 'live', problemId: 'pub', ownerUid: OWNER,
      authorNickname: 'kds', authorNickname_lower: 'kds',
      title: 'R', title_lower: 'r', tags: ['r'], createdAt: new Date(),
    });

    // ── Phase 52(A2) 시드: 관리자 화이트리스트 + 기존 신고 ──
    await setDoc(doc(db, 'admins/adminUid'), {});                 // 빈 문서로 충분
    await setDoc(doc(db, 'bazaar_reports/seedReport'), {
      reporterUid: STRANGER, postId: 'seedLive', createdAt: new Date(),
    });

    // ── Phase 55 시드: 버전 스냅샷 (자체 VCS) ──
    // 공개 문항(pub, owner=OWNER)에 버전 1개 + payload. F2(공개 노출) 검증 대상.
    await setDoc(doc(db, 'problems/pub/versions/v1'), {
      author_uid: OWNER, seq: 1, problem_id: 'pub',
      trigger: 'manual_save', name: null, pinned: false,
      content_hash: 'h1', tab_hashes: { question: 'th1' },
      parent_id: null, restored_from: null, changed_tabs: ['question'], byte_size: 10,
    });
    await setDoc(doc(db, 'problems/pub/versions/v1/payload/data'), {
      content: { meta: { title: 'T', answer: '' }, tabs: [] }, content_hash: 'h1',
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
  commentStream: true,                            // B1: 공개 작성분은 스트림 플래그 필수
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

// ══ Phase 52(A2): bazaar_reports 신고 적재 + 관리자 takedown ══
const report = (over = {}) => ({
  reporterUid: STRANGER, postId: 'seedLive', createdAt: new Date(), ...over,
});

test('28. 로그인 사용자 본인명의 신고 create 허용', async () => {
  await assertSucceeds(setDoc(doc(as(STRANGER), 'bazaar_reports/r28'), report()));
});
test('29. reporterUid 위조(타인 명의) 신고 create 거부', async () => {
  await assertFails(setDoc(doc(as(STRANGER), 'bazaar_reports/r29'), report({ reporterUid: OWNER })));
});
test('30. 비로그인 신고 create 거부', async () => {
  await assertFails(setDoc(doc(anon(), 'bazaar_reports/r30'), report()));
});
test('31. 비관리자 신고 read 거부 (본인 신고도 불가)', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'bazaar_reports/seedReport')));
});
test('32. 관리자 신고 read 허용', async () => {
  await assertSucceeds(getDoc(doc(as(ADMIN), 'bazaar_reports/seedReport')));
});
test('33. 비관리자 신고 delete 거부', async () => {
  await assertFails(deleteDoc(doc(as(STRANGER), 'bazaar_reports/seedReport')));
});
test('34. 관리자 신고 delete 허용', async () => {
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'bazaar_reports/seedReport')));
});
test('35. 관리자 bazaar_posts takedown(삭제) 허용', async () => {
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'bazaar_posts/adminTarget')));
});

// ══ Phase 52(B1): 공개 뷰어 agent 메시지 규칙레벨 차단 ══
test('36. 공개·비로그인 agent 메시지(commentStream 없음) read 거부 (B1 핵심)', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/pub/tab_comments/c_agent')));
});
test('37. 공개·비로그인 commentStream 댓글 read 허용 (백필분)', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'problems/pub/tab_comments/c_stream')));
});
test('38. 공개·비로그인 필터 LIST(commentStream==true) 허용', async () => {
  await assertSucceeds(getDocs(query(
    collection(anon(), 'problems/pub/tab_comments'),
    where('commentStream', '==', true), orderBy('createdAt', 'asc'),
  )));
});
test('39. 공개·비로그인 미필터 LIST 거부 (규칙이 필터 강제, agent 노출 차단)', async () => {
  await assertFails(getDocs(query(
    collection(anon(), 'problems/pub/tab_comments'), orderBy('createdAt', 'asc'),
  )));
});
test('40. 멤버 미필터 LIST 허용 (멤버 가지 무제약 — 협업 회귀 없음)', async () => {
  await assertSucceeds(getDocs(query(
    collection(as(COMMENTER), 'problems/pub/tab_comments'), orderBy('createdAt', 'asc'),
  )));
});
test('41. 공개 작성 시 commentStream 누락 create 거부 (B1 정합)', async () => {
  const { commentStream, ...noStream } = pubComment(STRANGER, 'cs1');
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pubBazaar/tab_comments/pc41'), noStream));
});
test('42. 오너가 commentStream 플래그만 갱신 허용 (백필)', async () => {
  await assertSucceeds(updateDoc(doc(as(OWNER), 'problems/pub/tab_comments/c_agent'), { commentStream: true }));
});
test('43. 비오너의 commentStream 갱신 거부', async () => {
  await assertFails(updateDoc(doc(as(STRANGER), 'problems/pub/tab_comments/c_stream'), { commentStream: false }));
});

// ══ Phase 52 D1: 공개 Bazaar 피드 비로그인 열람 ══
test('44. 비로그인 bazaar_posts 단건 read 허용 (D1)', async () => {
  await assertSucceeds(getDoc(doc(anon(), 'bazaar_posts/readSeed')));
});
test('45. 비로그인 bazaar_posts 피드 LIST 허용 (D1)', async () => {
  await assertSucceeds(getDocs(query(
    collection(anon(), 'bazaar_posts'), orderBy('createdAt', 'desc'),
  )));
});

// ══ Phase 55: 버전 스냅샷 규칙 (자체 VCS) ══
const versionDoc = (over = {}) => ({
  author_uid: OWNER, seq: 2, problem_id: 'pub',
  trigger: 'manual_save', name: null, pinned: false,
  content_hash: 'h2', tab_hashes: { question: 'th2' },
  parent_id: 'v1', restored_from: null, changed_tabs: ['question'], byte_size: 10,
  ...over,
});

test('46. 공개 문항 versions 제3자 read 거부 (F2)', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'problems/pub/versions/v1')));
});
test('47. 공개 문항 versions 비로그인 read 거부 (F2 핵심)', async () => {
  await assertFails(getDoc(doc(anon(), 'problems/pub/versions/v1')));
});
test('48. 오너 versions read 허용', async () => {
  await assertSucceeds(getDoc(doc(as(OWNER), 'problems/pub/versions/v1')));
});
test('49. 오너 versions create 허용 (author_uid 본인·부모소유 일치)', async () => {
  await assertSucceeds(setDoc(doc(as(OWNER), 'problems/pub/versions/v49'), versionDoc()));
});
test('50. 비오너 versions create 거부 (부모 소유자 불일치)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pub/versions/v50'), versionDoc({ author_uid: STRANGER })));
});
test('51. 오너 name·pinned만 update 허용', async () => {
  await assertSucceeds(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1'), { name: '중요본', pinned: true }));
});
test('52. name·pinned 외 필드 update 거부 (불변성 강제)', async () => {
  await assertFails(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1'), { content_hash: 'tampered' }));
});
test('53. payload/data 오너 read 허용', async () => {
  await assertSucceeds(getDoc(doc(as(OWNER), 'problems/pub/versions/v1/payload/data')));
});
test('54. payload/data 제3자 read 거부', async () => {
  await assertFails(getDoc(doc(as(STRANGER), 'problems/pub/versions/v1/payload/data')));
});
test('55. payload/data update 거부 (본문 불변)', async () => {
  await assertFails(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1/payload/data'), { content_hash: 'x' }));
});
// createSnapshot 재현: version + payload를 한 트랜잭션에서 동시 생성.
// payload create 규칙이 부모 version doc을 get()하면, 같은 트랜잭션의 미커밋 version이
// 안 보여 거부됨 → 전체 롤백. payload 소유검사는 문항 authorUid로 해야 통과.
test('56. 오너가 version+payload 트랜잭션 동시 생성 허용 (createSnapshot 재현)', async () => {
  const db = as(OWNER);
  await assertSucceeds(runTransaction(db, async (tx) => {
    const vRef = doc(db, 'problems/pub/versions/vtx');
    const pRef = doc(db, 'problems/pub/versions/vtx/payload/data');
    tx.set(vRef, {
      author_uid: OWNER, seq: 9, problem_id: 'pub', trigger: 'manual_save',
      name: null, pinned: false, content_hash: 'htx', tab_hashes: {},
      parent_id: null, restored_from: null, changed_tabs: [], byte_size: 5,
    });
    tx.set(pRef, { content: { meta: { title: 't', answer: '' }, tabs: [] }, content_hash: 'htx' });
  }));
});
test('57. payload/data 제3자 create 거부 (문항 소유 검사)', async () => {
  await assertFails(setDoc(
    doc(as(STRANGER), 'problems/pub/versions/vtx2/payload/data'),
    { content: { meta: { title: 'x', answer: '' }, tabs: [] }, content_hash: 'h2' }));
});
// 드로어 타임라인 = LIST 쿼리. read 규칙이 resource.data를 참조하면 where 절 없는 LIST는 거부된다.
test('58. 오너 versions LIST 허용 (드로어 타임라인)', async () => {
  await assertSucceeds(getDocs(query(
    collection(as(OWNER), 'problems/pub/versions'), orderBy('seq', 'desc'), limit(30))));
});
test('59. 제3자 versions LIST 거부', async () => {
  await assertFails(getDocs(query(
    collection(as(STRANGER), 'problems/pub/versions'), orderBy('seq', 'desc'))));
});
test('60. 비로그인 versions LIST 거부', async () => {
  await assertFails(getDocs(query(
    collection(anon(), 'problems/pub/versions'), orderBy('seq', 'desc'))));
});

// ══ Phase 55b: GitHub 내보내기 기록 ══
// 서버 API가 커밋에 성공한 뒤 클라가 남기는 사후 기록. 중첩 map이지만 affectedKeys()는
// 최상위 키만 보므로 hasOnly(['name','pinned','github_export'])로 통과해야 한다.
const ghExport = {
  repo: 'kimdeoksoo-71/mathory-content',
  path: 'problems/pub/versions/0002.md',
  commit_sha: 'abc1234',
  exported_at: '2026-08-15T12:00:00.000Z',
};

test('61. 오너 github_export 단독 update 허용', async () => {
  await assertSucceeds(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1'), { github_export: ghExport }));
});
test('62. 오너 name + github_export 동반 update 허용', async () => {
  await assertSucceeds(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1'), { name: '내보낸본', github_export: ghExport }));
});
test('63. github_export + content_hash 동반 update 거부 (불변성 유지)', async () => {
  await assertFails(updateDoc(
    doc(as(OWNER), 'problems/pub/versions/v1'),
    { github_export: ghExport, content_hash: 'tampered' }));
});
