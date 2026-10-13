/**
 * Phase 70b §3-7 — 브라우저 Typst 컴파일(PDF).
 *
 * ExportDialog → run.ts가 **동적 import**한다(D18). 처음 한 번: wasm(28MB, /typst/) · 글꼴 3종(Cache Storage) · mitex(벤더링)
 * 을 불러 컴파일러를 만들고, 이후엔 재사용한다.
 *
 * ⚠ mitex·그림은 패키지 레지스트리가 아니라 **가상 파일(mapShadow)** 로 올린다 — `.typ`의 import는 `/mitex/lib.typ`
 *   (다운로드용 .typ는 `@preview/mitex:0.2.7` 그대로 — typst.ts의 레지스트리는 동기 XHR로 packages.typst.org를 친다).
 * ⚠ 글꼴은 typst.ts 기본 묶음(text 17파일)을 끄고 필요한 3개만: Noto Serif KR Regular·Bold(noto-cjk 고정 커밋) ·
 *   New Computer Modern Math(typst-assets v0.13.1 — typst.ts 기본 출처와 같은 곳). 셋 다 SHA-256 검증,
 *   **불일치·실패면 중단**(폴백 글꼴로 조판하면 결과가 달라지는데 파일은 남는다 — v1 근거).
 * ⚠ mitex 실패(D28): 진단에 mitex가 보이면 `findFailingFormulas`로 실패 수식만 찾아 `math-fail` 상자로 바꿔 다시 조판.
 *   그 밖의 오류는 첫 진단 한 줄로 중단.
 */

import type { ExportDoc } from './ir';
import type { CollectedFigures } from './assets';
import { serializeTypst, typStr, type MathFormula } from './typst';
import { findFailingFormulas, probeSource } from './isolate';

/** package.json의 @myriaddreamin/typst-ts-web-compiler 버전과 같아야 한다(export:assets가 이 이름으로 복사) */
export const TYPST_TS_VERSION = '0.7.0';
const WASM_URL = `/typst/typst_ts_web_compiler_bg.${TYPST_TS_VERSION}.wasm`;
const MITEX_BASE = '/typst/packages/preview/mitex/0.2.7/';
const MITEX_FILES = ['lib.typ', 'mitex.typ', 'mitex.wasm', 'typst.toml', 'specs/mod.typ', 'specs/prelude.typ', 'specs/latex/standard.typ'];
export const MITEX_IMPORT = '/mitex/lib.typ';

const NOTO = 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@9b0f1436e455d902de067a2501422e5dc71ad16b/Serif/SubsetOTF/KR/';
export const EXPORT_FONTS = [
  { name: 'NotoSerifKR-Regular.otf', url: NOTO + 'NotoSerifKR-Regular.otf', sha256: '5ea012e15cb7eacc1f680aee1703f3b164791b1443ea3e52b65080cca5d179cf' },
  { name: 'NotoSerifKR-Bold.otf', url: NOTO + 'NotoSerifKR-Bold.otf', sha256: '263408609ef416d597718ea91055379867d3e7086fa32f049996995d4e715e55' },
  { name: 'NewCMMath-Regular.otf', url: 'https://cdn.jsdelivr.net/gh/typst/typst-assets@v0.13.1/files/fonts/NewCMMath-Regular.otf', sha256: 'bfd2f9b22caacd41b8b29cfe3f6d72f976f221a65362e07eda35cbae863721b7' },
] as const;
const FONT_CACHE = 'mathory-export-fonts-v1';

export type CompileStage = 'compiler' | 'fonts' | 'typeset' | 'isolate';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 고정 URL 글꼴 — Cache Storage에 있으면 그것을(해시 재검증), 없으면 받아서 검증 후 저장 */
async function loadFont(f: (typeof EXPORT_FONTS)[number]): Promise<Uint8Array> {
  let cache: Cache | null = null;
  try { cache = await caches.open(FONT_CACHE); } catch { /* 비보안 컨텍스트·비공개 창 — 캐시 없이 */ }
  const hit = cache ? await cache.match(f.url) : undefined;
  if (hit) {
    const b = new Uint8Array(await hit.arrayBuffer());
    if ((await sha256Hex(b)) === f.sha256) return b;
    await cache?.delete(f.url);
  }
  const res = await fetch(f.url);
  if (!res.ok) throw new Error(`글꼴을 받지 못했습니다(${f.name} · HTTP ${res.status})`);
  const b = new Uint8Array(await res.arrayBuffer());
  if ((await sha256Hex(b)) !== f.sha256) throw new Error(`글꼴 파일이 예상과 다릅니다(${f.name}) — 내보내기를 중단합니다`);
  try { await cache?.put(f.url, new Response(b as BodyInit)); } catch { /* 저장 실패는 무시 */ }
  return b;
}

