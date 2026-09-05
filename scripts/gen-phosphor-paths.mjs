#!/usr/bin/env node
/**
 * M4 — Phosphor 아이콘 path 생성기.
 *
 * 진실은 아래 ICONS 표 하나다(Mathory 의미 이름 → phosphor 파일명 · weight).
 * 출력: components/ui/phosphorPaths.ts — 커밋 대상 · 수동 편집 금지.
 *
 *   node scripts/gen-phosphor-paths.mjs           재생성 (icons:gen)
 *   node scripts/gen-phosphor-paths.mjs --check   재생성 결과 ↔ 커밋본 비교, 불일치면 exit 1 (prebuild)
 *   node scripts/gen-phosphor-paths.mjs --sheet   docs/icons-contact-sheet.html 재생성 (실물 판정용)
 *
 * 자산 경로는 require.resolve로 얻는다 — @phosphor-icons/core의 exports 맵이
 * ./assets/<weight>/*.svg 를 내보내므로(실측) pnpm·호이스팅 어디서든 재현된다.
 * ./package.json은 exports에 없어 막히므로(ERR_PACKAGE_PATH_NOT_EXPORTED) 자산
 * dirname에서 두 단계 위를 fs로 읽는다. (Final_V4 §4-1)
 *
 * ⚠ 출력에 생성 시각을 넣지 않는다 — icons:check가 바이트 diff라 시각이 들어가면
 *   재생성마다 불일치가 된다(core 버전만 기록).
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_TS = path.join(ROOT, 'components', 'ui', 'phosphorPaths.ts');
const OUT_SHEET = path.join(ROOT, 'docs', 'icons-contact-sheet.html');

/** Mathory 의미 이름 → [phosphor 파일명, weight]. Final_V4 §3 전수표. */
const ICONS = {
  // ── Icons.tsx 38종이 쓰는 것 ──
  arrowUUpLeft: ['arrow-u-up-left', 'regular'],            // IconUndo
  arrowUUpRight: ['arrow-u-up-right', 'regular'],          // IconRedo
  caretDown: ['caret-down', 'regular'],                    // IconChevronDown
  caretLeft: ['caret-left', 'regular'],                    // IconChevronLeft
  caretRight: ['caret-right', 'regular'],                  // IconChevron
  chatCenteredText: ['chat-centered-text', 'regular'],     // IconCoachImportant (D5)
  chatText: ['chat-text', 'regular'],                      // IconComment (D5)
  check: ['check', 'regular'],                             // IconCheck
  circleNotch: ['circle-notch', 'regular'],                // IconLoader (D14)
  clock: ['clock', 'regular'],                             // IconRecent
  clockCounterClockwise: ['clock-counter-clockwise', 'regular'], // IconRestore
  copy: ['copy', 'regular'],                               // IconCopy
  cursorText: ['cursor-text', 'regular'],                  // IconRename (D5)
  dotsSixVertical: ['dots-six-vertical', 'regular'],       // IconGrip
  dotsThreeVertical: ['dots-three-vertical', 'regular'],   // IconDotsVertical·IconDots (D22)
  downloadSimple: ['download-simple', 'regular'],          // IconDownload
  exit: ['sign-out', 'regular'],                           // IconExit (D23)
  fileText: ['file-text', 'regular'],                      // IconDocLines
  folder: ['folder', 'regular'],                           // IconFolder
  folderMove: ['folder-simple-dashed', 'regular'],         // IconFolderMove
  graph: ['graph', 'regular'],                             // IconBlockchain (D5)
  magnifyingGlass: ['magnifying-glass', 'regular'],        // IconSearch·SearchReplaceIcon (D11)
  pencilSimple: ['pencil-simple', 'regular'],              // IconEdit
  plus: ['plus', 'regular'],                               // IconPlus·PlusGlyph
  pushPin: ['push-pin', 'regular'],                        // IconPin (D13)
  pushPinFill: ['push-pin', 'fill'],                       // IconPin filled (D13)
  share: ['share-fat', 'regular'],                         // IconShare (D5)
  sidebarSimple: ['sidebar-simple', 'regular'],            // IconSidebar
  storefront: ['storefront', 'regular'],                   // IconBazaar
  tag: ['tag', 'regular'],                                 // IconTag
  textWidth: ['arrows-out-line-horizontal', 'regular'],    // IconTextWidth (D5·§4-5)
  trash: ['trash', 'regular'],                             // IconTrash
  tray: ['tray', 'regular'],                               // IconInbox
  x: ['x', 'regular'],                                     // IconClose
  // ── Row 2 툴바 (UnifiedToolbar·toolbarIcons) ──
  bracketsCurly: ['brackets-curly', 'regular'],            // SnippetIcon
  collapseIn: ['arrows-in-line-vertical', 'regular'],      // CollapseAllIcon 접기 (D10)
  collapseOut: ['arrows-out-line-vertical', 'regular'],    // CollapseAllIcon 펼치기 (D10)
  dollarSimple: ['currency-dollar-simple', 'regular'],     // InlineMathIcon·BlockMathIcon (D7)
  highlighter: ['highlighter', 'regular'],                 // KeySentenceIcon
  listChecks: ['list-checks', 'regular'],                  // ProofreadIcon
  numberCircleOne: ['number-circle-one', 'regular'],       // SpecialCharIcon
  scan: ['scan', 'regular'],                               // OcrIcon (D9)
  sigma: ['sigma', 'regular'],                             // SigmaIcon (D12)
  smiley: ['smiley', 'regular'],                           // EmojiIcon
  sparkle: ['sparkle', 'regular'],                         // AiMathGenIcon
  table: ['table', 'regular'],                             // TableAddIcon
  // ── 라이브러리 밖 (BlockBottomToolbar·CommentEditor) ──
  image: ['image', 'regular'],                             // CommentEditor 그림 삽입
  rows: ['rows', 'regular'],                               // MathSplitGlyph (D16)
  splitBlock: ['split-vertical', 'regular'],               // SplitGlyph (D16·N1)
};

