/**
 * Phase 61f — 그림 첨부 순수 로직 회귀.
 *
 * 실행: npm run test:verify (figures.ts를 tsc로 뽑아 직접 돌린다)
 *
 * 지키는 것:
 *   ① 슬롯 모델 — k는 등장 순서, 같은 URL은 같은 k·한 번만, null 슬롯은 각자
 *   ② D2 화이트리스트(SSRF) — 자기 버킷 `problems/` 밖은 전부 탈락
 *   ③ D19 — 자르기 뒤 살아남은 자리표시자 기준으로 번호가 1부터 연속
 *   ④ D10 — 그림이 없으면 꼬리말 ''(프롬프트 불변)
 *   ⑤ 전송용 표식 `⟦그림⟧`은 어떤 경우에도 모델 문자열에 새지 않는다
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FIG_PLACEHOLDER, FIG_LIMITS, FIG_MIME_OK,
  imageSrcOf, scanImgTags, isOwnStorageUrl,
  planSlots, allMissingFigures, buildFigMeta,
  figureLabel, numberFigures, countPlaceholders, buildImageNote,
} from '../.test-build/lib/verify/figures.js';

const BUCKET = 'mathory-test.appspot.com';
const u = (name) =>
  `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/problems%2Fp1%2F${name}?alt=media&token=tok-${name}`;

/* ═══ 추출 ═══ */

test('X1 imageSrcOf — 61e가 쓰는 형태 그대로', () => {
  assert.equal(imageSrcOf(`<img src="${u('a.jpg')}" alt="a_fig1.jpg" width="400" />`), u('a.jpg'));
});

test('X2 imageSrcOf — 속성 순서가 뒤바뀌어도, 없으면 빈 문자열', () => {
  assert.equal(imageSrcOf(`<img width="400" src="${u('b.png')}" />`), u('b.png'));
  assert.equal(imageSrcOf('그냥 텍스트'), '');
  assert.equal(imageSrcOf(''), '');
  assert.equal(imageSrcOf('<img width="400" />'), '');
});

test('X3 scanImgTags — 0·1·2개, src 없는 태그는 건너뛴다', () => {
  assert.deepEqual(scanImgTags('그림 없음'), []);
  const one = scanImgTags(`앞 <img src="${u('a.jpg')}" /> 뒤`);
  assert.equal(one.length, 1);
  assert.equal(one[0].src, u('a.jpg'));
  assert.equal(one[0].index, 2);
  const two = scanImgTags(`<img src="${u('a.jpg')}" />\n<img width="1" />\n<img src="${u('b.jpg')}" />`);
  assert.deepEqual(two.map((t) => t.src), [u('a.jpg'), u('b.jpg')]);
});

/* ═══ D2 화이트리스트 ═══ */

test('W1 자기 버킷 problems/ 경로만 통과한다', () => {
  assert.equal(isOwnStorageUrl(u('a.jpg'), BUCKET), true);
  // %2F 대소문자 흡수
  assert.equal(isOwnStorageUrl(u('a.jpg').replace('%2F', '%2f'), BUCKET), true);
});

test('W2 SSRF 케이스 표 — 전부 탈락', () => {
  const bad = [
    `https://firebasestorage.googleapis.com/v0/b/other-bucket/o/problems%2Fx.jpg`,   // 다른 버킷
    `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/avatars%2Fx.jpg`,       // problems 아닌 경로
    `http://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/problems%2Fx.jpg`,       // http
    `https://firebasestorage.googleapis.com.evil.com/v0/b/${BUCKET}/o/problems%2Fx.jpg`,
    `https://firebasestorage.googleapis.com@evil.com/v0/b/${BUCKET}/o/problems%2Fx.jpg`,
    `https://evil.com/?u=https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/problems%2Fx.jpg`,
    '',
  ];
  for (const url of bad) assert.equal(isOwnStorageUrl(url, BUCKET), false, url);
  assert.equal(isOwnStorageUrl(u('a.jpg'), ''), false, '버킷 env가 비면 전부 거절');
});

/* ═══ 슬롯 계획 ═══ */

