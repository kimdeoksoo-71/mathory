/**
 * Phase 61c 검증 — agent 대화 선택 영역 → Mathory 마크다운 직렬화.
 *
 * 실행: npm run test:extract
 *
 * **왕복(round-trip) 테스트다.** 규칙표를 눈으로 읽어서는 안 보이는 것들(순서 스큐 빈도,
 * `<br>` 뒤 `"\n"`, 마커 뒤 공백 흡수, `.katex-error`의 인덱스 소비)이 전부 이 방식으로만
 * 드러났다. 그래서 단위 검사가 아니라 실제 파이프라인을 구동한다:
 *
 *   마크다운 → [EditorPreview 전처리 사본] → unified(remark-math·gfm → rehype-raw·katex)
 *           → hast → 미니 트리 → serializeNodes → 기대 마크다운
 *
 * ⚠️ 한계: 이 테스트가 검증하는 것은 `serializeNodes` 코어와 규칙표뿐이다.
 *    **DOM→미니트리 어댑터**(Range 절단·closest 판정·스킵)는 변환기가 달라 커버되지 않는다.
 *    어댑터는 실물 대화 검수로만 확인된다(계획서 v4 §4.6 W3).
 *    아래 `toSNode`와 어댑터는 **규칙 한 벌**을 공유해야 한다 — 한쪽만 고치지 말 것.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';

import {
  buildRenderedMathIndex, stripPreviewArtifacts, normalizeMathDelimiters, serializeNodes,
} from '../.test-build/lib/chatExtract.js';

/* ═══════════════════════════════════════════════════════
   EditorPreview 전처리 사본 (components/editor/EditorPreview.tsx)
   ⚠️ 원본과 반드시 일치시킬 것. 갈라지면 이 테스트가 거짓 안심을 준다.
   ═══════════════════════════════════════════════════════ */
const MARKER_LINE_RE = new RegExp('^(?:\\((?:[a-e]|[가-차]|i{1,3}|iv|v)\\)|[ㄱ-ㅊ]\\.)[ \\t]*');
const GANA_LITERAL_RE = /^\((가|나|다|라|마|바|사|아|자|차)\)[ \t]*/;
const GIYEOK_LITERAL_RE = /^([ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊ])\.[ \t]*/;
const CIRCLED_NUM_LINE_RE = /^([①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮])[ \t]*/;

