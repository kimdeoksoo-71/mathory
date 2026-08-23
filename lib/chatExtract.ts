/* ═══════════════════════════════════════════════════════════════
   lib/chatExtract.ts — Phase 61c: agent 대화 선택 영역 → Mathory 마크다운 직렬화 (순수 코어)

   ⚠️ 이 파일에 import 문을 두지 말 것.
      `npm run test:extract`가 이 파일 **하나만** tsc로 단독 컴파일한다
      (61a `lib/sheetImport.ts` · 61b `lib/verify/*`와 같은 규약).
      그래서 수식 스캐너도 `lib/mathIndex.ts`를 import하지 않는다. 다만 **사본이 아니다** —
      `scanRenderedMath`는 remark-math의 토큰화를 모사하도록 두 곳을 의도적으로 바꿨다(아래 주석).
      어긋나도 개수 게이트가 실패해 폴백으로 갈 뿐 오염되지는 않는다(감등이지 오작동이 아니다).

   DOM은 여기 없다. 팝업의 어댑터가 Range를 훑어 `SNode` 미니 트리를 만들고,
   여기서는 그 트리만 본다. 규칙표의 근거는 전부 실측이다(계획서 v4 §4.2).
   ═══════════════════════════════════════════════════════════════ */

/* ═══ 1. 수식 인덱스 ═══ */

export interface MathRange { from: number; to: number }

/**
 * **렌더러(remark-math)가 수식으로 보는 구간**을 훑는다.
 *
 * ⚠️ `lib/mathIndex.ts`의 `buildMathIndex`와 **의도적으로 두 곳이 다르다.** 그쪽은
 *    "편집창 커서 ↔ 미리보기 하이라이트"용이고, 이쪽은 remark-math의 토큰화를 모사해야 한다.
 *    베껴 오지 말 것 — 아래 두 규칙이 어긋나면 DOM 순번과 소스 순번이 조용히 밀린다.
 *
 *   ① **수식 밖의 `\X`는 마크다운 문자 이스케이프**라 건너뛴다.
 *      → `\$100`은 수식을 열지 못한다(remark도 그렇게 본다). `\\[6pt]`도 여기서 흡수돼
 *        `\[`(display 여는 구분자)로 오인되지 않는다.
 *      단 `\[`·`\(`는 예외다 — `preprocessMath`가 remark보다 먼저 `$$…$$`/`$…$`로 바꾼다.
 *   ② **수식 안에서는 이스케이프가 없다.** `$…\$…$`의 `\$`는 수식을 **닫는다**
 *      (micromark의 math-text는 코드 스팬과 같은 규칙이라 백슬래시를 보지 않는다 — 실측).
 *      `lib/mathIndex.ts`는 여기서 `content[j-1] !== '\\'`로 건너뛴다.
 */
function scanRenderedMath(content: string): MathRange[] {
  const ranges: MathRange[] = [];
  let i = 0;
  while (i < content.length) {
    const c = content[i];

    if (c === '\\') {
      const nxt = content[i + 1];
      if (nxt === '[') {
        const close = content.indexOf('\\]', i + 2);
        if (close !== -1) { ranges.push({ from: i, to: close + 2 }); i = close + 2; continue; }
        i += 2; continue;
      }
      if (nxt === '(') {
        const close = content.indexOf('\\)', i + 2);
        if (close !== -1) { ranges.push({ from: i, to: close + 2 }); i = close + 2; continue; }
        i += 2; continue;
      }
      i += 2; continue;                       // ① 문자 이스케이프
    }

    if (c === '$') {
      if (content[i + 1] === '$') {
        const close = content.indexOf('$$', i + 2);
        if (close !== -1) { ranges.push({ from: i, to: close + 2 }); i = close + 2; continue; }
        i += 2; continue;
      }
      let j = i + 1;
      let found = false;
      while (j < content.length) {
        if (content[j] === '$') {             // ② 수식 안에는 이스케이프가 없다
          ranges.push({ from: i, to: j + 1 });
          i = j + 1; found = true; break;
        }
        /* 빈 줄을 만나면 미종료로 본다 — 문단을 넘어가는 `$`는 대부분 통화 기호다 */
        if (content[j] === '\n' && content[j + 1] === '\n') break;
        j++;
      }
      if (!found) i++;
      continue;
    }

    i++;
  }
  return ranges;
}

