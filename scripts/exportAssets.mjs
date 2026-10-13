/**
 * Phase 70b — Typst 웹 컴파일러 wasm을 public/typst/로 복사한다(D12·§3-7).
 *
 * node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm
 *   → public/typst/typst_ts_web_compiler_bg.<버전>.wasm   (gitignore — 레포에 28MB를 넣지 않는다)
 *
 * ⚠ 파일명에 버전을 넣는다 — 브라우저·CDN 캐시가 판 사이에 섞이지 않게(lib/export/compile.ts가 같은 이름을 만든다).
 * ⚠ `predev`·`build` 체인 **둘 다**에 들어 있어야 한다(icons:assets와 같은 배선). Vercel Build Command를 직접 지정하면
 *   이 단계가 빠져 PDF 내보내기가 wasm 404로 죽는다(M5 함정과 같다).
 * 실행: npm run export:assets   (--check: 복사본이 최신인지 확인만)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkgDir = path.dirname(require.resolve('@myriaddreamin/typst-ts-web-compiler/package.json'));
const version = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).version;
const src = path.join(pkgDir, 'pkg', 'typst_ts_web_compiler_bg.wasm');
const outDir = path.join(ROOT, 'public', 'typst');
const dst = path.join(outDir, `typst_ts_web_compiler_bg.${version}.wasm`);

const same = fs.existsSync(dst) && fs.statSync(dst).size === fs.statSync(src).size;
if (process.argv.includes('--check')) {
  if (!same) { console.error(`[export:assets] ✖ ${path.relative(ROOT, dst)} 없음 또는 낡음`); process.exit(1); }
  console.log(`[export:assets] OK — ${path.basename(dst)}`);
  process.exit(0);
}
fs.mkdirSync(outDir, { recursive: true });
// 이전 판 wasm 정리(버전이 바뀌면 옛 파일이 public에 남아 배포 용량만 키운다)
for (const f of fs.readdirSync(outDir)) {
  if (/^typst_ts_web_compiler_bg\..+\.wasm$/.test(f) && path.join(outDir, f) !== dst) fs.rmSync(path.join(outDir, f));
}
if (!same) fs.copyFileSync(src, dst);
console.log(`[export:assets] OK — ${path.basename(dst)} (${(fs.statSync(dst).size / 1e6).toFixed(1)}MB)`);