test('S1 같은 URL은 같은 k를 받고 한 번만 내려받는다', () => {
  const p = planSlots([u('a.jpg'), u('b.jpg'), u('a.jpg')], BUCKET, 'SVG/GeoGebra');
  assert.deepEqual(p.slotToK, [1, 2, 1]);
  assert.deepEqual(p.fetchTargets.map((t) => t.k), [1, 2]);
  assert.equal(p.figureCount, 2);
});

test('S2 null 슬롯은 서로 다른 슬롯이고 사유를 받는다', () => {
  const p = planSlots([null, u('a.jpg'), null], BUCKET, 'SVG/GeoGebra');
  assert.deepEqual(p.slotToK, [1, 2, 3]);
  assert.equal(p.preRejected.get(1), 'SVG/GeoGebra');
  assert.equal(p.preRejected.get(3), 'SVG/GeoGebra');
  assert.deepEqual(p.fetchTargets.map((t) => t.k), [2]);
});

test('S3 화이트리스트 탈락도 k는 받는다 (자리표시자에 번호가 남아야 한다)', () => {
  const p = planSlots(['https://evil.com/x.jpg', u('a.jpg')], BUCKET, 'SVG/GeoGebra');
  assert.equal(p.preRejected.get(1), '허용되지 않는 그림 주소');
  assert.deepEqual(p.fetchTargets.map((t) => t.k), [2]);
});

test('S4 장수 상한 — 초과분은 preRejected, 상한 안은 k 오름차순', () => {
  const slots = Array.from({ length: FIG_LIMITS.maxCount + 2 }, (_, i) => u(`f${i}.jpg`));
  const p = planSlots(slots, BUCKET, 'SVG/GeoGebra');
  assert.equal(p.fetchTargets.length, FIG_LIMITS.maxCount);
  assert.deepEqual(p.fetchTargets.map((t) => t.k), [1, 2, 3, 4, 5, 6]);
  assert.match(p.preRejected.get(7), /상한 초과/);
  assert.match(p.preRejected.get(8), /상한 초과/);
});

test('S5 우선순위 축 — D12: 상한에서 살아남는 것은 우선순위가 정하고, 번호·첨부 순서는 등장 순서다', () => {
  // 등장: 문항(0) → 히스토리(1~6) → 메시지(7). 우선순위: 문항 0, 메시지 1, 히스토리 뒤로.
  const slots = Array.from({ length: 8 }, (_, i) => u(`f${i}.jpg`));
  const priority = [0, 2, 3, 4, 5, 6, 7, 1];   // 마지막 슬롯(메시지)이 두 번째로 중요
  const p = planSlots(slots, BUCKET, 'SVG/GeoGebra', priority);
  const keptKs = p.fetchTargets.map((t) => t.k);
  assert.ok(keptKs.includes(8), '메시지 그림(k=8)이 살아남는다');
  assert.ok(!keptKs.includes(7), '우선순위가 가장 낮은 히스토리 그림이 밀려난다');
  assert.deepEqual([...keptKs].sort((a, b) => a - b), keptKs, '첨부 순서는 k 오름차순으로 되돌린다');
});

test('S6 allMissingFigures — k 부여가 planSlots와 동일하다 (모델 간 번호 정합)', () => {
  const slots = [u('a.jpg'), null, u('a.jpg'), u('b.jpg')];
  const plan = planSlots(slots, BUCKET, 'SVG/GeoGebra');
  const all = allMissingFigures(slots, '이 모델은 이미지를 받지 않음');
  assert.deepEqual(all.slotStatuses.map((s) => s.k), plan.slotToK);
  assert.ok(all.slotStatuses.every((s) => s.ok === false));
  assert.equal(all.attachedKs.length, 0);
});

test('S7 buildFigMeta — 성공·누락이 슬롯별 상태와 꼬리말 재료로 갈라진다', () => {
  const slots = [u('a.jpg'), null, u('b.jpg')];
  const plan = planSlots(slots, BUCKET, 'SVG/GeoGebra');
  const meta = buildFigMeta(plan.slotToK, [1], new Map([...plan.preRejected, [3, '장당 4MB 초과']]));
  assert.deepEqual(meta.attachedKs, [1]);
  assert.deepEqual(meta.missing, [{ k: 2, reason: 'SVG/GeoGebra' }, { k: 3, reason: '장당 4MB 초과' }]);
  assert.deepEqual(meta.slotStatuses.map((s) => s.ok), [true, false, false]);
});

