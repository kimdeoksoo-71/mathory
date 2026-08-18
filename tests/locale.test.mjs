/**
 * Phase 60 검증 — 리터럴 마커 인식 · 마커 뒤 공백 정규화 · 레거시 무회귀.
 *
 * 실행: npm run test:locale
 * (lib/locale.ts를 tsc로 뽑아 Node에서 직접 돌린다. test:case 하니스와 동일 방식)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  preprocessLocale, MARKER_LINE_RE,
} from '../.test-build/lib/locale.js';

const P = (t) => preprocessLocale(t, 'ko');
const gana = (ch) => `<span class="marker-gana">(${ch})</span>`;
const giyeok = (ch) => `<span class="marker-giyeok">${ch}.</span>`;

/* ═══ L1·L2 — 리터럴 인식 + 공백 무관 ═══ */

test('L1 (가) 리터럴: 행 시작이 marker span, 뒤 공백 0/1/2/tab 출력 동일', () => {
  const outs = ['(가)내용', '(가) 내용', '(가)  내용', '(가)\t내용'].map(P);
  assert.equal(new Set(outs).size, 1);
  assert.equal(outs[0], `${gana('가')}내용`);
});

test('L2 ㄱ. 리터럴: 같은 규칙', () => {
  const outs = ['ㄱ.내용', 'ㄱ. 내용', 'ㄱ.  내용'].map(P);
  assert.equal(new Set(outs).size, 1);
  assert.equal(outs[0], `${giyeok('ㄱ')}내용`);
});

/* ═══ L3·L4 — 범위 (10개, 경계 고정) ═══ */

test('L3 확장 범위 (가)~(차) · ㄱ.~ㅊ. 전부 인식', () => {
  for (const ch of ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차']) {
    assert.equal(P(`(${ch}) x`), `${gana(ch)}x`);
  }
  for (const ch of ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ']) {
    assert.equal(P(`${ch}. x`), `${giyeok(ch)}x`);
  }
});

test('L4 범위 밖 (카) · ㅋ. 은 무변환 — 경계가 조용히 넓어지지 않게', () => {
  assert.equal(P('(카) x'), '(카) x');
  assert.equal(P('ㅋ. x'), 'ㅋ. x');
});

/* ═══ L5 — 행 중간은 건드리지 않는다 ═══ */

test('L5 행 중간 리터럴은 무변환 (문장 속 인용)', () => {
  assert.equal(P('조건 (가)에 의해 성립'), '조건 (가)에 의해 성립');
  assert.equal(P('앞의 ㄱ. 항목을 보면'), '앞의 ㄱ. 항목을 보면');
});

/* ═══ L6·L7 — 레거시 (a)/(i)는 변환하지 않는다 (Phase 60 후속) ═══ */

test('L6 레거시 (a)~(e)/(i)~(v)는 변환하지 않고 원문 그대로 둔다', () => {
  // 두 표기가 공존하면 "무엇을 쓰면 무엇이 나오는지"가 흐려진다 → 변환을 걷어냈다.
  assert.equal(P('(a) 내용'), '(a) 내용');
  assert.equal(P('(e) x'), '(e) x');
  assert.equal(P('(i) x'), '(i) x');
  assert.equal(P('(iii)x'), '(iii)x');
  assert.equal(P('조건 (a)에 의해'), '조건 (a)에 의해');   // 행 중간도 무변환
});

test('L7 그래도 레거시 마커 행의 문단 분리는 유지한다 (옛 문항 가독성)', () => {
  // 변환은 없애되 MARKER_LINE_RE에는 남긴다 — 안 그러면 remark-breaks 부재 때문에
  // 옛 문항의 `(a) …`↵`(b) …`가 한 문단으로 뭉쳐 읽을 수 없게 된다.
  assert.equal(P('(a) 하나\n(b) 둘'), '(a) 하나\n\n(b) 둘');
  assert.equal(P('(i) 하나\n(ii) 둘'), '(i) 하나\n\n(ii) 둘');
  // 마커가 아닌 행은 그대로 (뭉침이 정상 동작)
  assert.equal(P('첫 줄\n둘째 줄'), '첫 줄\n둘째 줄');
});

/* ═══ L8 — 마커 행 분리 (§0.2 결함 회귀 방지) ═══ */

