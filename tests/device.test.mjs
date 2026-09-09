// Phase 64 S1 — lib/device.ts 판별 로직 검증 (npm run test:device)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PHONE_MAX_SHORT_SIDE, PHONE_MEDIA_QUERY,
  isPhoneViewport, guessPhoneFromHeaders,
} from '../.test-build/lib/device.js';

/* ─── 뷰포트 판별: D1 기기 표를 그대로 고정한다 ─── */
test('폰 세로: iPhone 15 393×852 · S24 384×824 (coarse)', () => {
  assert.equal(isPhoneViewport(393, 852, true), true);
  assert.equal(isPhoneViewport(384, 824, true), true);
});

test('폰 가로 852×393 (coarse) — 높이 조건이 터치에서만 발동해 폰', () => {
  assert.equal(isPhoneViewport(852, 393, true), true);
});

test('PC 낮은 창 1200×500 (fine) — coarse가 아니라 데스크톱 (v2 E-1의 핵심)', () => {
  assert.equal(isPhoneViewport(1200, 500, false), false);
});

test('PC 좁은 창 599×800 (fine) — 폭 조건은 포인터 무관, 폰', () => {
  assert.equal(isPhoneViewport(599, 800, false), true);
  assert.equal(isPhoneViewport(600, 800, false), false);   // 경계 +1
});

test('폴더블 펼침·태블릿은 터치여도 데스크톱: Z Fold 673×841 · Pixel Fold 883×736 · iPad mini 744×1133', () => {
  assert.equal(isPhoneViewport(673, 841, true), false);
  assert.equal(isPhoneViewport(883, 736, true), false);
  assert.equal(isPhoneViewport(744, 1133, true), false);
});

test('미디어 쿼리 문자열은 판별식과 같은 599·coarse 결합', () => {
  assert.equal(PHONE_MAX_SHORT_SIDE, 599);
  assert.equal(
    PHONE_MEDIA_QUERY,
    '(max-width: 599px), ((max-height: 599px) and (pointer: coarse))',
  );
});

/* ─── UA 추정 (F-2) ─── */
const UA = {
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  androidPhone: 'Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ipadDesktopMode: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  ipadMobileRequest: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  firefoxAndroidPhone: 'Mozilla/5.0 (Android 14; Mobile; rv:126.0) Gecko/126.0 Firefox/126.0',
  firefoxAndroidTablet: 'Mozilla/5.0 (Android 14; Tablet; rv:126.0) Gecko/126.0 Firefox/126.0',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
};

test('Client Hint가 있으면 그것만 믿는다 — ?1 폰 / ?0 데스크톱(Android 태블릿)', () => {
  assert.equal(guessPhoneFromHeaders(UA.macChrome, '?1'), true);
  assert.equal(guessPhoneFromHeaders(UA.androidPhone, '?0'), false);
});

test('UA 폴백: 폰 3종 통과', () => {
  assert.equal(guessPhoneFromHeaders(UA.iphone, null), true);
  assert.equal(guessPhoneFromHeaders(UA.androidPhone, null), true);
  assert.equal(guessPhoneFromHeaders(UA.firefoxAndroidPhone, null), true);
});

test('UA 폴백: 태블릿 4갈래 전부 데스크톱 (F-2 — Mobile 없는 Android · Tablet · iPad 두 모드)', () => {
  assert.equal(guessPhoneFromHeaders(UA.androidTablet, null), false);
  assert.equal(guessPhoneFromHeaders(UA.firefoxAndroidTablet, null), false);
  assert.equal(guessPhoneFromHeaders(UA.ipadDesktopMode, null), false);
  assert.equal(guessPhoneFromHeaders(UA.ipadMobileRequest, null), false);
});

test('UA 폴백: 데스크톱·빈 값·null은 데스크톱', () => {
  assert.equal(guessPhoneFromHeaders(UA.macChrome, null), false);
  assert.equal(guessPhoneFromHeaders('', null), false);
  assert.equal(guessPhoneFromHeaders(null, null), false);
  assert.equal(guessPhoneFromHeaders(undefined, undefined), false);
});