const assetFile = (name, w) =>
  require.resolve(`@phosphor-icons/core/assets/${w}/${name}${w === 'regular' ? '' : `-${w}`}.svg`);

const corePkg = JSON.parse(fs.readFileSync(
  path.join(path.dirname(assetFile('trash', 'regular')), '..', '..', 'package.json'), 'utf8'));

function pathOf(name, weight) {
  const svg = fs.readFileSync(assetFile(name, weight), 'utf8');
  const ds = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
  const others = svg.match(/<(rect|circle|line|polyline|polygon|ellipse)\b/g) || [];
  if (ds.length !== 1 || others.length) {
    throw new Error(`${name}(${weight}): path ${ds.length}개 · 기타 도형 ${others.length}개 — 단일 <path> 전제가 깨졌다 (Final_V4 §4-1)`);
  }
  return ds[0];
}

function buildTs() {
  const keys = Object.keys(ICONS).sort();
  const entries = keys.map((k) => {
    const [name, w] = ICONS[k];
    return `  /** ${name}${w === 'regular' ? '' : ` (${w})`} */\n  ${k}: '${pathOf(name, w)}',`;
  });
  return `/**
 * 생성 파일 — 수동 편집 금지. \`npm run icons:gen\`으로 재생성 (scripts/gen-phosphor-paths.mjs).
 * 원천: @phosphor-icons/core@${corePkg.version} (https://phosphoricons.com) · viewBox 0 0 256 256 · fill
 *
 * Phosphor Icons © Phosphor Icons — MIT License. 전문: THIRD_PARTY_LICENSES.md
 */
export const PH = {
${entries.join('\n')}
} as const;
`;
}

// ───────────────────────── 컨택트시트 (--sheet · Final_V4 §4-6) ─────────────────────────