test('L8 연속 리터럴 마커 행이 각각 독립 문단으로 분리된다', () => {
  // 이게 없으면 remark-breaks가 없는 파이프라인에서 한 문단으로 뭉친다
  const out = P('(가) 짝수인 경우\n(나) 홀수인 경우');
  assert.equal(out, `${gana('가')}짝수인 경우\n\n${gana('나')}홀수인 경우`);
});

test('L8b 블록 프리셋 3행이 각각 분리된다 (gana · roman)', () => {
  assert.equal(P('(가) \n(나) \n(다) '),
    [gana('가'), '', gana('나'), '', gana('다')].join('\n'));
  assert.equal(P('ㄱ. \nㄴ. \nㄷ. '),
    [giyeok('ㄱ'), '', giyeok('ㄴ'), '', giyeok('ㄷ')].join('\n'));
});

/* ═══ L9 — 멱등성 ═══ */

test('L9 멱등: 변환 결과를 다시 변환해도 같다 (리터럴·레거시 혼재)', () => {
  for (const c of [
    '(가) x\n(나) y', '(a) x\n(b)y', 'ㄱ. x\n(i) y',
    '① x\n(가) y', '(a) 하나\nㄷ. 둘\n③ 셋',
  ]) {
    assert.equal(P(P(c)), P(c), `멱등 실패: ${JSON.stringify(c)}`);
  }
});

/* ═══ L10 — 수식 보호 ═══ */

test('L10 수식 안의 마커 모양은 변환되지 않는다', () => {
  for (const m of ['$(a)$', '$$ㄱ. x$$', '$(가)$', '\\((i)\\)']) {
    assert.equal(P(m), m, `수식 보호 실패: ${m}`);
  }
});

/* ═══ L11 — 다른 변환 무회귀 ═══ */

test('L11 원문자·tag·ref·Fig/Table 무회귀', () => {
  assert.equal(P('① 가\n② 나'),
    '<span class="marker-circled">①</span>가\n\n<span class="marker-circled">②</span>나');
  assert.equal(P('①가'), P('① 가'));                       // 원문자도 공백 무관
  assert.equal(P('문장 \\tag{3}'), '문장 <span class="tag-marker">(3)</span>');
  assert.equal(P('\\ref{2}에서'), '(2)에서');
  assert.equal(P('Fig. 1 참조'), '[그림1] 참조');
  assert.equal(P('Table 2 참조'), '[표2] 참조');
});

/* ═══ L12 — 로케일 게이트 ═══ */

test('L12 international에서는 리터럴도 레거시도 변환하지 않는다', () => {
  assert.equal(preprocessLocale('(가) x\n(a) y', 'international'), '(가) x\n(a) y');
});

/* ═══ L13·L14 — 공백 클래스 (D15) ═══ */

test('L13 행 선두 들여쓰기는 \\s 전종을 받는다 — [ \\t]로 좁히면 회귀', () => {
  // 현행 \s*·trimStart()가 이미 잡던 범위. HWP·웹 붙여넣기가 이런 공백을 남긴다.
  const WS = [' ', '\t', ' ', '　', ' ', ' ',
              ' ', ' ', ' ', '﻿', '\v', '\f'];
  for (const w of WS) {
    assert.ok(MARKER_LINE_RE.test(`${w}(a) x`), `들여쓰기 미인식: U+${w.codePointAt(0).toString(16)}`);
    assert.ok(MARKER_LINE_RE.test(`${w}(가) x`));
    assert.ok(MARKER_LINE_RE.test(`${w}ㄱ. x`));
    assert.ok(MARKER_LINE_RE.test(`${w}① x`));
  }
});

test('L14 마커 뒤 공백 흡수는 개행을 먹지 않는다 — 문단 경계 보존', () => {
  assert.equal(P('(a)\n\n다음'), '(a)\n\n다음');   // 레거시는 무변환이지만 경계는 보존
  assert.equal(P('(가)\n\n다음'), `${gana('가')}\n\n다음`);
  assert.equal(P('ㄱ.\n\n다음'), `${giyeok('ㄱ')}\n\n다음`);
  // 내용 없는 원문자 줄이 뭉치지 않는다 (Phase 57 회귀 방지)
  assert.equal(P('① \n② '),
    '<span class="marker-circled">①</span>\n\n<span class="marker-circled">②</span>');
});