interface Engine {
  compiler: Awaited<ReturnType<typeof makeCompiler>>['compiler'];
  mitex: (readonly [string, Uint8Array])[];
}
let enginePromise: Promise<Engine> | null = null;

async function makeCompiler(onStage: (s: CompileStage) => void) {
  onStage('compiler');
  const [{ createTypstCompiler }, { loadFonts }] = await Promise.all([
    import('@myriaddreamin/typst.ts/compiler'),
    import('@myriaddreamin/typst.ts/dist/esm/options.init.mjs'),
  ]);
  onStage('fonts');
  const fonts = await Promise.all(EXPORT_FONTS.map(loadFont));
  const compiler = createTypstCompiler();
  onStage('compiler');
  await compiler.init({
    getModule: () => WASM_URL,
    beforeBuild: [loadFonts(fonts, { assets: false })],
  });
  // mitex(벤더링) → 가상 파일
  const files = await Promise.all(MITEX_FILES.map(async (p) => {
    const res = await fetch(MITEX_BASE + p);
    if (!res.ok) throw new Error(`mitex 파일을 받지 못했습니다(${p})`);
    return [p, new Uint8Array(await res.arrayBuffer())] as const;
  }));
  return { compiler, mitex: files };
}

function getEngine(onStage: (s: CompileStage) => void): Promise<Engine> {
  if (!enginePromise) {
    enginePromise = makeCompiler(onStage);
    enginePromise.catch(() => { enginePromise = null; });   // 실패하면 다음 시도에서 다시
  }
  return enginePromise;
}

type Diag = { message?: string; severity?: string } | string;
const diagText = (d: Diag) => (typeof d === 'string' ? d : `${d.message ?? ''}`);
const isError = (d: Diag) => (typeof d === 'string' ? /error/i.test(d) : !d.severity || /error/i.test(d.severity));

async function compileSource(engine: Engine, source: string): Promise<{ pdf?: Uint8Array; errors: string[] }> {
  engine.compiler.addSource('/main.typ', source);
  const r = await engine.compiler.compile({ mainFilePath: '/main.typ', format: 1 /* CompileFormatEnum.pdf */, diagnostics: 'full' });
  const errors = ((r.diagnostics ?? []) as Diag[]).filter(isError).map(diagText);
  return { pdf: r.result ?? undefined, errors: r.result ? [] : errors.length ? errors : ['알 수 없는 컴파일 오류'] };
}

export interface CompileOutcome {
  pdf: Uint8Array;
  /** D28 — 원문 상자로 바꾼 수식 */
  failed: MathFormula[];
}

export async function compilePdf(doc: ExportDoc, figs: CollectedFigures, onStage: (s: CompileStage) => void = () => {}): Promise<CompileOutcome> {
  const engine = await getEngine(onStage);
  // 그림 → 가상 파일(이전 내보내기의 그림이 남지 않게 매번 다시 올린다)
  engine.compiler.resetShadow();
  for (const [p, b] of engine.mitex) engine.compiler.mapShadow(`/mitex/${p}`, b);
  for (const [path, bytes] of Object.entries(figs.files)) engine.compiler.mapShadow(`/${path}`, bytes);

  onStage('typeset');
  const first = serializeTypst(doc, { figurePath: figs.pathOf, mitexImport: MITEX_IMPORT });
  const r1 = await compileSource(engine, first.source);
  if (r1.pdf) return { pdf: r1.pdf, failed: [] };
  if (!r1.errors.some((m) => /mitex|plugin/i.test(m))) throw new Error(`조판에 실패했습니다 — ${r1.errors[0]}`);

  onStage('isolate');
  const { failed } = await findFailingFormulas(first.formulas, async (subset) => {
    const r = await compileSource(engine, probeSource(subset, MITEX_IMPORT, typStr));
    return !r.pdf;
  });
  const ids = new Set(failed.map((f) => f.id));
  onStage('typeset');
  const second = serializeTypst(doc, { figurePath: figs.pathOf, mitexImport: MITEX_IMPORT, failedMath: ids });
  const r2 = await compileSource(engine, second.source);
  if (!r2.pdf) throw new Error(`조판에 실패했습니다 — ${r2.errors[0]}`);
  return { pdf: r2.pdf, failed: first.formulas.filter((f) => ids.has(f.id)) };
}
