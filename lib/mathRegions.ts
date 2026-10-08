/**
 * M7 D2·D3 — 편집창 쪽 수식 영역 스캐너의 **단일 원천**.
 *
 * 소비처 6곳(`latex-linter.findMathRegions` · `latex-highlight` · `latex-completions.isInsideMath` ·
 * `proofread`의 masking / extractMathRegions / collectMathRanges)이 이 함수를 쓴다.
 * ⚠ import 0 — `npm run test:mathregions`가 이 파일 하나를 tsc로 단독 컴파일한다.
 * ⚠ 렌더·저장 경로(`locale.ts`·`preprocess.ts`·`mathIndex.ts`)는 별개다(M7 §6 범위 밖).
 *
 * ── R-$$ 규칙 (M7 D2) ─────────────────────────────────────────────────────
 * `$$`를 만나면 **같은 행의 나머지**를 본다.
 *   (a) 행 나머지가 공백뿐            → display 펜스. 닫는 `$$`를 찾는다(없으면 미닫힘, 문서 끝까지)
 *   (b) 같은 행 안에 닫는 `$$`가 있다 → 한 줄짜리 display 영역(레거시 — 렌더는 인라인으로 본다)
 *   (c) 둘 다 아니다                → **길이 0의 빈 인라인 쌍**(`empty: true`)으로 보고 `i+2`에서 계속
 * (c)가 없던 때: `$` 버튼이 넣는 빈 `$|$`가 display 펜스로 읽혀 **뒤의 진짜 display 블록**과 짝지어지고,
 * 그 블록의 닫는 `$$`가 미닫힘 오류로 찍혔다(스케치 A 문제 1). `$$$x$`도 `빈 쌍 + $x$`로 읽힌다.
 *
 * ── 단일 `$` ──────────────────────────────────────────────────────────────
 * 닫는 `$` = 백슬래시가 앞에 없는 다음 `$`(빈 줄을 만나면 종료). 미닫힘이면 **행 끝까지**를
 * 영역으로 잡고(`closed: false`) 행 끝에서 계속한다. `inlineSingleLine`이면 닫는 `$`도 같은 행
 * 안에서만 찾는다(하이라이터 전용 — 아래 줄의 `$`를 닫힘으로 오인해 타이핑마다 색이 요동치는 것을
 * 막는다. 린터·교정은 종전대로 빈 줄까지).
 *
 * ── `\[`·`\(` ───────────────────────────────────────────────────────────
 * 종전(latex-linter)과 같다. 미닫힘이면 문서 끝까지 영역으로 잡고 종료.
 */

export type MathDelimiter = '$$' | '$' | '\\[' | '\\(';

export interface MathRegion {
  /** 구분자 포함 시작 */
  from: number;
  /** 구분자 포함 끝(exclusive). 미닫힘이면 영역이 닿는 끝(행 끝 또는 문서 끝) */
  to: number;
  innerFrom: number;
  innerTo: number;
  kind: 'display' | 'inline';
  delimiter: MathDelimiter;
  closed: boolean;
  /** R-$$ (c) — `$$`를 빈 인라인 쌍으로 읽은 것(길이 0, 진단 없음, `isInsideMath` true) */
  empty: boolean;
}

export interface ScanOptions {
  /** 단일 `$`의 닫는 짝을 같은 행 안에서만 찾는다(하이라이터). 기본 false = 빈 줄까지 */
  inlineSingleLine?: boolean;
}

function lineEndFrom(text: string, i: number): number {
  const nl = text.indexOf('\n', i);
  return nl === -1 ? text.length : nl;
}

function restOfLineBlank(text: string, i: number): boolean {
  const end = lineEndFrom(text, i);
  for (let k = i; k < end; k++) {
    if (text[k] !== ' ' && text[k] !== '\t' && text[k] !== '\r') return false;
  }
  return true;
}