function preventSetextHeadings(text) {
  const lines = text.split('\n');
  const result = [];
  for (const line of lines) {
    const prevLine = result.length > 0 ? result[result.length - 1] : '';
    const isSetextUnderline = /^\s{0,3}-+\s*$/.test(line) || /^\s{0,3}=+\s*$/.test(line);
    const isLoneDash = /^\s{0,3}-\s*$/.test(line);
    const prevIsListItem = /^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/.test(prevLine);
    if (isSetextUnderline && prevLine.trim() !== '' && !(isLoneDash && prevIsListItem)) result.push('');
    result.push(line);
  }
  return result.join('\n');
}
function protectFences(text) {
  if (!text.includes('```')) return { text, fences: [] };
  const fences = [];
  const out = text.replace(/^```[^\n]*\n[\s\S]*?\n```[ \t]*$/gm, (m) => {
    fences.push(m);
    return `⟦FENCE_${fences.length - 1}⟧`;
  });
  return { text: out, fences };
}
function restoreFences(text, fences) {
  if (fences.length === 0) return text;
  return text.replace(/⟦FENCE_(\d+)⟧/g, (_, idx) => fences[parseInt(idx)] ?? '');
}
function preprocessLocale(text) {
  const mathRegions = [];
  const protect = (m) => { mathRegions.push(m); return `⟦MATH_${mathRegions.length - 1}⟧`; };
  let t = text
    .replace(/\$\$[\s\S]*?\$\$/g, protect)
    .replace(/\\\[[\s\S]*?\\\]/g, protect)
    .replace(/\$(?:[^$\\]|\\.)+\$/g, protect)
    .replace(/\\\([\s\S]*?\\\)/g, protect);
  const forced = [];
  for (const line of t.split('\n')) {
    const prevLine = forced.length > 0 ? forced[forced.length - 1] : '';
    if (MARKER_LINE_RE.test(line) && prevLine.trim() !== '') forced.push('');
    forced.push(line);
  }
  t = forced.join('\n');
  {
    const acc = [];
    for (const ln of t.split('\n')) {
      const pv = acc.length > 0 ? acc[acc.length - 1] : '';
      if (/^\*\*Case\s+\d+[a-z]?\.\*\*/.test(ln) && pv.trim() !== '') acc.push('');
      acc.push(ln);
    }
    t = acc.join('\n');
  }
  t = t.replace(/^(-\s+)\*\*(Case\s+\d+[a-z])\.\*\*/gm,
    (_, bullet, label) => `${bullet}<span class="marker-case-sub">**${label}.**</span>`);
  t = t.replace(new RegExp(GANA_LITERAL_RE.source, 'gm'), (_, ch) => `<span class="marker-gana">(${ch})</span>`);
  t = t.replace(new RegExp(GIYEOK_LITERAL_RE.source, 'gm'), (_, ch) => `<span class="marker-giyeok">${ch}.</span>`);
  t = t.replace(new RegExp(CIRCLED_NUM_LINE_RE.source, 'gm'), (_, ch) => `<span class="marker-circled">${ch}</span>`);
  t = t.replace(/\bFig\.(\d+)/g, '[그림$1]');
  t = t.replace(/\bTable\s+(\d+)/g, '[표$1]');
  t = t.replace(/\\ref\{(\d+)\}/g, (_, num) => `(${num})`);
  t = t.replace(/\\tag\{(\d+)\}\s*$/gm, (_, num) => `<span class="tag-marker">(${num})</span>`);
  t = t.replace(/⟦MATH_(\d+)⟧/g, (_, idx) => mathRegions[parseInt(idx)]);
  return t;
}
function preprocessMath(text) {
  let result = text.replace(/\\tag\{(\d+)\}/g, (_, num) => `\\tag*{(${num})}`);
  result = result.replace(/\\ref\{(\d+)\}/g, (_, num) => `\\text{(${num})}`);
  result = result.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);
  result = result.replace(/\\\(([\s\S]*?)\\\)/g, (_, inner) => `$${inner}$`);
  result = result.replace(/\$\$([\s\S]*?)\$\$/g, (match, inner) => {
    const trimmed = inner.trim();
    const hasLineBreak = /\\\\(?![a-zA-Z])/.test(trimmed);
    const hasEnvironment = /\\begin\s*\{/.test(trimmed);
    if (hasLineBreak && !hasEnvironment) {
      let wrapped = `\\displaystyle ${trimmed}`;
      wrapped = wrapped.replace(/\\\\(\s*\[[^\]]*\])?\s*/g,
        (m, spacing) => `\\\\${spacing || ''}\n\\displaystyle `);
      return `$$\n\\begin{array}{l}\n${wrapped}\n\\end{array}\n$$`;
    }
    return match;
  });
  result = result.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (match, inner) => {
    const patched = inner.replace(
      /(?<!\\displaystyle\s*)(\\(?:sum|int|prod|iint|iiint|oint|bigcup|bigcap)(?![a-zA-Z]))/g,
      '\\displaystyle $1');
    return `\\begin{cases}${patched}\\end{cases}`;
  });
  result = result.replace(/(?<!\$)\$(?!\$)((?:[^$\\]|\\.)+)\$(?!\$)/g, (match, inner) => {
    if (inner.trim().startsWith('\\displaystyle')) return match;
    return `$\\displaystyle ${inner}$`;
  });
  return result;
}
function previewPipeline(content) {
  const { text: shielded, fences } = protectFences(content);
  return restoreFences(preprocessMath(preprocessLocale(preventSetextHeadings(shielded))), fences);
}

/* ═══════════════════════════════════════════════════════
   hast → 미니 트리 (어댑터와 같은 규칙 한 벌)
   ═══════════════════════════════════════════════════════ */
const proc = unified()
  .use(remarkParse).use(remarkMath).use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeKatex, { strict: false, trust: true, macros: { '\\arraystretch': '1.8' } });