export interface RenderedMath { from: number; to: number; latex: string }

/** 마스킹은 **길이와 개행을 보존**한다 → from/to가 원본 오프셋으로 그대로 유효하다.
 *  (개행을 공백으로 바꾸면 인라인 `$` 스캔의 "빈 줄에서 포기" 조건이 달라진다) */
function maskRun(m: string): string {
  return m.replace(/[^\n]/g, ' ');
}

/**
 * 렌더러가 **실제로 수식으로 본 것만** 출현 순서로 인덱싱한다.
 *
 * 무보정 `buildMathIndex`는 코드 구간의 `$`까지 세므로 DOM 순번과 어긋난다(실측:
 * 검산 python 부록 · `mathory-graph` 펜스 · 백틱 인용이 있으면 100% 어긋났다).
 *   ① ``` 펜스 — `EditorPreview.protectFences`와 동일 정규식
 *   ② ~~~ 펜스 — protectFences는 모르지만 remark는 안다
 *   ③ 인라인 코드 — **백틱 런 매칭**. `` `[^`\n]*` `` 근사는 다중 백틱에서 깨진다(실측)
 *
 * 남는 스큐(4칸 들여쓰기 코드블록 · 미닫힘 펜스)는 호출부의 개수 게이트가 잡는다.
 */
