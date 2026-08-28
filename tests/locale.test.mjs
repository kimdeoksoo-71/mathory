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
/* 개선묶음 M2 C — 재인용부 래퍼 */
const ref = (type, r, inner) =>
  `<span class="ref-marker" data-reftype="${type}" data-ref="${r}">${inner}</span>`;
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

/* ═══ L5 — 행 중간 (개선묶음 M2 C에서 계약이 바뀌었다) ═══
   Phase 60의 L5는 "행 중간 리터럴은 무변환"이었다. M2 C가 그 자리를 **재인용부**로
   보고 ref-marker를 씌운다(hover 말풍선의 앵커). 텍스트 내용·렌더 결과는 그대로이고
   래핑만 는다 — 시각 표시는 주지 않는다(cursor:help만). */

test('L5 행 중간 리터럴은 ref-marker로 감싸진다 (M2 C — 구 "무변환" 대체)', () => {
  assert.equal(P('조건 (가)에 의해 성립'),
    '조건 ' + ref('gana', '가', '(가)') + '에 의해 성립');
  assert.equal(P('앞의 ㄱ. 항목을 보면'),
    '앞의 ' + ref('giyeok', 'ㄱ', 'ㄱ.') + ' 항목을 보면');
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
  assert.equal(P('\\ref{2}에서'), ref('tag', '2', '(2)') + '에서');
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

/* ═══ 개선묶음 M1 A — 연속된 수식 전용 행 사이에 빈 줄 ═══ */

test('M1: 수식만 있는 행이 연달아 오면 렌더 시 빈 줄이 들어간다', () => {
  // 소스는 붙여 쓴다(빈 줄 없음). 이 장치가 없으면 세 행이 한 문단으로 합쳐진다.
  const out = P('$x = 1$\n$y = 2$\n$z = 3$');
  assert.equal(out, '$x = 1$\n\n$y = 2$\n\n$z = 3$');
});

test('M1: 행 꼬리 \\tag 가 붙어도 수식 전용 행으로 본다', () => {
  const out = P('$x = 1$ \\tag{1}\n$y = 2$');
  assert.ok(out.includes('\n\n'), out);
});

test('M1: 산문 뒤에 오는 수식 행은 지금까지처럼 이어 붙는다', () => {
  const src = '따라서 다음이 성립한다\n$x = 1$';
  assert.equal(P(src), src);
});

test('M1: 수식 뒤 산문도 이어 붙는다 (한쪽만 수식이면 발동 안 함)', () => {
  const src = '$x = 1$\n따라서 참이다';
  assert.equal(P(src), src);
});

test('M1(정정): \\tag 로 끝난 문단이 다음 문단을 삼키지 않는다', () => {
  // ⚠ 잠복 버그였다 — `\\s*$`가 개행까지 먹어 빈 줄이 사라지고 두 문단이 합쳐졌다.
  const out = P('문장 하나 \\tag{1}\n\n다음 문단');
  assert.ok(out.includes('</span>\n\n다음 문단'), JSON.stringify(out));
});

/* ═══════════════════════════════════════════════════════════════
   개선묶음 M2 C — 참조 인용 마크업 (D19′ 6항목)
   ⚠ ①·②는 실측으로 결함이 확인된 자리다. 프로토타입에서
     보호 목록이 좁으면 정의부가 5회 재감쌈됐고(참조 9개 중 5개가 가짜),
     자모 lookahead가 넓으면 실사용 표기 7개 중 4개를 놓쳤다.
   ═══════════════════════════════════════════════════════════════ */

test('M2-C1 정의부는 재감쌈되지 않는다 (행 시작 (가)·ㄱ.·① 5사례)', () => {
  const out = P('(가) 첫째\n(나) 둘째\n\nㄱ. 명제1\nㄴ. 명제2\n\n① 보기');
  assert.equal(out.match(/marker-\w+"><span class="ref-marker"/g), null,
    '정의부 span 안에 ref-marker가 박히면 정의부가 참조로 둔갑한다');
  assert.equal((out.match(/class="ref-marker"/g) || []).length, 0,
    '정의부만 있는 본문에는 참조가 하나도 없어야 한다');
});

test('M2-C2 자모 경계: 조사가 붙어도 인식하고, 겹자모·ㅋㅋ·모음은 아니다', () => {
  for (const [text, want] of [
    ['보기 ㄱ이 성립한다', true],
    ['따라서 ㄱ은 참이고 ㄴ은 거짓', true],
    ['ㄷ에서 얻은 식', true],
    ['ㄴ의 역은 참이 아니다', true],
    ['꾸민 자모 ㄲ, ㄸ, ㅃ, ㅆ, ㅉ', false],
    ['ㅋㅋ 같은 표기', false],
    ['모음 ㅏ ㅑ ㅓ', false],
  ]) {
    const has = /data-reftype="giyeok"/.test(P(text));
    assert.equal(has, want, `${text} → ${has}`);
  }
});

test('M2-C3 수식 안은 건드리지 않는다', () => {
  assert.equal(P('값 $x_{(가)} + ①$ 는 그대로'), '값 $x_{(가)} + ①$ 는 그대로');
  assert.equal(P('$$\\frac{(가)}{①}$$'), '$$\\frac{(가)}{①}$$');
});

test('M2-C4 코드펜스·인라인 코드는 보호된다', () => {
  assert.match(P('코드 `(가)` 와 `①`'), /`\(가\)`/);
  assert.equal(/ref-marker/.test(P('```\n(가) ①\n```')), false);
});

test('M2-C5 \\ref{n}은 reftype=tag span이 된다', () => {
  assert.equal(P('식 \\ref{3} 에서'), '식 ' + ref('tag', '3', '(3)') + ' 에서');
});

test('M2-C6 멱등: 두 번 돌려도 ref-marker가 중첩되지 않는다', () => {
  const once = P('조건 (가)와 ① 그리고 ㄱ이');
  const twice = preprocessLocale(once, 'ko');
  assert.equal(twice, once, '보호 목록에 ref-marker 자신이 없으면 여기서 깨진다(W3)');
  assert.equal(once.match(/ref-marker[^>]*><span class="ref-marker"/g), null);
});

test('M2-C7 행 시작 `ㄱ. `는 참조가 아니라 정의부다 (말풍선은 DOM 순서로 가른다)', () => {
  // 덕수 실사용 보고(2026-08-28): 풀이에서 보기를 다시 언급할 때 행 시작 `ㄱ. `를 쓴다.
  // 그 자리는 Phase 60이 정의부로 못박아 둔 곳이라 여기서는 ref-marker가 붙지 않는다 —
  // **마크업으로는 보기의 ㄱ.과 풀이의 ㄱ.이 구별되지 않는다.**
  // 구별은 순서뿐이고, 그 판정은 RefTooltip이 한다("첫 등장 = 정의, 이후 = 참조").
  // 이 테스트는 그 전제를 고정한다 — 여기서 ref-marker가 나오기 시작하면
  // RefTooltip의 순서 규칙과 이중으로 걸려 정의부가 자기 자신을 가리키게 된다.
  const out = P('ㄱ. 명제 하나\n\nㄱ. 참이다.');
  assert.equal((out.match(/class="marker-giyeok"/g) || []).length, 2);
  assert.equal(/data-reftype="giyeok"/.test(out), false);
});