const clsOf = (n) => {
  const c = n.properties?.className;
  return Array.isArray(c) ? c.map(String) : c ? [String(c)] : [];
};
const isHost = (n) => n.type === 'element' && (clsOf(n).includes('katex') || clsOf(n).includes('katex-error'));
const rawTextOf = (n) => (n.type === 'text' ? n.value : (n.children || []).map(rawTextOf).join(''));

/** 문서 순서로 `.katex` + `.katex-error`. ⚠ `.katex`만 세면 안 된다 —
 *  실패한 수식도 소스 인덱스를 한 칸 소비한다(계획서 v4 §2-1). */
function collectHosts(tree) {
  const out = [];
  const rec = (n, inDisplay) => {
    if (n.type === 'element') {
      const cls = clsOf(n);
      if (cls.includes('katex-display')) inDisplay = true;
      if (isHost(n)) { out.push({ node: n, display: inDisplay }); return; }
    }
    (n.children || []).forEach((c) => rec(c, inDisplay));
  };
  rec(tree, false);
  return out;
}
function annotationOf(node) {
  let found = null;
  const rec = (n) => {
    if (found !== null) return;
    if (n.type === 'element' && n.tagName === 'annotation') {
      found = (n.children || []).map((c) => c.value ?? '').join('');
      return;
    }
    (n.children || []).forEach(rec);
  };
  rec(node);
  return found;
}