export function scanMathRegions(text: string, opts: ScanOptions = {}): MathRegion[] {
  const regions: MathRegion[] = [];
  const n = text.length;
  let i = 0;

  while (i < n) {
    const ch = text[i];

    // ── \[ … \] ──
    if (ch === '\\' && text[i + 1] === '[') {
      const innerFrom = i + 2;
      const close = text.indexOf('\\]', innerFrom);
      if (close === -1) {
        regions.push({ from: i, to: n, innerFrom, innerTo: n, kind: 'display', delimiter: '\\[', closed: false, empty: false });
        break;
      }
      regions.push({ from: i, to: close + 2, innerFrom, innerTo: close, kind: 'display', delimiter: '\\[', closed: true, empty: false });
      i = close + 2;
      continue;
    }

    // ── \( … \) ──
    if (ch === '\\' && text[i + 1] === '(') {
      const innerFrom = i + 2;
      const close = text.indexOf('\\)', innerFrom);
      if (close === -1) {
        regions.push({ from: i, to: n, innerFrom, innerTo: n, kind: 'inline', delimiter: '\\(', closed: false, empty: false });
        break;
      }
      regions.push({ from: i, to: close + 2, innerFrom, innerTo: close, kind: 'inline', delimiter: '\\(', closed: true, empty: false });
      i = close + 2;
      continue;
    }

    // 이스케이프된 달러(`\$`)는 구분자가 아니다
    if (ch === '\\' && text[i + 1] === '$') {
      i += 2;
      continue;
    }

    if (ch !== '$') {
      i++;
      continue;
    }

    // ── $$ (R-$$) ──
    if (text[i + 1] === '$') {
      const innerFrom = i + 2;
      const lineEnd = lineEndFrom(text, innerFrom);
      const closeOnLine = text.indexOf('$$', innerFrom);
      if (closeOnLine !== -1 && closeOnLine < lineEnd) {
        // (b) 한 줄짜리 display
        regions.push({ from: i, to: closeOnLine + 2, innerFrom, innerTo: closeOnLine, kind: 'display', delimiter: '$$', closed: true, empty: false });
        i = closeOnLine + 2;
        continue;
      }
      if (restOfLineBlank(text, innerFrom)) {
        // (a) display 펜스
        const close = text.indexOf('$$', innerFrom);
        if (close === -1) {
          regions.push({ from: i, to: n, innerFrom, innerTo: n, kind: 'display', delimiter: '$$', closed: false, empty: false });
          break;
        }
        regions.push({ from: i, to: close + 2, innerFrom, innerTo: close, kind: 'display', delimiter: '$$', closed: true, empty: false });
        i = close + 2;
        continue;
      }
      // (c) 빈 인라인 쌍
      regions.push({ from: i, to: i + 2, innerFrom: i + 1, innerTo: i + 1, kind: 'inline', delimiter: '$$', closed: true, empty: true });
      i += 2;
      continue;
    }

    // ── 단일 $ ──
    {
      const innerFrom = i + 1;
      let close = -1;
      for (let j = innerFrom; j < n; j++) {
        const c = text[j];
        if (c === '$' && text[j - 1] !== '\\') { close = j; break; }
        if (c === '\n') {
          if (opts.inlineSingleLine) break;
          if (text[j + 1] === '\n') break;   // 빈 줄 → 인라인 종료
        }
      }
      if (close === -1) {
        const end = lineEndFrom(text, innerFrom);
        regions.push({ from: i, to: end, innerFrom, innerTo: end, kind: 'inline', delimiter: '$', closed: false, empty: false });
        i = end;
        continue;
      }
      regions.push({ from: i, to: close + 1, innerFrom, innerTo: close, kind: 'inline', delimiter: '$', closed: true, empty: false });
      i = close + 1;
      continue;
    }
  }

  return regions;
}

/** `pos`가 어떤 영역 **안**(구분자 사이, `innerFrom <= pos <= innerTo`)인가. 빈 쌍도 안이다. */
export function mathRegionAt(regions: MathRegion[], pos: number): MathRegion | null {
  for (const r of regions) {
    if (pos < r.innerFrom) break;   // 영역은 오름차순
    if (pos <= r.innerTo) return r;
  }
  return null;
}

/* ── keydown 시점의 영역 판정은 "삽입 뒤의 문서"로 한다 (Phase 68a K8 · 2026-10-08 덕수 실물 검수) ──────────
   `$` 버튼·Ctrl+M이 넣는 `$|$`가 **행 끝**이면 R-$$ (a)가 `$$`를 display 펜스로 읽어 커서를 "밖"으로 판정한다 →
   68a는 첫 키가 기록되지 않아 한글로 남았고(실측 `$ㅏ(x)$`), 68b는 두 번째 Ctrl+M이 "나오기" 대신 삽입을 돌려 `$ $|$ $`를
   만든다. 글자 하나를 넣어 본 문서로 판정하면 updateListener(삽입 시작 `fb`에서 판정)와 기준이 같아진다.
   Phase 68b Q9 — `lib/mathAscii.ts`에서 여기로 이관(그쪽은 re-export). 소비처: 68a keydown capture · 68b `exitRegionAt`. */
export interface ProbeResult { region: MathRegion | null; probe: string }
export function probeInsertionRegion(doc: string, pos: number): ProbeResult {
  const probe = doc.slice(0, pos) + 'x' + doc.slice(pos);
  return { region: mathRegionAt(scanMathRegions(probe), pos), probe };
}

/* ── Phase 68b D5′ — 수식 "나오기"의 안/밖 판정 ──────────────────────────────
   ① 실문서 영역(비empty) → region  ② 실문서가 (c) 빈 쌍(행 중간 `$|$`) → empty(probe 불필요)
   ③ 실문서 밖 → probe. probe도 밖 → null  ④ probe가 inline이고 안이 probe 글자뿐이며 **양옆이 `$`** → empty(행 끝 `$|$`)
   ⑤ 그 밖 → null(밖). ⚠ ④의 양옆 `$` 가드(I2) — `a $|b` 같은 자리는 ①에서 미닫힘 region으로 잡혀 여기 오지 않지만,
   온다 해도 `$|$`가 아닌 두 글자를 지우면 안 된다. */
export type ExitRegion =
  | { kind: 'region'; region: MathRegion }
  | { kind: 'empty'; from: number; to: number };

export function exitRegionAt(doc: string, pos: number): ExitRegion | null {
  const r = mathRegionAt(scanMathRegions(doc), pos);
  if (r) return r.empty ? { kind: 'empty', from: r.from, to: r.to } : { kind: 'region', region: r };
  const p = probeInsertionRegion(doc, pos).region;
  if (!p) return null;
  if (p.kind === 'inline' && p.innerTo - p.innerFrom === 1 && doc[pos - 1] === '$' && doc[pos] === '$') {
    return { kind: 'empty', from: pos - 1, to: pos + 1 };
  }
  return null;
}
