/* 개선묶음 M2 A — lib/dialogs.ts 계약 검증
 *
 * 이 모듈은 import 0이라 tsc로 단독 컴파일된다(다른 순수 모듈들과 같은 관례).
 * 검증 대상은 렌더가 아니라 **싱글턴 계약**이다 — 큐·기본값·Host 부재 폴백.
 * 그 셋이 깨지면 증상이 "호출부가 영원히 await한다"라서 화면만 봐서는 못 잡는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
globalThis.window = globalThis.window ?? {};          // 브라우저 환경 흉내(open()의 가드)
const D = require('../.test-build/lib/dialogs.js');

test('Host 구독 전 호출은 큐에 쌓이고, 구독하면 첫 건이 뜬다', async () => {
  let shown = null;
  const p = D.confirmDialog({ message: 'A' });
  D.subscribeDialogs((r) => { shown = r; });
  assert.equal(shown?.message, 'A');
  D.resolveDialog(true);
  assert.equal(await p, true);
  D.subscribeDialogs(null);
});

test('큐: 두 번째는 첫 번째가 닫힌 뒤에 뜬다 (오버레이 중첩 금지)', async () => {
  const seen = [];
  D.subscribeDialogs((r) => { if (r) seen.push(r.message); });
  const p1 = D.alertDialog('1');
  const p2 = D.alertDialog('2');
  assert.deepEqual(seen, ['1'], '두 번째가 미리 뜨면 Escape가 어느 것을 닫는지 알 수 없다');
  D.resolveDialog(undefined); await p1;
  assert.deepEqual(seen, ['1', '2']);
  D.resolveDialog(undefined); await p2;
  D.subscribeDialogs(null);
});

test('취소 기본값: confirm=false · prompt=null · alert=undefined', async () => {
  D.subscribeDialogs(() => {});
  const c = D.confirmDialog({ message: 'x' }); D.resolveDialog(false);
  assert.equal(await c, false);
  const pr = D.promptDialog({ title: 'x' }); D.resolveDialog(null);
  assert.equal(await pr, null);
  const a = D.alertDialog('x'); D.resolveDialog(undefined);
  assert.equal(await a, undefined);
  D.subscribeDialogs(null);
});

test('Host 언마운트 시 대기 중 요청이 기본값으로 흘러간다 (영구 await 방지)', async () => {
  D.subscribeDialogs(() => {});
  const c = D.confirmDialog({ message: 'x' });
  const pr = D.promptDialog({ title: 'y' });
  D.subscribeDialogs(null);                    // Host가 사라졌다
  assert.equal(await c, false);
  assert.equal(await pr, null);
});

test('resolve 뒤 큐가 비면 listener에 null이 전달된다(닫힘 신호)', async () => {
  const seq = [];
  D.subscribeDialogs((r) => seq.push(r === null ? 'null' : r.message));
  const p = D.alertDialog('z');
  D.resolveDialog(undefined); await p;
  assert.deepEqual(seq, ['z', 'null']);
  D.subscribeDialogs(null);
});

test('다행 메시지는 배열 그대로 전달된다 (\\n join 금지)', async () => {
  let shown = null;
  D.subscribeDialogs((r) => { if (r) shown = r; });
  const p = D.confirmDialog({ title: '폴더 삭제', message: ['첫 줄', '둘째 줄'], danger: true });
  assert.deepEqual(shown.message, ['첫 줄', '둘째 줄']);
  assert.equal(shown.danger, true);
  D.resolveDialog(true); await p;
  D.subscribeDialogs(null);
});