const boldPathOf = (name) => {
  const svg = fs.readFileSync(assetFile(name, 'bold'), 'utf8');
  return [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])[0];
};

function buildSheet(PH_) {
  const ph = (d, size, color = 'currentColor', extra = '') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="${color}" ${extra}><path d="${d}"/></svg>`;

  // 현행 유지 3종 + 비교용 레거시 도안 (Icons.tsx에서 복제 — 시트 전용)
  const legacySave = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/><path d="M5.6 11.8 8 14.2 12.4 9.8"/></svg>`;
  const legacySigmaM3 = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M45 17.5 H19 L34 32 L19 46.5 H45"/></svg>`;
  const stepperChevron = (up) => `<svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${up ? 'M1 5 L5 1 L9 5' : 'M1 1 L5 5 L9 1'}"/></svg>`;

  const blockMath = (size, mode) => mode === 'aniso'
    ? `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><g transform="translate(-2 0) scale(0.62 1)"><path d="${PH_.dollarSimple}"/></g><g transform="translate(99 0) scale(0.62 1)"><path d="${PH_.dollarSimple}"/></g></svg>`
    : `<svg width="${size}" height="${size}" viewBox="0 0 256 256" fill="currentColor"><g transform="translate(-12.4 25.6) scale(0.8)"><path d="${PH_.dollarSimple}"/></g><g transform="translate(63.6 25.6) scale(0.8)"><path d="${PH_.dollarSimple}"/></g></svg>`;

  const ladder = [
    ['IconChevron', 'caretRight'], ['IconChevronLeft', 'caretLeft'], ['IconChevronDown', 'caretDown'],
    ['IconTrash', 'trash'], ['IconFolder', 'folder'], ['IconShare *', 'share'], ['IconDownload', 'downloadSimple'],
    ['IconCopy', 'copy'], ['IconComment *', 'chatText'], ['IconLoader', 'circleNotch'], ['IconBlockchain *', 'graph'],
    ['IconPlus', 'plus'], ['IconRename *', 'cursorText'], ['IconClose', 'x'], ['IconDotsVertical(·Dots)', 'dotsThreeVertical'],
    ['IconFolderMove', 'folderMove'], ['IconSearch', 'magnifyingGlass'], ['IconBazaar', 'storefront'],
    ['IconEdit', 'pencilSimple'], ['IconGrip', 'dotsSixVertical'], ['IconInbox', 'tray'],
    ['IconPin', 'pushPin'], ['IconPin filled', 'pushPinFill'], ['IconRestore', 'clockCounterClockwise'],
    ['IconTextWidth *', 'textWidth'], ['IconSidebar', 'sidebarSimple'], ['IconRecent', 'clock'],
    ['IconUndo', 'arrowUUpLeft'], ['IconRedo', 'arrowUUpRight'], ['IconCheck', 'check'],
    ['IconDocLines', 'fileText'], ['IconTag', 'tag'], ['IconCoachImportant *', 'chatCenteredText'],
    ['IconExit(sign-out)', 'exit'],
  ];
  const SIZES = [12, 14, 16, 18, 20];

  const row2 = [
    ['실행취소', 'arrowUUpLeft'], ['다시실행', 'arrowUUpRight'], ['인라인 수식', 'dollarSimple'],
    ['블록 수식', null], ['OCR', 'scan'], ['Σ', 'sigma'], ['강조', 'highlighter'], ['상용구', 'bracketsCurly'],
    ['특수문자', 'numberCircleOne'], ['이모지', 'smiley'], ['표', 'table'], ['맞춤법', 'listChecks'],
    ['AI 완성', 'sparkle'], ['찾기', 'magnifyingGlass'], ['접기', 'collapseIn'], ['펼치기', 'collapseOut'],
  ];
  const row2Line = (size) => row2.map(([t, k]) =>
    `<span class="btn" title="${t}">${k ? ph(PH_[k], size) : blockMath(size, 'aniso')}</span>`).join('');

  const daggers = [
    ['FolderPathBar 꺾쇠', 'caret-right', 'caretRight', 10],
    ['MiniShell·ShareTree 꺾쇠', 'caret-right', 'caretRight', 11],
    ['탭 hover 삭제 · Proofread 휴지통', 'trash', 'trash', 11],
    ['탭 hover 이름변경', 'cursor-text', 'cursorText', 11],
    ['AIBrandIcon verify', 'magnifying-glass', 'magnifyingGlass', 12],
  ];
  const daggerRows = daggers.map(([label, file, key, size]) => {
    const bold = boldPathOf(file);
    return `<tr><td>${label} · ${size}px</td><td>${ph(PH_[key], size)}</td><td>${ph(bold, size)}</td><td>${ph(PH_[key], 14)}</td></tr>`;
  }).join('\n');

  const chatCmp = [12, 14, 17].map((s) =>
    `<td>${ph(PH_.chatText, s)} ${ph(PH_.chatCenteredText, s)} <span class="lbl">${s}px</span></td>`).join('');

  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<title>M4 아이콘 컨택트시트</title>
<style>
  body { margin: 0; padding: 32px 40px 80px; background: #FCFAF6; color: #2D2A23;
         font-family: -apple-system, 'Apple SD Gothic Neo', sans-serif; font-size: 13px; }
  h1 { font-size: 18px; } h2 { font-size: 14px; margin: 36px 0 10px; border-top: 1px solid #E8E4DF; padding-top: 20px; }
  .muted { color: #9C9585; } .icons { color: #9C9585; }
  .clay { background: #F4EFE7; border-radius: 8px; padding: 12px; display: inline-block; }
  table { border-collapse: collapse; } td, th { padding: 4px 14px 4px 0; text-align: left; vertical-align: middle; }
  th { font-weight: 600; font-size: 12px; color: #9C9585; }
  .ladder td:first-child { min-width: 190px; font-size: 12px; }
  .ladder svg { vertical-align: middle; margin-right: 10px; }
  .btn { display: inline-flex; width: 32px; height: 32px; align-items: center; justify-content: center;
         border-radius: 6px; } .btn:hover { background: #F0EBE3; }
  .row2 { display: inline-flex; gap: 2px; background: #FCFAF6; border: 1px solid #E8E4DF;
          border-radius: 8px; padding: 4px 8px; color: #9C9585; align-items: center; }
  .lbl { font-size: 11px; color: #9C9585; margin-left: 6px; }
  .dollar { font-size: 15px; color: #2D2A23; padding: 0 6px; }
  .stepper { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #E8E4DF;
             border-radius: 6px; padding: 4px 8px; color: #9C9585; }
  .stepper .num { font-size: 12px; color: #2D2A23; min-width: 20px; text-align: center; }
  .cmp td { padding-right: 28px; }
</style></head><body class="icons">
<h1>M4 아이콘 컨택트시트 <span class="muted">— @phosphor-icons/core@${corePkg.version} · Final_V4 §4-6 · 재생성: npm run icons:sheet</span></h1>
<p class="muted">배경 --bg-functional(#FCFAF6) · 아이콘색 --text-muted(#9C9585). "현행"과의 비교는 배포본 앱을 옆에 띄워서.</p>

<h2>1. 38종 사다리 12/14/16/18/20 <span class="muted">(유지 3종 제외 · * = 대안 도안)</span></h2>
<table class="ladder">${ladder.map(([n, k]) =>
  `<tr><td>${n}</td>${SIZES.map((s) => `<td>${ph(PH_[k], s)}</td>`).join('')}</tr>`).join('\n')}</table>

<h2>2. † 잔존 — regular 그대로 / bold 같은 크기 / regular 14 상향 (Q1)</h2>
<table><tr><th>자리</th><th>regular</th><th>bold</th><th>14 상향</th></tr>
${daggerRows}</table>

<h2>3. Row 2 실물 — 18 / 20 / 22 (Q2 · 인라인 $와 무게 비교)</h2>
${[18, 20, 22].map((s) => `<div style="margin: 8px 0"><span class="row2">${row2Line(s)}<span class="dollar">$x$ 텍스트</span></span><span class="lbl">${s}px</span></div>`).join('\n')}

<h2>4. Σ 트리거 — Phosphor sigma vs M3 자체 Σ (Q3 · 덕수 판정)</h2>
<span class="row2">${ph(PH_.sigma, 20)}<span class="lbl">Phosphor 20</span>${legacySigmaM3(22)}<span class="lbl">M3 자체 22</span></span>

<h2>5. BlockBottomToolbar 15px — plus / split-vertical(블록 분할) / rows(수식행 분할) (Q4)</h2>
<span class="row2">${ph(PH_.plus, 15)}${ph(PH_.splitBlock, 15)}${ph(PH_.rows, 15)}</span>

<h2>6. 블록 수식 — x0.62 비등방 vs 0.8 등방+겹침, 인라인 $ 옆에서 (Q5)</h2>
<span class="row2">${ph(PH_.dollarSimple, 20)}<span class="lbl">인라인</span>${blockMath(20, 'aniso')}<span class="lbl">비등방</span>${blockMath(20, 'iso')}<span class="lbl">등방+겹침</span></span>

<h2>7. IconTextWidth 24 정방 — 스테퍼 목업 (Q6)</h2>
<span class="stepper">${ph(PH_.textWidth, 24)}<span class="num">39</span><span style="display:inline-flex;flex-direction:column;gap:2px">${stepperChevron(true)}${stepperChevron(false)}</span></span>
<span class="lbl">현행은 27×15 비정방 — Row 1 실물에서 높이 확인</span>

<h2>8. chat-text(댓글) vs chat-centered-text(코칭) — 꼬리 위치 구분 (B5)</h2>
<table class="cmp"><tr>${chatCmp}</tr></table>

<h2>9. dots-three-vertical 통합 (D22 · 기본 16)</h2>
${ph(PH_.dotsThreeVertical, 16)} <span class="lbl">Sidebar·FolderView·ListView 점 메뉴</span>

<h2>10. VersionTimeline 트리거 열 14px — 유지 IconSave + Phosphor 3종 혼합 자리 (B13)</h2>
<div class="clay">${legacySave(14)} <span class="lbl">manual_save(유지·stroke)</span> ${ph(PH_.exit, 14)} <span class="lbl">editor_exit(sign-out)</span> ${ph(PH_.tag, 14)} <span class="lbl">named</span> ${ph(PH_.clockCounterClockwise, 14)} <span class="lbl">restore</span></div>
</body></html>
`;
}

// ───────────────────────── main ─────────────────────────

const mode = process.argv[2] || '';
const ts = buildTs();

if (mode === '--check') {
  const committed = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, 'utf8') : '';
  if (committed !== ts) {
    console.error('[icons:check] phosphorPaths.ts가 생성 결과와 다르다 — `npm run icons:gen` 후 커밋할 것.');
    process.exit(1);
  }
  console.log(`[icons:check] OK — ${Object.keys(ICONS).length}종 · core@${corePkg.version}`);
} else if (mode === '--sheet') {
  const PH_ = Object.fromEntries(Object.keys(ICONS).map((k) => [k, pathOf(...ICONS[k])]));
  fs.writeFileSync(OUT_SHEET, buildSheet(PH_));
  console.log(`[icons:sheet] ${path.relative(ROOT, OUT_SHEET)} 재생성`);
} else {
  fs.writeFileSync(OUT_TS, ts);
  console.log(`[icons:gen] ${path.relative(ROOT, OUT_TS)} — ${Object.keys(ICONS).length}종 · core@${corePkg.version}`);
}
