/* Phase 68c D1 — lib/imeKey.ts (import 0). npm run test:imekey */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isImeKey } from '../.test-build/lib/imeKey.js';

test('네이티브 isComposing', () => assert.equal(isImeKey({ isComposing: true, keyCode: 13 }), true));
test('Safari 꼬리 keydown — isComposing false · keyCode 229', () => assert.equal(isImeKey({ isComposing: false, keyCode: 229 }), true));
test('React 합성 이벤트 — nativeEvent.isComposing', () => assert.equal(isImeKey({ keyCode: 13, nativeEvent: { isComposing: true } }), true));
test('평범한 Enter', () => assert.equal(isImeKey({ isComposing: false, keyCode: 13 }), false));
test('빈 객체', () => assert.equal(isImeKey({}), false));
test('React 합성 꼴 — 조합 아님', () => assert.equal(isImeKey({ keyCode: 13, nativeEvent: { isComposing: false } }), false));
