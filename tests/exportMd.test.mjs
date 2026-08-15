/**
 * Phase 55b — lib/version/exportMd.ts 단위 테스트.
 * `npm run test:export` (tsc로 .test-build에 컴파일 후 실행 — 에뮬레이터 불필요)
 *
 * 결정성 테스트가 이 파일의 존재 이유다. toMarkdown이 호출마다 다른 바이트를
 * 내면 서버의 "동일 내용 skip" 판정이 무력해져 무변경 재내보내기마다 커밋이 쌓인다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  toMarkdown, toJson, toIndexMarkdown, parseIndexSeq, safeTitle,
  versionMdPath, versionJsonPath, seqSlug,
} from '../.test-build/lib/version/exportMd.js';

const META = {
  problemId: 'p1', seq: 7, name: '중간안',
  contentHash: 'abc123def456', createdAt: '2026-08-15T09:00:00.000Z',
};

// 실사용 11종 + legacy 2종
const ALL_TYPES = [
  'text', 'heading', 'list', 'callout', 'gana', 'roman', 'box', 'choices',
  'image', 'svg', 'ggb', 'math_block', 'bullet',
];

const content = {
  meta: { title: '2026 수능: 미적분 #21', answer: '① 3' },
  tabs: [
    {
      key: 'question', title: '문제',
      blocks: ALL_TYPES.map((type, i) => ({
        block_key: `k${i}`, order: i, type,
        raw_text: `${type} 본문 $x^2$`,
        ...(i % 3 === 0 ? { title: `소제목 ${i}` } : {}),
      })),
    },
    {
      key: 'solution', title: '풀이',
      blocks: [
        { block_key: 'sa', order: 1, type: 'text', raw_text: '--- 로 시작하는 줄' },
        { block_key: 'sb', order: 0, type: 'text', raw_text: '순서 뒤집힘 검사' },
      ],
    },
  ],
};

test('결정성: 같은 입력 2회 → 바이트 동일', () => {
  assert.equal(toMarkdown(content, META), toMarkdown(content, META));
  assert.equal(toJson(content), toJson(content));
});

test('frontmatter 7필드 + YAML 이스케이프', () => {
  const md = toMarkdown(content, META);
  assert.ok(md.startsWith('---\n'));
  // 제목의 ':' 가 인용돼 있어야 한다
  assert.match(md, /^title: "2026 수능: 미적분 #21"$/m);
  assert.match(md, /^version_seq: 7$/m);
  assert.match(md, /^answer: "① 3"$/m);
  assert.match(md, /^content_hash: "abc123def456"$/m);
  for (const k of ['problem_id', 'version_seq', 'version_name', 'content_hash', 'created_at', 'title', 'answer']) {
    assert.match(md, new RegExp(`^${k}:`, 'm'), `${k} 누락`);
  }
});

test('exported_at이 파일에 없다 (W1)', () => {
  assert.ok(!toMarkdown(content, META).includes('exported_at'));
});

test('13종 블록 전부 통과 + 타입 마커', () => {
  const md = toMarkdown(content, META);
  for (const t of ALL_TYPES) assert.ok(md.includes(`<!-- block: ${t} -->`), `${t} 마커 누락`);
});

test('블록 title은 ### 로, 없으면 생략', () => {
  const md = toMarkdown(content, META);
  assert.ok(md.includes('### 소제목 0\n'));
  assert.ok(!md.includes('### 소제목 1\n'));   // i=1은 title 없음 (12와 구별 위해 개행까지 검사)
  // title이 붙은 블록 수(i % 3 === 0 → 0,3,6,9,12)만큼만 ### 이 나온다
  assert.equal((md.match(/^### /gm) || []).length, 5);
});

test('다중 탭 + order 정렬', () => {
  const md = toMarkdown(content, META);
  assert.ok(md.includes('## 문제') && md.includes('## 풀이'));
  const a = md.indexOf('순서 뒤집힘 검사');
  const b = md.indexOf('--- 로 시작하는 줄');
  assert.ok(a < b, 'order 0이 order 1보다 앞에 와야 한다');
});

test("raw_text의 '---'가 frontmatter를 깨지 않는다", () => {
  const md = toMarkdown(content, META);
  const close = md.indexOf('\n---\n', 3);
  const fm = md.slice(0, close);
  assert.ok(fm.includes('title:'), 'frontmatter가 조기 종료됐다');
  assert.equal(parseIndexSeq(md), 7);
});

test('개행 포함 제목도 frontmatter를 깨지 않는다', () => {
  const c2 = { ...content, meta: { title: '제목\n두번째줄', answer: '' } };
  const md = toMarkdown(c2, META);
  assert.ok(md.startsWith('---\n'));
  assert.match(md, /^title: "제목\\n두번째줄"$/m);
  assert.equal(parseIndexSeq(md), 7);
});

test('index.md: 주석이 frontmatter 뒤에 오고 seq 파싱 유지', () => {
  const md = toMarkdown(content, META);
  const idx = toIndexMarkdown(md, 7);
  assert.equal(parseIndexSeq(idx), 7, 'index에서도 seq를 읽을 수 있어야 한다');
  assert.ok(idx.indexOf('미러입니다') > idx.indexOf('\n---\n'), '주석이 frontmatter 앞에 있다');
  assert.ok(idx.includes('versions/0007.md'));
  assert.equal(toIndexMarkdown(md, 7), toIndexMarkdown(md, 7)); // 결정적
});

test('parseIndexSeq: 파싱 실패는 null', () => {
  assert.equal(parseIndexSeq('그냥 텍스트'), null);
  assert.equal(parseIndexSeq('---\ntitle: "x"\n---\n본문'), null);
});

test('safeTitle: 개행 제거 + 60자 절단', () => {
  assert.equal(safeTitle('제목\n두번째  줄'), '제목 두번째 줄');
  assert.equal(safeTitle('가'.repeat(100)).length, 60);
});

test('경로: 4자리 패딩', () => {
  assert.equal(seqSlug(7), '0007');
  assert.equal(versionMdPath('p1', 7), 'problems/p1/versions/0007.md');
  assert.equal(versionJsonPath('p1', 123), 'problems/p1/versions/0123.json');
});

test('빈 탭·빈 블록도 안전', () => {
  const empty = { meta: { title: '', answer: '' }, tabs: [] };
  const md = toMarkdown(empty, META);
  assert.ok(md.startsWith('---\n'));
  assert.equal(parseIndexSeq(md), 7);
});