/** hast 트리 → SNode[]. `source`가 있으면 개수 게이트를 태우고 통과 시 원본 슬라이스를 쓴다. */
function toSNode(tree, source) {
  const hosts = collectHosts(tree);
  const index = source === undefined ? [] : buildRenderedMathIndex(source);
  const sliceable = source !== undefined && hosts.length === index.length;
  const mathMap = new Map();
  hosts.forEach((h, i) => {
    if (sliceable) {
      const latex = index[i].latex;
      mathMap.set(h.node, { latex, display: /^\$\$|^\\\[/.test(latex) && /\n/.test(latex) });
    } else {
      const isErr = clsOf(h.node).includes('katex-error');
      const raw = isErr ? rawTextOf(h.node) : (annotationOf(h.node) ?? '');
      const tex = stripPreviewArtifacts(raw);
      const display = isErr ? /\n/.test(tex) : h.display;
      mathMap.set(h.node, { latex: display ? `$$\n${tex}\n$$` : `$${tex}$` });
    }
    const m = mathMap.get(h.node);
    if (m.display === undefined) m.display = /^\$\$/.test(m.latex);
  });

  const conv = (n) => {
    if (n.type === 'text') return { tag: null, cls: [], text: n.value, children: [] };
    if (n.type !== 'element') return null;
    const attrs = {};
    for (const k of ['href', 'src', 'alt', 'start']) {
      const v = n.properties?.[k];
      if (v !== undefined && v !== null) attrs[k] = String(v);
    }
    const node = {
      tag: n.tagName, cls: clsOf(n), text: null, attrs,
      children: isHost(n) ? [] : (n.children || []).map(conv).filter(Boolean),
      math: mathMap.get(n) ?? null,
    };
    if (n.tagName === 'table') node.complete = true;   // 테스트는 항상 전체 선택
    return node;
  };
  return (tree.children || []).map(conv).filter(Boolean);
}

/** 마크다운 → 직렬화 결과 */
async function roundTrip(md) {
  const tree = await proc.run(proc.parse(previewPipeline(md)));
  return serializeNodes(toSNode(tree, md));
}
/** 게이트를 강제로 끄고(소스 없이) annotation 폴백 경로만 태운다 */
async function fallbackTrip(md) {
  const tree = await proc.run(proc.parse(previewPipeline(md)));
  return serializeNodes(toSNode(tree, undefined));
}

/* ═══════════════════════════════════════════════════════
   1. 수식 인덱스 — 순서 스큐
   ═══════════════════════════════════════════════════════ */
const BT = String.fromCharCode(96);
const F3 = BT + BT + BT;
const idxLatex = (src) => buildRenderedMathIndex(src).map((r) => r.latex);

test('코드펜스 안의 $는 수식이 아니다', () => {
  assert.deepEqual(idxLatex(F3 + 'python\nprint("$5 and $10")\n' + F3 + '\n\n수식 $y=2$'), ['$y=2$']);
});
test('mathory-graph 펜스도 마찬가지', () => {
  assert.deepEqual(idxLatex(F3 + 'mathory-graph\n{"a": "$x$"}\n' + F3 + '\n\n$z=3$'), ['$z=3$']);
});
test('~~~ 펜스도 가린다 (protectFences는 모르지만 remark는 안다)', () => {
  assert.deepEqual(idxLatex('~~~\n$x$\n~~~\n\n$y=1$'), ['$y=1$']);
});
test('인라인 코드 안의 $는 수식이 아니다', () => {
  assert.deepEqual(idxLatex('코드 ' + BT + '$x$' + BT + ' 와 $y=1$'), ['$y=1$']);
});
test('다중 백틱 인라인 코드 — `[^`\\n]*` 근사로는 못 잡는 자리', () => {
  assert.deepEqual(idxLatex(BT + BT + 'a ' + BT + '$x$' + BT + ' b' + BT + BT + ' 와 $y=1$'), ['$y=1$']);
});
test('마스킹은 오프셋을 보존한다', () => {
  const src = F3 + 'js\n$x$\n' + F3 + '\n\n$y=1$';
  const [r] = buildRenderedMathIndex(src);
  assert.equal(src.slice(r.from, r.to), '$y=1$');
});
test('$$ 블록·인라인·\\[·\\( 네 형태를 출현 순서로', () => {
  assert.deepEqual(idxLatex('$a$ 와 $$\nb\n$$ 와 \\(c\\) 와 \\[d\\]'),
    ['$a$', '$$\nb\n$$', '\\(c\\)', '\\[d\\]']);
});

/* ═══════════════════════════════════════════════════════
   2. 전처리 역변환
   ═══════════════════════════════════════════════════════ */
test('인라인 \\displaystyle 주입 제거', () => {
  assert.equal(stripPreviewArtifacts('\\displaystyle x^2+1'), 'x^2+1');
});
test('array{l} 래퍼 언랩 — 각 행의 \\displaystyle까지', () => {
  assert.equal(
    stripPreviewArtifacts('\\begin{array}{l}\n\\displaystyle a = b \\\\\n\\displaystyle c = d\n\\end{array}'),
    'a = b \\\\\nc = d');
});
test('사용자가 손으로 쓴 array{l}은 언랩하지 않는다', () => {
  const user = '\\begin{array}{l}\n1 \\\\ 2\n\\end{array}';
  assert.equal(stripPreviewArtifacts(user), user);
});
test('array 안에 다른 환경이 있으면 우리 래퍼가 아니다', () => {
  const user = '\\begin{array}{l}\n\\displaystyle \\begin{cases} 1 \\end{cases}\n\\end{array}';
  assert.equal(stripPreviewArtifacts(user), user.replace(/\\displaystyle\s+/g, ''));
});
test('cases 안 \\sum 주입도 전역 제거가 함께 걷는다', () => {
  assert.equal(
    stripPreviewArtifacts('\\begin{cases}\n\\displaystyle \\sum a & x>0\n\\end{cases}'),
    '\\begin{cases}\n\\sum a & x>0\n\\end{cases}');
});
test('\\tag* · \\text{(n)} 역변환', () => {
  assert.equal(stripPreviewArtifacts('x = 1 \\tag*{(3)}'), 'x = 1 \\tag{3}');
  assert.equal(stripPreviewArtifacts('y \\text{(2)}'), 'y \\ref{2}');
});
test('구분자 정규화 — \\\\[6pt] 보호', () => {
  assert.equal(normalizeMathDelimiters('\\(x\\)'), '$x$');
  assert.equal(normalizeMathDelimiters('\\[y\\]'), '$$y$$');
  assert.equal(normalizeMathDelimiters('a \\\\[6pt] b'), 'a \\\\[6pt] b');
});

/* ═══════════════════════════════════════════════════════
   3. 왕복 — 수식
   ═══════════════════════════════════════════════════════ */
test('왕복: 인라인 수식은 원문 그대로 (displaystyle 흔적 0)', async () => {
  assert.equal(await roundTrip('값은 $x^2+1$ 이다.'), '값은 $x^2+1$ 이다.');
});
test('왕복: 다행 display는 원문 그대로 (array{l} 흔적 0)', async () => {
  assert.equal(await roundTrip('$$\na = b \\\\\nc = d\n$$'), '$$\na = b \\\\\nc = d\n$$');
});
test('왕복: 수식 안 \\tag는 보존된다', async () => {
  assert.equal(await roundTrip('$$\nx = 1 \\tag{3}\n$$'), '$$\nx = 1 \\tag{3}\n$$');
});
test('왕복: 파싱이 깨진 수식도 원본 슬라이스로 복원된다 (.katex-error는 인덱스 소비자)', async () => {
  assert.equal(await roundTrip('$\\frac{1}{$ 는 깨진 수식'), '$\\frac{1}{$ 는 깨진 수식');
});
test('수식 밖의 \\$는 마크다운 이스케이프라 수식을 열지 않는다', async () => {
  assert.deepEqual(idxLatex('가격 \\$100 이고 \\$200 이다.'), []);
  assert.equal(await roundTrip('가격 \\$100 이고 \\$200 이다.'), '가격 \\$100 이고 \\$200 이다.');
});
test('수식 안의 \\$는 수식을 닫는다 (remark-math 규칙 — lib/mathIndex.ts와 갈리는 자리)', () => {
  assert.deepEqual(idxLatex('가격 $\\$5$ 그리고 $b=2$.'), ['$\\$', '$ 그리고 $']);
});
test('왕복: 에러가 중간에 끼어도 순서가 밀리지 않는다', async () => {
  assert.equal(
    await roundTrip('$a=1$ 그리고 $\\frac{1}{$ 그리고 $c=3$.'),
    '$a=1$ 그리고 $\\frac{1}{$ 그리고 $c=3$.');
});
test('왕복: 검산 펜스가 있어도 1순위(슬라이스)가 유지된다', async () => {
  const md = F3 + 'python\nx = 5  # $5\n' + F3 + '\n\n결과는 $y=2$ 이다.';
  assert.equal(await roundTrip(md), '결과는 $y=2$ 이다.');   // 펜스(pre)는 스킵
});
test('폴백 경로: annotation 역변환도 같은 수식을 낸다', async () => {
  assert.equal(await fallbackTrip('값은 $x^2+1$ 이다.'), '값은 $x^2+1$ 이다.');
  assert.equal(await fallbackTrip('$$\na = b \\\\\nc = d\n$$'), '$$\na = b \\\\\nc = d\n$$');
});
test('폴백 경로: 에러 span도 \\displaystyle 없이 나온다', async () => {
  const out = await fallbackTrip('$\\frac{1}{$ 는 깨진 수식');
  assert.ok(!out.includes('displaystyle'), out);
  assert.equal(out, '$\\frac{1}{$ 는 깨진 수식');
});

/* ═══════════════════════════════════════════════════════
   4. 왕복 — 마커·강조
   ═══════════════════════════════════════════════════════ */
test('왕복: (가) 마커 — 전처리가 삼킨 뒤 공백을 한 칸 복원', async () => {
  assert.equal(await roundTrip('(가) 첫 항목\n(나) 둘째'), '(가) 첫 항목\n\n(나) 둘째');
});
test('왕복: ㄱ. 마커', async () => {
  assert.equal(await roundTrip('ㄱ. 첫\nㄴ. 둘'), 'ㄱ. 첫\n\nㄴ. 둘');
});
test('왕복: ① 원문자는 같은 문단에 머문다', async () => {
  assert.equal(await roundTrip('① 하나\n② 둘'), '① 하나\n② 둘');
});
test('왕복: 텍스트 행의 \\tag{n}', async () => {
  assert.equal(await roundTrip('x는 1이다 \\tag{3}'), 'x는 1이다 \\tag{3}');
});
test('왕복: 하위 케이스 라벨(**Case na.**)', async () => {
  assert.equal(await roundTrip('- **Case 1a.** 본문'), '- **Case 1a.** 본문');
});
test('왕복: 강조·기울임·인라인 코드', async () => {
  assert.equal(await roundTrip('**굵게** 와 *기울임* 와 ' + BT + '코드' + BT),
    '**굵게** 와 *기울임* 와 ' + BT + '코드' + BT);
});

/* ═══════════════════════════════════════════════════════
   5. 왕복 — 블록 구조
   ═══════════════════════════════════════════════════════ */
test('왕복: 문단 경계는 빈 줄', async () => {
  assert.equal(await roundTrip('첫 문단.\n\n둘째 문단.'), '첫 문단.\n\n둘째 문단.');
});
test('왕복: 하드 브레이크(행 끝 두 칸)는 보존된다', async () => {
  assert.equal(await roundTrip('첫 줄  \n둘째 줄'), '첫 줄  \n둘째 줄');
});
test('왕복: 불릿 목록', async () => {
  assert.equal(await roundTrip('- 하나\n- 둘'), '- 하나\n- 둘');
});
test('왕복: 번호 목록은 번호를 지킨다', async () => {
  assert.equal(await roundTrip('1. 첫\n2. 둘'), '1. 첫\n2. 둘');
});
test('왕복: 중첩 목록', async () => {
  assert.equal(await roundTrip('- 하나\n  - 안쪽\n- 둘'), '- 하나\n  - 안쪽\n- 둘');
});
test('왕복: 제목', async () => {
  assert.equal(await roundTrip('## 제목\n\n본문'), '## 제목\n\n본문');
});
test('왕복: 인용문', async () => {
  assert.equal(await roundTrip('> 인용 $x=1$'), '> 인용 $x=1$');
});
test('왕복: 링크', async () => {
  assert.equal(await roundTrip('[링크](http://a.b) 뒤'), '[링크](http://a.b) 뒤');
});

/* ═══════════════════════════════════════════════════════
   6. 왕복 — 표
   ═══════════════════════════════════════════════════════ */
test('왕복: GFM 표 (전체 선택)', async () => {
  assert.equal(await roundTrip('| a | b |\n| --- | --- |\n| $x$ | 2 |'),
    '| a | b |\n| --- | --- |\n| $x$ | 2 |');
});
test('표 일부만 걸치면 표 문법을 만들지 않는다', async () => {
  const tree = await proc.run(proc.parse(previewPipeline('| a | b |\n| --- | --- |\n| 1 | 2 |')));
  const nodes = toSNode(tree, '| a | b |\n| --- | --- |\n| 1 | 2 |');
  const mark = (ns) => ns.forEach((n) => { if (n.tag === 'table') n.complete = false; else mark(n.children || []); });
  mark(nodes);
  const out = serializeNodes(nodes);
  assert.ok(!out.includes('---'), out);
  assert.equal(out, 'a b\n1 2');
});

/* ═══════════════════════════════════════════════════════
   7. 게이트 — 스큐가 남는 3종
   ═══════════════════════════════════════════════════════ */
const gatePasses = async (md) => {
  const tree = await proc.run(proc.parse(previewPipeline(md)));
  return collectHosts(tree).length === buildRenderedMathIndex(md).length;
};
test('게이트: 펜스·인라인 코드는 통과한다(마스킹이 처리)', async () => {
  assert.equal(await gatePasses(F3 + 'py\n$x$\n' + F3 + '\n\n$y=1$'), true);
  assert.equal(await gatePasses('코드 ' + BT + '$x$' + BT + ' 와 $y=1$'), true);
  assert.equal(await gatePasses('$\\frac{1}{$ 는 깨진 수식'), true);
  assert.equal(await gatePasses('가격 \\$100 이고 \\$200 이다.'), true);
});
test('게이트: 들여쓰기 코드블록·미닫힘 펜스는 걸러진다(폴백행)', async () => {
  assert.equal(await gatePasses('    $x$ indented\n\n$y=1$'), false);
  assert.equal(await gatePasses(F3 + 'py\n$x$\n\n$y=1$'), false);
});