export function buildRenderedMathIndex(source: string): RenderedMath[] {
  const src = String(source == null ? '' : source);
  let masked = src.replace(/^```[^\n]*\n[\s\S]*?\n```[ \t]*$/gm, maskRun);
  masked = masked.replace(/^~~~[^\n]*\n[\s\S]*?\n~~~[ \t]*$/gm, maskRun);
  masked = masked.replace(/(`+)(?:[^`]|(?!\1)`)*?\1/g, maskRun);
  return scanRenderedMath(masked).map((r) => ({
    from: r.from,
    to: r.to,
    latex: src.slice(r.from, r.to),
  }));
}

/* ═══ 2. 미리보기 전처리 역변환 (폴백 경로) ═══ */

/**
 * `EditorPreview.preprocessMath`가 KaTeX에 넣기 전에 심어 둔 흔적을 걷어낸다.
 * annotation(성공한 수식)과 `.katex-error`의 textContent(실패한 수식) 양쪽에 쓴다 —
 * **둘 다 전처리된 TeX다**(실측: `$\$5$` → 에러 span 텍스트가 `"\displaystyle \\"`).
 *
 *  ① `array{l}` 언랩 — `\begin{array}{l}` + 선두 `\displaystyle` + 안쪽에 `\begin{` 없음일 때만.
 *     `preprocessMath`는 `hasEnvironment`면 래핑 자체를 건너뛰므로 이 조건이 우리 래퍼를 특징짓는다.
 *     조건을 넓히면 **사용자가 손으로 쓴 array를 파괴한다**(실측).
 *  ② `\displaystyle` 전역 제거 — 인라인 주입 · array 각 행 · `cases` 안 `\sum` 주입을 한 번에.
 *     사용자가 직접 쓴 `\displaystyle`도 지워지지만 `preprocessMath`가 재주입하므로 표시 차이 0.
 *  ③ `\tag*{(n)}` → `\tag{n}`
 *  ④ `\text{(n)}` → `\ref{n}` — 사용자가 직접 쓴 `\text{(3)}`과 오검 가능. 이것이 이 경로를
 *     **2순위**로 두는 이유다(1순위는 원본 슬라이스라 이런 추측이 아예 없다).
 */
export function stripPreviewArtifacts(tex: string): string {
  let t = String(tex == null ? '' : tex);
  const m = /^\s*\\begin\{array\}\{l\}\n([\s\S]*)\n\\end\{array\}\s*$/.exec(t);
  if (m && /^\\displaystyle\s/.test(m[1]) && m[1].indexOf('\\begin{') === -1) t = m[1];
  t = t.replace(/\\displaystyle\s+/g, '');
  t = t.replace(/\\tag\*\{\((\d+)\)\}/g, '\\tag{$1}');
  t = t.replace(/\\text\{\((\d+)\)\}/g, '\\ref{$1}');
  return t.trim();
}

/**
 * `\(…\)` → `$…$`, `\[…\]` → `$$…$$`.
 * ⚠️ `(?<!\\)` 뒤돌아보기 필수 — 없으면 행바꿈 `\\[6pt]`의 `\[`를 수식 여는 구분자로 먹는다(61a C6).
 */
export function normalizeMathDelimiters(text: string): string {
  return String(text == null ? '' : text)
    .replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, function (_m, inner) { return '$$' + inner + '$$'; })
    .replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, function (_m, inner) { return '$' + inner + '$'; });
}

/* ═══ 3. 직렬화 ═══ */

/** 어댑터(DOM) / 테스트(hast)가 만드는 미니 노드 트리.
 *  두 변환기는 **같은 규칙 한 벌**을 채워야 한다 — 한쪽만 고치면 조용히 갈라진다. */
export interface SNode {
  /** null이면 텍스트 노드 */
  tag: string | null;
  cls: string[];
  /** 텍스트 노드의 값(Range로 절단된 뒤) */
  text: string | null;
  /** 필요한 것만: href · src · alt · start */
  attrs?: Record<string, string>;
  children: SNode[];
  /** 수식 호스트(`.katex` · `.katex-error`)일 때 변환기가 채운다. latex는 **구분자 포함** */
  math?: { latex: string; display: boolean } | null;
  /** `table` 전용 — 표 전체가 선택 범위 안인가 */
  complete?: boolean;
}

/** 앞뒤로 빈 줄을 두는 블록 */
const BLOCK2: Record<string, true> = {
  p: true, blockquote: true, ul: true, ol: true, table: true, hr: true,
};
/** 줄만 나누는 블록. ⚠ 검증 리포트 카드는 `<p>`가 0건이고 전부 `div`다 */
const BLOCK1: Record<string, true> = {
  div: true, tr: true, summary: true, section: true, article: true, dt: true, dd: true,
};
/** 통째로 건너뛴다. 그래프 위젯은 클래스가 없어 `canvas`·`iframe`으로 걸러진다 */
const SKIP: Record<string, true> = {
  pre: true, button: true, select: true, input: true, textarea: true,
  canvas: true, iframe: true, svg: true, script: true, style: true, noscript: true,
};
/** 원문 리터럴을 그대로 보존하는 마커 span (전처리가 뒤 공백을 흡수했다 → 한 칸 복원) */
const MARKER_LITERAL: Record<string, true> = {
  'marker-gana': true, 'marker-giyeok': true, 'marker-circled': true,
};

interface Ctx { listDepth: number }

class Buf {
  private s = '';
  private need = 0;
  private markerSpace = false;

  text(v: string): void {
    if (!v) return;
    if (this.s) {
      const trail = /\n*$/.exec(this.s)![0].length;
      if (this.need > trail) this.s += new Array(this.need - trail + 1).join('\n');
    }
    this.need = 0;
    if (this.markerSpace) {
      this.markerSpace = false;
      if (!/^\s/.test(v)) this.s += ' ';
    }
    this.s += v;
  }

  /** 다음 내용 앞에 최소 n줄을 띄운다. 이미 있는 개행은 다시 세지 않는다 */
  break(n: number): void {
    if (!this.s) return;
    this.markerSpace = false;   // 줄이 끝나면 마커 뒤 공백은 의미가 없다
    if (n > this.need) this.need = n;
  }

  /** 마커 직후 — 다음 글자가 공백/개행이 아니면 한 칸을 끼운다 */
  marker(): void { this.markerSpace = true; }

  get value(): string { return this.s; }
}

function textOf(n: SNode): string {
  if (n.text !== null && n.text !== undefined) return n.text;
  const kids = n.children || [];
  let out = '';
  for (let i = 0; i < kids.length; i++) out += textOf(kids[i]);
  return out;
}

function render(nodes: SNode[], ctx: Ctx): string {
  const b = new Buf();
  const list = nodes || [];
  for (let i = 0; i < list.length; i++) renderInto(b, list[i], ctx, list[i + 1]);
  return b.value;
}

function wrap(b: Buf, n: SNode, ctx: Ctx, mark: string): void {
  const inner = render(n.children || [], ctx).trim();
  if (!inner) return;
  b.text(mark + inner + mark);
}

function renderList(b: Buf, n: SNode, ctx: Ctx): void {
  const ordered = n.tag === 'ol';
  const startAttr = (n.attrs && n.attrs.start) || '';
  const start = ordered ? (parseInt(startAttr, 10) || 1) : 1;
  const items = (n.children || []).filter(function (c) { return c.tag === 'li'; });
  if (!items.length) return;

  const outerGap = ctx.listDepth > 0 ? 1 : 2;
  const indent = new Array(ctx.listDepth + 1).join('  ');
  b.break(outerGap);
  for (let i = 0; i < items.length; i++) {
    const marker = ordered ? String(start + i) + '. ' : '- ';
    /* 중첩 목록은 자기 깊이로 스스로 들여쓰므로 여기서 다시 밀지 않는다 */
    const inner = render(items[i].children || [], { listDepth: ctx.listDepth + 1 }).replace(/\s+$/, '');
    b.break(1);
    b.text(inner ? indent + marker + inner : indent + marker.replace(/\s+$/, ''));
    b.break(1);
  }
  b.break(outerGap);
}

function renderTable(b: Buf, n: SNode, ctx: Ctx): void {
  const rows: SNode[][] = [];
  const collect = function (x: SNode): void {
    if (x.tag === 'tr') {
      rows.push((x.children || []).filter(function (c) { return c.tag === 'td' || c.tag === 'th'; }));
      return;
    }
    const kids = x.children || [];
    for (let i = 0; i < kids.length; i++) collect(kids[i]);
  };
  collect(n);
  if (!rows.length) return;

  /* 셀 안도 같은 규칙표로 재귀 직렬화한다(셀 안 수식·강조도 복원된다).
     GFM 표는 한 줄이 한 행이므로 개행은 공백으로 접고 `|`는 이스케이프한다. */
  const cell = function (c: SNode): string {
    return render(c.children || [], ctx)
      .replace(/\s*\n\s*/g, ' ')
      .replace(/\|/g, '\\|')
      .trim();
  };

  /* 일부만 걸친 표는 표 문법을 만들지 않는다 — 반쪽짜리 `|` 행은 편집창에서
     표로 렌더되지 않아 파이프가 그대로 보인다 */
  if (!n.complete) {
    b.break(1);
    for (let i = 0; i < rows.length; i++) {
      const line = rows[i].map(cell).filter(Boolean).join(' ');
      if (line) { b.text(line); b.break(1); }
    }
    b.break(1);
    return;
  }

  let width = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].length > width) width = rows[i].length;
  const line = function (cs: string[]): string {
    const padded = cs.slice();
    while (padded.length < width) padded.push('');
    return '| ' + padded.join(' | ') + ' |';
  };
  const sep: string[] = [];
  for (let i = 0; i < width; i++) sep.push('---');

  b.break(2);
  b.text(line(rows[0].map(cell)));
  b.break(1);
  b.text('| ' + sep.join(' | ') + ' |');
  for (let i = 1; i < rows.length; i++) { b.break(1); b.text(line(rows[i].map(cell))); }
  b.break(2);
}

function renderInto(b: Buf, n: SNode, ctx: Ctx, next?: SNode): void {
  if (!n) return;
  if (n.tag === null || n.tag === undefined) {
    /* 텍스트 노드에 살아남은 `$`는 **리터럴 달러**다(수식은 전부 math 호스트로 빠진다).
       그대로 두면 편집창에 붙였을 때 다시 수식 구분자로 읽히므로 이스케이프한다.
       ⚠ 다른 마크다운 활성 문자(`*`·`_`·`[`)는 건드리지 않는다 — 과잉 이스케이프가
         평범한 문장을 더 망친다(수용 손실로 문서화). */
    b.text((n.text || '').replace(/\$/g, '\\$'));
    return;
  }

  const tag = String(n.tag).toLowerCase();
  if (SKIP[tag]) return;
  const cls = n.cls || [];
  const has = function (c: string): boolean { return cls.indexOf(c) !== -1; };

  /* ── 수식 호스트: `.katex`(성공) · `.katex-error`(파싱 실패) ──
     둘 다 소스 인덱스를 한 칸씩 소비한다 → 변환기가 math를 채워 준다. 서브트리는 건너뛴다
     (`.katex-mathml`·`.katex-html`이 같은 내용을 두 번 담고 있다) */
  if (has('katex') || has('katex-error')) {
    const m = n.math;
    if (!m || !m.latex) return;
    if (m.display) { b.break(2); b.text(m.latex); b.break(2); }
    else b.text(m.latex);
    return;
  }

  /* ── 마커 span 계열 (렌더 전용 마크업 → 원문 표기로 되돌린다) ── */
  if (has('tag-marker')) {
    const num = /(\d+)/.exec(textOf(n));
    /* 앞 공백을 넣지 말 것 — 원문의 공백은 앞 텍스트 노드에 살아 있다 */
    b.text(num ? '\\tag{' + num[1] + '}' : textOf(n));
    return;
  }
  if (has('marker-case-sub')) {
    const t = textOf(n).trim();
    if (t) b.text('**' + t + '**');   // 내부 <strong>은 건너뛴다(중복 방지)
    return;
  }
  for (let i = 0; i < cls.length; i++) {
    if (MARKER_LITERAL[cls[i]]) {
      const t = textOf(n);
      if (t) { b.text(t); b.marker(); }
      return;
    }
  }

  switch (tag) {
    case 'br': {
      /* hast의 break 핸들러는 `<br>` **뒤에** `"\n"` 텍스트 노드를 함께 넣는다(실측).
         그러니 개행은 그쪽이 공급하고 여기서는 hard break 표식(두 칸)만 남긴다.
         raw HTML의 맨 `<br>`처럼 뒤가 개행이 아니면 개행까지 직접 넣는다. */
      const nlFollows = !!next && (next.tag === null || next.tag === undefined)
        && /^\n/.test(next.text || '');
      b.text(nlFollows ? '  ' : '  \n');
      return;
    }
    case 'strong': case 'b': wrap(b, n, ctx, '**'); return;
    case 'em': case 'i': wrap(b, n, ctx, '*'); return;
    case 'del': case 's': wrap(b, n, ctx, '~~'); return;
    case 'code': {
      const t = textOf(n);
      if (t) b.text('`' + t + '`');
      return;
    }
    case 'a': {
      const inner = render(n.children || [], ctx).trim();
      if (!inner) return;
      const href = n.attrs && n.attrs.href;
      b.text(href ? '[' + inner + '](' + href + ')' : inner);
      return;
    }
    case 'img': {
      const alt = n.attrs && n.attrs.alt;      // twemoji는 alt에 원래 이모지가 있다
      const src = n.attrs && n.attrs.src;
      if (alt) b.text(alt);
      else if (src) b.text('![](' + src + ')');
      return;
    }
    case 'ul': case 'ol': renderList(b, n, ctx); return;
    case 'table': renderTable(b, n, ctx); return;
    case 'blockquote': {
      const inner = render(n.children || [], ctx).trim();
      if (!inner) return;
      b.break(2);
      b.text(inner.split('\n').map(function (l) { return l ? '> ' + l : '>'; }).join('\n'));
      b.break(2);
      return;
    }
    default: break;
  }

  if (/^h[1-6]$/.test(tag)) {
    const inner = render(n.children || [], ctx).trim();
    if (!inner) return;
    b.break(2);
    b.text(new Array(Number(tag.charAt(1)) + 1).join('#') + ' ' + inner);
    b.break(2);
    return;
  }

  const gap = BLOCK2[tag] ? 2 : (BLOCK1[tag] ? 1 : 0);
  if (gap) b.break(gap);
  const kids = n.children || [];
  for (let i = 0; i < kids.length; i++) renderInto(b, kids[i], ctx, kids[i + 1]);
  if (gap) b.break(gap);
}

/** 미니 트리 → Mathory 표기 마크다운. 빈 결과면 `''` */
export function serializeNodes(nodes: SNode[]): string {
  const raw = render(nodes || [], { listDepth: 0 });
  return normalizeMathDelimiters(raw)
    .replace(/^[ \t]+$/gm, '')     // 공백뿐인 줄만 비운다(행 끝 두 칸 = hard break는 보존)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