/* ═══ 렌더 ═══ */

test('R1 numberFigures — 성공·누락 혼합', () => {
  const text = `앞 ${FIG_PLACEHOLDER} 가운데 ${FIG_PLACEHOLDER} 뒤`;
  const out = numberFigures(text, [{ k: 1, ok: true }, { k: 2, ok: false, reason: 'SVG/GeoGebra' }]);
  assert.equal(out, '앞 [그림 1] 가운데 [그림 2 — 첨부되지 않음: SVG/GeoGebra] 뒤');
});

test('R2 자리표시자 수 > statuses 수 → 참조 없음, 전송용 표식은 새지 않는다 (⑤)', () => {
  const out = numberFigures(`${FIG_PLACEHOLDER}${FIG_PLACEHOLDER}`, [{ k: 1, ok: true }]);
  assert.equal(out, '[그림 1][그림 — 첨부되지 않음: 참조 없음]');
  assert.ok(!out.includes(FIG_PLACEHOLDER));
});

test('R3 본문의 자연 발생 `[그림]`·`[그림1]`은 건드리지 않는다 — 표식이 ⟦⟧인 이유', () => {
  const text = `위 [그림] 참조. [그림1]과 같다. ${FIG_PLACEHOLDER}`;
  const out = numberFigures(text, [{ k: 1, ok: true }]);
  assert.equal(out, '위 [그림] 참조. [그림1]과 같다. [그림 1]');
});

test('R4 D19 회귀 — 자른 텍스트의 자리표시자 수만큼 슬롯을 남기면 번호가 1부터 연속', () => {
  const full = `${FIG_PLACEHOLDER} 본문 ${FIG_PLACEHOLDER} 더 긴 본문 ${FIG_PLACEHOLDER}`;
  const cut = full.slice(0, full.indexOf('더 긴'));         // 세 번째 자리표시자가 잘려 나감
  const slots = [u('a.jpg'), u('b.jpg'), u('c.jpg')].slice(0, countPlaceholders(cut));
  const plan = planSlots(slots, BUCKET, 'SVG/GeoGebra');
  const meta = buildFigMeta(plan.slotToK, plan.fetchTargets.map((t) => t.k), plan.preRejected);
  const out = numberFigures(cut, meta.slotStatuses);
  assert.ok(out.includes('[그림 1]') && out.includes('[그림 2]'), out);
  assert.ok(!out.includes('[그림 3]'), '잘려 나간 그림은 번호도 첨부도 없다');
  assert.deepEqual(meta.attachedKs, [1, 2]);
});

test('R5 countPlaceholders', () => {
  assert.equal(countPlaceholders(''), 0);
  assert.equal(countPlaceholders('그림 없음'), 0);
  assert.equal(countPlaceholders(`${FIG_PLACEHOLDER}a${FIG_PLACEHOLDER}`), 2);
});

test('R6 figureLabel — statuses 부재 폴백', () => {
  assert.equal(figureLabel(undefined), '[그림 — 첨부되지 않음: 참조 없음]');
});

/* ═══ 꼬리말 ═══ */

test('N1 그림이 하나도 없으면 꼬리말은 빈 문자열 (D10 — 프롬프트 불변)', () => {
  assert.equal(buildImageNote([], []), '');
});

test('N2 첨부만 / 누락만 / 혼합', () => {
  assert.match(buildImageNote([1, 3], []), /2장이 첨부.*\[그림 1\], \[그림 3\]/s);
  assert.match(buildImageNote([], [{ k: 1, reason: 'SVG/GeoGebra' }]), /첨부되지 않은 그림: \[그림 1 — SVG\/GeoGebra\]/);
  const both = buildImageNote([2], [{ k: 1, reason: '파일 없음' }]);
  assert.ok(both.includes('[그림 2]') && both.includes('[그림 1 — 파일 없음]'));
});

test('N3 mime 화이트리스트에 gif가 없다 (Gemini 최소공통분모) · png/jpeg/webp뿐', () => {
  assert.deepEqual([...FIG_MIME_OK], ['image/png', 'image/jpeg', 'image/webp']);
});
