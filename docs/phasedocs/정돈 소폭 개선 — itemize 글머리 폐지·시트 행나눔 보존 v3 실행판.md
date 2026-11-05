# 정돈 소폭 개선 — itemize 라벨·글머리 폐지 · 원본 행나눔 보존 v3 실행판

> 작성 2026-11-05 · CLI(레포 `ff74bf0` 실측) · 실행판 · **구현 완료(2026-11-05) — §9 구현 기록**
> 계보: 덕수 요청 → v1 초안 → 덕수 결정 D1~D7 → v1 완성(CLI) → v2(web 검증 턴 — V1~V7 · 정정 E1~E6 · 보완 S1~S9 · 추가 결정 N1~N4) → **v3 실행판(CLI 교차검토 — v2 정정 G1~G6 · N1~N4 권장안 확정)** → 구현
> 기준: mathory `ff74bf0`(main) · GAS `gas-project-audition` origin/main `98b7f54`
> 이 문서는 자립한다(v1·v2를 다시 읽지 않아도 구현할 수 있다). v2(web)는 `docs/phaseSketch/tidy-itemize-linebreaks-v2.md` — 판정 근거는 부록 C에 옮겨 두었다.

**요청**
1. `\begin{itemize} … \end{itemize}` 벗기기(정돈 R0b)에서 `\item`의 **번호·글머리·라벨을 남기지 않는다.**
2. 시트(Data_DS) 가져오기의 문제·풀이를 **원본 행나눔대로** 마크다운 hard break(줄 끝 공백 2칸 + 줄바꿈)로. **편집창 정돈 버튼도 같은 줄바꿈을 넣는다.**

**범위**: 서버 0 · Firestore 규칙 0 · 스키마 0 · 렌더 4사이트 0 · 렌더 전처리 0 · 내보내기 0 · 폰 0 · OCR 경로 0 · 의존성 0 · 아이콘 0.
수정 5: `lib/proofread.ts` · `lib/blockTidy.ts` · `components/import/SheetImportModal.tsx` · `components/editor/EditorView.tsx` · `tests/blockTidy.test.mjs` + 문서. GAS는 별도 레포 커밋(D5).

---

## 0. 결정 (전부 확정)

| # | 쟁점 | 결정 | 출처 |
|---|---|---|---|
| **D1** | `\item[라벨]`의 라벨 | **모든 라벨을 지운다**(`(1)`·`-`·`$\bullet$`·`(가)`·description 용어 전부). 내용은 남긴다 | 덕수 |
| **D2** | 글머리가 사라진 항목을 줄로 가를 장치 | hard break | 권장안(덕수 무지시) |
| **D3** | 요청 2의 위치 | 정돈 새 단계 **R6**(R5 뒤·R4 앞) | 권장안 |
| **D3′** | 정돈 토글을 끄고 가져올 때 | **그래도 줄바꿈을 넣는다** | 덕수 |
| **D3″** | 시트 가져오기 대상 탭 | **문제·풀이 둘. AI풀이 탭(O·P열) 제외** | 덕수 |
| **D4** | 줄 끝이 `\tag{n}`인 줄 | 공백 두 칸이 아니라 **빈 줄(문단 나눔)** | 권장안 |
| **D5** | GAS가 만드는 `- `·`X ` | **GAS는 맨 `\item`의 `- `만 없앤다**(`\item[X]` → `X ` 유지) — GAS 레포 별도 커밋. ⚠ 실행판 초안의 "같은 정책으로"는 구현 중 뒤집혔다(§9 I3) | 덕수(2026-11-05) |
| **D6** | 편집창 정돈 버튼 | **줄바꿈 일괄 삽입**(현재 탭 전체 · ⌘Z 1회) | 덕수 |
| **D7** | 이미 가져온 문항 | **소급하지 않는다** | 덕수 |
| **N1** | `\tag` 줄의 **앞**도 빈 줄로? | **앞뒤 모두 — 번호 줄은 단독 문단** | v2 권장안(채택) |
| **N2** | 줄 끝 두 칸을 편집기에서 보이게 | 이번엔 제외 · 후속 후보로 기록 | v2 권장안(채택) |
| **N3** | description 용어 | D1대로 버린다(소실 수용) | v2 권장안(채택) |
| **N4** | 편집창 정돈의 추가 탭(AI풀이 등) | 탭 구분 없이 적용(D3″은 자동 경로 전용) | v2 권장안(채택) |

---

## 1. 실측 사실

| # | 사실 | 근거 |
|---|---|---|
| F1 | 현재 R0b 머리 규칙: 마커 라벨 → `(가) ` · 비마커 라벨 → `- (1) ` · enumerate 맨 `\item` → `1) `·`2) ` · 맨 `\item` → 내용이 마커면 `''` 아니면 `- ` | `lib/proofread.ts:687-693`(⚠ `grep -a` — 제어 문자 파일) · M10 P16·P25·P30 |
| F2 | P30의 근거("지우면 `remark-breaks` 부재로 항목이 한 문단이 된다")는 **이번에도 유효** → D2가 대신 받는다 | CLAUDE.md 「행이 분리되는 이유」 |
| F3 | 문제 탭 본문은 **E열**(B는 그림 파일명 복구 전용). E는 GAS가 B를 선택지 앞까지 자른 부분 문자열(`src.slice(0, blockStart).trim()`)이라 **B의 행나눔이 그대로** 있다. 선택지 F~J는 choices 블록 — 대상 밖 | `lib/sheetImport.ts:17-23·438-445` · GAS `parseMcqFromRaw_` |
| F4 | GAS가 이미 itemize를 벗긴다(`8ebb218`, `UNWRAP_ITEMIZE: true` — B·C·E·F~J): `\item[]` 삭제 · `\item[X]` → `X ` · 맨 `\item` → `- `. 시트 경로의 글머리는 GAS 산물 → Mathory 단독 수정은 시트 경로에 효과 없음(D5). GAS의 `[ \t]+\n` 정리는 itemize가 있는 셀에서만 돈다 | GAS `normalizeProblem.gs:212-241·333` |
| F5 | Data_DS는 지금 헤더 1행뿐 → 같은 열 구조 **Stack 5,746행**이 표본. B·C·E에 itemize **0셀** | SA 읽기 전용 프로브(2026-11-05) |
| F6 | 요청 1의 실발동처는 **편집창 정돈**(OCR·붙여 넣은 LaTeX). 편집창 OCR(`lib/ocr.ts`)은 결정적 세트만 → R0b·R6 무관 | M10 I5 |
| F7 | 규모: Stack을 현 가져오기 경로로 돌린 뒤 R6 판정을 시제품 적용 → **3,865행 · 블록 8,824 · hard break 23,640 · `\tag` 줄 15** | 시제품(부록 A) |
| F8 | hard break는 파이프라인을 지난다: `toPersistedBlock`(줄 끝 무접촉) · `stripInvisibles`(비ASCII만) · `trimBlockEdges`(앞뒤 빈 줄만) · 기준 전처리 + remark → `break` 노드 · IR `break` → `t:'br'`(`ir.ts:350`) → LaTeX `\newline` · Typst `#linebreak();` · HWPX `<hp:lineBreak/>` | 실행 확인 |
| F9 | 선례: 61c 대화 삽입이 raw_text에 hard break 두 칸을 넣는다 | `lib/chatExtract.ts:363-367·425` |
| F10 | ⚠ 줄 끝 `\tag{n}` 변환 **세 사본**이 `[ \t]*$`로 줄 끝 공백까지 먹는다: `components/editor/EditorPreview.tsx:173` · `lib/locale.ts:326` · `lib/export/prepare.ts:57`. 두 칸은 세 곳 모두에서 사라진다 → D4(빈 줄)는 세 곳 모두 안전 | 코드 확인(v2 E1) |
| F11 | `.tag-marker`는 **문단** 세로 중앙에 선다 · IR은 문단당 `\tag` 하나만 낸다(`ir.ts:244` "한 문단에 행 끝 \tag가 둘 이상 — 마지막 번호만"). → 번호 줄이 단독 문단이어야 렌더·내보내기 모두 제자리(N1). 지금은 연속한 두 `\tag` 줄이 한 문단으로 합쳐져 **내보내기에서 번호 하나가 사라지고 있다** — N1이 덤으로 고친다 | 코드 확인 |
| F12 | `stemHash`는 `rowToDraft` 안 `normalizeText(E)` 직후 확정 → 정돈·줄바꿈은 그 뒤라 중복 키 불변(정돈 끔도 같다) | `sheetImport.ts:443·536` |
| F13 | 편집창 정돈 `handleTidyBlocks`(`EditorView.tsx:1535`): 현재 탭 전체 → `stats.split·fixed·removed`가 모두 0이면 "정돈할 것이 없습니다" · 아니면 `pushUndo()` → 첫 조각은 원 id로 `setContent` · 상태 문구 `정돈: 분할 · 정형화 · 제거` | 코드 확인 |
| F14 | CommonMark(락 판 remark-parse 11.0.0 + gfm 4.0.1 + math 6.0.0): `1)`·`1.`·`-`·`*`·`+`·`>`·`#`·`$$` 펜스·표·HTML 주석은 문단을 끊는다 · `2)`·`2.`는 **못 끊는다**(`a␣␣⏎2) b` → `<p>a<br>⏎2) b</p>`) · 목록 항목 끝 hard break는 무시 | v2 실험(부록 B) |
| F15 | 줄 끝 공백을 만지는 다른 경로(`preprocess.ts:74` · `EditorView.tsx:1752` ⌘⇧L · `mathPaste.ts:216` · `chatExtract.ts:425` · `ir.ts:476`)는 전부 수식 경계·문단 끝 전용 — 줄 사이 두 칸을 지우지 않는다. `setContent`·`trimEdges`도 앞뒤 빈 줄만 | v2 V6·V7 · CLI 재확인 |
| F16 | `tests/blockTidy.test.mjs` 28건 중 stats **전체를 `deepEqual`하는 테스트는 없다**(필드별 `equal`뿐) → `lineBreaks` 필드 추가는 기존 단언을 깨지 않는다. 헬퍼 `T`(`:8`) 밖에서 `tidyBlocks`를 직접 부르는 테스트 8곳(`:18·78·83·106·131·137·189·194`) | 코드 확인 |

---

## 2. 무엇이 바뀌나

| | 지금 | 바뀐 뒤 |
|---|---|---|
| R0b enumerate 맨 `\item` | `1) a` | `a` |
| R0b itemize 맨 `\item` | `- a` | `a` |
| R0b 라벨 `\item[(1)]`·`[-]`·`[$\bullet$]`·`[(가)]` | `- (1) c` · `- - a` · `- $\bullet$ a` · `(가) b` | `c` · `a` · `a` · `b` |
| R0b 내용이 마커 `\item ㄱ. 첫째` | `ㄱ. 첫째` | 그대로 |
| R0b 항목·앞뒤 문장 경계 | 글머리가 행을 갈랐다 | 앞 줄 끝 두 칸(`\tag` 줄이면 빈 줄) |
| R6 — 편집창 정돈 · 시트 정돈 켬 | 원본 한 줄 바꿈이 렌더에서 공백으로 합쳐짐 | 문단 안 줄바꿈마다 hard break · `\tag` 줄은 단독 문단 |
| 시트 정돈 끔 | 같음 | 문제·풀이 탭에 R6과 같은 줄바꿈 |
| 시트 AI풀이 탭 | — | 줄바꿈 없음(R0b는 정돈 켬이면 지금처럼 돈다) |
| 편집창 상태 문구 | `정돈: 분할 n · 정형화 n · 제거 n` | 뒤에 ` · 줄바꿈 n`(0이면 생략) |

---

## 3. 설계

### 3-1. 판정 함수 `hardBreakKinds` — `lib/proofread.ts`

**위치**: `unwrapItemize`(proofread)와 R6(blockTidy)이 함께 쓰고 import 방향은 blockTidy → proofread 하나뿐 — blockTidy에 두면 순환이다. proofread는 이미 `scanMathRegions`·`collectCodeRanges`·`MARKER_LINE_RE`를 쓰므로 **새 import 0**. `test:proofread`·`test:tidy` 단독 tsc 그래프 불변.

```ts
export type BreakKind = 'none' | 'spaces' | 'paragraph';

/** lines[i]와 lines[i+1] 사이(i = 0..n-2)마다 필요한 줄 나눔. 순수 · 새 import 0.
 *  수식 영역은 lines.join('\n')에 scanMathRegions 한 번, 코드펜스는 한 번의 순회로 구한다(O(n)). */
export function hardBreakKinds(lines: string[]): BreakKind[]
```

경계 i의 판정 — **위에서부터 처음 맞는 것** (⚠ 순서가 규칙이다, G1):

| 순서 | 결과 | 조건 |
|---|---|---|
| ① | `none` | `lines[i]`·`lines[i+1]` 중 하나가 공백뿐 |
| ② | `none` | `lines[i]`의 행 끝 오프셋이 닫힌 수식 영역 안(`scanMathRegions`, `r.closed && !r.empty`, `from < 오프셋 < to`) |
| ③ | `none` | 코드펜스 안 또는 펜스 행 자체(```` ``` ````·`~~~`, 들여쓰기 3칸 이하, 여는 문자열 길이 이상으로 닫힘 — S1) |
| **④** | **`paragraph`** | `lines[i]` **또는** `lines[i+1]`이 **수식 밖** `\tag{n}`으로 끝남 — `/\\tag\{\d+\}[ \t]*$/`(렌더 세 사본과 같은 꼴 — `\tag*`·비숫자 라벨은 렌더도 안 바꾸므로 대상 아님) + 그 `\tag` 위치가 수식 영역 밖 (D4·N1) |
| ⑤ | `none` | `lines[i]`가 이미 `␣␣`·`\\`·`<br>`(`<br/>`)로 끝남 · `$$`로 끝남 · 제목 행(`#{1,6}[ \t]`) · 표 행(`|`로 시작) |
| ⑥ | `none` | `lines[i+1]`이 스스로 문단을 끊음(F14): `$$`·`\[`로 시작 · `#{1,6}[ \t]` · `>` · `|` · 코드펜스 · `/^[-*+][ \t]+\S/` · `/^1[.)][ \t]/` · `MARKER_LINE_RE` |
| ⑦ | `spaces` | 나머지 |

- **G1 — ④가 ⑤⑥보다 앞인 이유**: v2는 `\tag` 판정을 맨 끝에 두었다. 그러면 앞 줄이 이미 `␣␣`로 끝난 경우(사용자가 친 것 · R0b가 먼저 붙인 것) ⑤가 `none`을 내 번호 줄이 앞 줄들과 **한 문단에 남는다** — N1이 막으려던 바로 그 상태. ④를 앞에 두면 남은 `␣␣`는 문단 끝이라 무시되고 빈 줄이 문단을 가른다. ⑥보다 앞이어도 무해하다: 다음 줄이 표·제목·목록이면 빈 줄은 원래 있었어야 할 자리이고(GFM 표는 빈 줄이 없으면 뒤 평문을 행으로 흡수한다), 마커 줄은 렌더가 어차피 빈 줄을 넣는다. ①②③은 여전히 ④보다 앞이다(코드·수식 안은 무접촉).
- `2)`·`3.` 줄은 ⑥에 넣지 않는다 — 문단을 못 끊으므로 `spaces`가 필요하고 목록 안에서는 무해(F14).
- 수식 영역 판정에 편집창 스캐너 `lib/mathRegions`를 쓴다. 렌더와 어긋날 때의 비용은 비대칭(수식 안 오판 = KaTeX가 무시하는 공백 · 밖을 안으로 오판 = 오늘처럼 합쳐짐)이고 blockTidy R1이 이미 같은 스캐너를 쓴다. CLAUDE.md의 "`mathRegions` 금지"는 내보내기 IR 규약이다.

### 3-2. 적용 헬퍼 (G3)

판정 결과를 줄 배열에 적용하는 것도 한 벌로 둔다 — R0b(표시 자리만)와 R6(전 경계)이 같은 함수를 쓴다.

```ts
/** kinds를 적용한 새 텍스트. only가 주어지면 그 경계(i)만. 반환 count = 바꾼 경계 수 */
export function applyBreakKinds(lines: string[], kinds: BreakKind[], only?: Set<number>): { text: string; count: number } {
  const out: string[] = [];
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const k = i < kinds.length && (!only || only.has(i)) ? kinds[i] : 'none';
    if (k === 'spaces') { out.push(lines[i].replace(/[ \t]+$/, '') + '  '); count++; }
    else if (k === 'paragraph') { out.push(lines[i], ''); count++; }
    else out.push(lines[i]);
  }
  return { text: out.join('\n'), count };
}
```

- **G3**: v2 의사코드는 `out`을 제자리에서 고쳐 `'paragraph'`의 빈 줄 삽입이 뒤 인덱스를 민다. **새 배열을 앞에서부터 만든다** — 판정(`kinds`)은 적용 전 배열 기준이고 적용은 한 번이라 밀림이 없다.
- `'paragraph'`의 앞 줄 끝 공백은 그대로 둔다(문단 끝이라 무시되고, 빈 줄을 만든 뒤 두 번째 실행에서 ①로 걸려 멱등).

### 3-3. 요청 1 — `unwrapItemize` 개정 (`lib/proofread.ts:638-700`)

① 줄 가르기 단계(`:645-662`): **무변경**.
② 줄 단위 단계(`:664-699`)를 다음으로 교체한다. 환경 스택·enumerate 셈은 소비처가 없어 지운다.

```ts
const skip = [...collectMathRanges(src), ...collectCodeRanges(src)];
const inSkip = (pos: number) => skip.some(([s, e]) => pos >= s && pos < e);
const out: string[] = [];
const cuts = new Set<number>();           // "out[k] 앞에서 토큰을 지웠다" — 경계 k-1에 줄 나눔을 붙인다
let count = 0;
let offset = 0;
for (const line of src.split('\n')) {
  const at = offset + (line.length - line.trimStart().length);
  offset += line.length + 1;
  if (inSkip(at)) { out.push(line); continue; }                       // G2 — 수식·코드 안 줄은 무접촉(현행 유지)
  if (ENV_LINE_RE.test(line)) { cuts.add(out.length); count++; continue; }   // E3 — 환경 줄 삭제 자리도 표시
  const item = line.match(ITEM_HEAD_RE);
  if (!item) { out.push(line); continue; }
  count++;
  cuts.add(out.length);
  const rest = line.slice(item[0].length);                            // D1 — 라벨은 무엇이든 버린다
  if (!rest.trim()) continue;                                         // 내용 없는 \item 줄은 버린다(현행)
  out.push(rest);
}
const kinds = hardBreakKinds(out);
const marks = new Set([...cuts].filter((k) => k > 0 && k < out.length).map((k) => k - 1));
const { text: fixed } = applyBreakKinds(out, kinds, marks);
return { fixed, count: fixed === text ? 0 : count };
```

- **G2**: v2 의사코드는 `inSkip` 가드를 빠뜨렸다 — 그대로 넣으면 수식 안 `\text{\item}`·코드펜스 안 `\begin{itemize}` 줄이 지워진다(현행 테스트 `:173` "수식·코드 안은 무접촉"이 깨진다).
- 표시 자리에서만 붙이므로 R0b는 항목·앞뒤 문장 경계에만 손대고 일반 줄바꿈은 R6의 몫이다. R6을 끈 경로(시트 AI풀이 탭)에서도 항목이 한 문단으로 합쳐지지 않는다(P30의 근거 유지).
- `ITEM_HEAD_RE`의 라벨 캡처 그룹은 쓰지 않지만 정규식은 그대로 둔다(머리 길이 계산). `MARKER_LINE_RE`는 이제 R0b가 아니라 `hardBreakKinds` ⑥이 쓴다.
- 예: `다음 조건을 만족시킨다.\n\begin{itemize}\n\item[(가)] a\n\item b\n\end{itemize}\n그러므로` → `다음 조건을 만족시킨다.␣␣\na␣␣\nb␣␣\n그러므로`
- 주석 블록(`:624-637`)을 새 정책으로 다시 쓴다(P16 라벨 보존·P25 `1) `·P30 `- ` 폐지 · 줄 나눔은 `hardBreakKinds` · "결정적 세트에 넣지 말 것" 경고는 유지).

### 3-4. 요청 2 — R6 `preserveSourceLineBreaks` (`lib/blockTidy.ts`)

```ts
import { autoFixDeterministicIssues, unwrapSectionCommands, unwrapItemize, hardBreakKinds, applyBreakKinds } from './proofread';

/** R6 대상 — text 계열 + 경우. heading·choices·image·svg·ggb·gana·roman·list는 대상 밖 */
const R6_TYPES = new Set(['text', 'callout', 'coach_important', 'coach_caution', 'box', 'case', 'subcase']);

/** 한 블록의 원본 줄바꿈을 hard break로. 멱등. 편집창 정돈·시트 가져오기(정돈 켬/끔) 공용 */
export function preserveSourceLineBreaks(text: string, type: string): { fixed: string; count: number } {
  if (!R6_TYPES.has(type) || !text.includes('\n')) return { fixed: text, count: 0 };
  const lines = text.split('\n');
  const kinds = hardBreakKinds(lines);
  // E4 — case·subcase의 제목 행(첫 줄)과 본문 사이 경계는 건드리지 않는다(injectCaseLabel이 빈 줄을 보장한다).
  //   이어짓기 case의 빈 첫 줄은 ①로 이미 none
  if ((type === 'case' || type === 'subcase') && kinds.length) kinds[0] = 'none';
  const r = applyBreakKinds(lines, kinds);
  return { fixed: r.text, count: r.count };
}

export interface TidyStats { split: number; fixed: number; removed: number; tagConflict: number; /** R6 */ lineBreaks: number }
export interface TidyOptions { tab: 'question' | 'solution' | 'extra'; autoFix?: boolean; /** R6 — 기본 켬. 시트 AI풀이 탭만 false(D3″) */ lineBreaks?: boolean }
```

`tidyBlocks` 변경:
- stats 리터럴에 `lineBreaks: 0`(E5).
- 끝 루프 `if (SPLITTABLE.has(o.type)) { R5 … ; R4 }` 안, **R5 뒤·R4 앞**에:
  ```ts
  if (opts.lineBreaks !== false) { const r6 = preserveSourceLineBreaks(o.raw_text, o.type); o.raw_text = r6.fixed; stats.lineBreaks += r6.count; }
  ```
  (`R6_TYPES` ⊂ `SPLITTABLE`.)
- 머리 주석의 규칙 순서에 R0b·R6 줄을 넣는다: `… R5 → R6 원본 줄바꿈(hardBreakKinds — 렌더에 remark-breaks가 없어 한 줄 바꿈이 공백으로 합쳐진다) → R4`.
- 위치가 정돈 맨 끝인 이유: R1 분할이 끝난 블록마다 · R3 결정적 세트·R5가 원래 줄 끝을 본다 · R4는 앞뒤 빈 줄만 지운다.
- **멱등**: `spaces`는 ⑤로, `paragraph`는 ①로 두 번째 실행에서 걸린다. R0b가 붙인 두 칸도 ⑤로 걸린다(S4).

### 3-5. 호출부

| 호출부 | 변경 |
|---|---|
| **편집창 정돈** `EditorView.handleTidyBlocks`(`:1535`) | 옵션 무변경(R6 기본 켬 — D6·N4). "정돈할 것이 없습니다" 조건에 `&& !stats.lineBreaks` · 상태 문구 끝에 `+ (stats.lineBreaks ? \` · 줄바꿈 ${stats.lineBreaks}\` : '')`(`tagConflict` 안내 **앞**) |
| **시트 정돈 켬** `SheetImportModal.tidyDrafts`(`:103`) | `tidyBlocks(…, { tab, lineBreaks: tabId === 'question' \|\| tabId === 'solution' })` · `count`에 `+ stats.lineBreaks`(배지 '정돈 n'에 합산 — S7) |
| **시트 정돈 끔** `SheetImportModal`(`:386` `if (tidy) {…}`) | `else` 갈래 신설: `if (tabId === 'question' \|\| tabId === 'solution')` 블록마다 `b.type === 'image' ? b : { ...b, raw_text: preserveSourceLineBreaks(b.raw_text, b.type).fixed }`. 자리는 `stripInvisibles` 뒤 · `persisted` 생성 앞(정돈 켬과 같은 자리) · 배지 없음. ⚠ image 드래프트의 `figName`을 잃지 않게 그대로 통과 |

정돈 끔일 때는 R1 분할·R3이 없어 블록이 `text`뿐이고 `\begin{tabular}` 등도 그대로다 — tabular 행은 `\\`로 끝나 ⑤로 걸러진다.

### 3-6. GAS (D5 — 별도 레포 커밋)

`normalizeProblem.gs` `unwrapItemize_`(origin/main `:221-235`): `\item[X]` → `''` · 맨 `\item` → `''` · 항목은 자기 줄에서 시작(줄 가르기 유지). GAS에서는 hard break를 넣지 않는다 — 줄 구분은 Mathory R6이 받는다(정돈 켬·끔 모두). 두 변경이 짝이다. 이미 처리돼 Stack에 들어간 행은 바뀌지 않는다. ⚠ 로컬 GAS 사본은 origin보다 19커밋 뒤 — `git pull` 뒤 작업.

### 3-7. 바뀌지 않는 것

결정적 세트(`autoFixDeterministicIssues`)·OCR(`test:proofread` P-2 무변경 통과) · 렌더 전처리 2벌·`insertMarkerLineBreaks`·`convertTextTags` 3사본 · 내보내기 IR·직렬화기 · `stemHash`·중복 판정 · 미리보기 = 저장(persisted 확정 전에 들어간다).

---

## 4. 알고 두는 손실

- 라벨 자리에 온 인쇄 마커(`\item[(가)]`)와 description 용어가 사라진다(D1·N3). 내용 앞 마커는 남는다.
- 편집창 정돈이 기존 문항의 렌더를 바꿀 수 있다(D6) — 일부러 두 줄로 나눠 쓴 한 문장도 줄바꿈이 된다. 누른 탭·순간에만, ⌘Z 1회로 원복. 소급 없음(D7).
- 줄 끝 두 칸은 편집기에서 안 보이고, 지우면 그 줄이 합쳐진다(다시 정돈하면 다시 붙는다). 보이게 하는 장식은 후속 후보(N2).
- 원본 줄바꿈이 PDF 줄 넘김이었던 곳도 hard break가 된다(R-3에서 실물 확인).
- GAS 변경 전 처리된 행의 `- `·라벨은 남는다.
- R0b 항목 줄은 목록이 아니라 문단 안 줄 → 내보내기에서 HWPX `ol`·Typst `enum`이 아닌 줄바꿈.
- `\tag` 줄이 단독 문단이 되어 그 앞뒤 문단 간격이 생긴다(N1 — 15곳 규모).

---

## 5. 커밋 · 테스트

### 5-1. 테스트 원칙

- 헬퍼 `T`(`tests/blockTidy.test.mjs:8`)에 `lineBreaks: false`를 넣어 기존 회귀를 보호한다(S5). R6 신규 테스트는 헬퍼 `T6`(옵션 없음 = 기본 켬).
- 헬퍼 밖 직접 호출 8곳(F16)은 **옵션을 바꾸지 않고 먼저 돌린다**. 입력이 전부 한 줄이거나 분할 뒤 한 줄이라 R6이 손대지 않을 것으로 본다 — 깨지면 기대값을 고치지 말고 그 테스트가 여러 줄 text를 다루는지 확인해 `lineBreaks: false`를 명시한다(G5).
- R0b 6건(`:156-186`)은 기대값 갱신(정책 변경 그 자체).

### 5-2. 커밋

| 커밋 | 내용 | 테스트 |
|---|---|---|
| **S1** `tidy: itemize 라벨·번호·글머리 폐지 — 항목 경계는 hard break (R0b)` | `proofread.hardBreakKinds` · `applyBreakKinds` · `unwrapItemize` ② 교체 · 주석 | R0b 6건 갱신 + 신규: 라벨 4종(`(1)`·`-`·`$\bullet$`·`(가)`) 삭제 · description 용어 삭제(N3) · 내용 마커 보존 · enumerate 번호 없음 · 앞 문장↔첫 항목·마지막 항목↔뒤 문장 hard break(E3) · 항목 다음 `\tag` 줄 → 빈 줄(N1) · 앞 줄이 이미 `␣␣`이어도 `\tag` 줄은 빈 줄(G1) · 수식·코드 안 줄 무접촉(G2) · 멱등. `test:proofread` P-2 무변경. `hardBreakKinds` 단위: 부록 B 표 행마다 1건 · `2)` → spaces · `1)` → none · 수식 안 행 끝 → none · 코드펜스 안 → none |
| **S2** `tidy: 원본 줄바꿈을 hard break로 (R6) · 시트 가져오기·편집창 정돈` | R6 · `TidyStats/Options.lineBreaks` · 호출부 셋(§3-5) | `T6`: 일반 두 줄 · `$$` 펜스 앞뒤 무삽입 · 수식 안 줄 · 표 · 제목 행 · 마커 줄 · `- `·`1)` 무삽입 / `2)` 삽입 · `\\` 줄 끝 · `\tag` 줄 앞뒤 빈 줄 · case 제목↔본문 무삽입·본문 줄 사이 삽입·이어짓기 빈 첫 줄 보존(E4) · choices·list·gana·heading 무접촉 · R0b 출력 → R6 이중 두 칸 없음(S4) · 두 번째 정돈 `stats.lineBreaks === 0` · `lineBreaks:false`면 R6 무발동. `test:sheet` 무변경(`stemHash`) |
| **S3** `docs: 정돈 R0b 개정·R6 — CLAUDE.md · roadmap · 실행판 등록` | CLAUDE.md M10 I절 「정돈 R0b」 개정 · 「행이 분리되는 이유는 `insertMarkerLineBreaks`뿐이다」에 "+ raw_text의 hard break(정돈 R6 · 61c 선택 삽입)" · M9 I절 「정돈 규칙 순서」를 `R0 → R0b → R1 → R2 → R3 → R5 → R6 → R4`로 · roadmap · 이 실행판을 `docs/phasedocs/`로(작업 규칙 7) | — |
| (GAS) | D5 | GAS 레포 별도 커밋(덕수 push) |

그 밖: `tsc --noEmit` · 전체 단위 테스트 · `npm run build`(dev 끄고 → build → dev 재시작, 작업 규칙 5) · 시제품 프로브를 구현 함수(`preserveSourceLineBreaks`)로 다시 돌려 F7과 대조(N1로 `\tag` 15곳은 빈 줄로 바뀌어 hard break 수가 소폭 준다).

---

## 6. 실물 검수 (덕수)

| # | 무엇을 하고 | 무엇을 보라 |
|---|---|---|
| R-1 | 편집창에 `다음 중 옳은 것은?\n\begin{enumerate}\n\item ㄱ. a\n\item 두 번째\n\end{enumerate}` → 정돈 | 번호·글머리 없이 각자 줄(미리보기 포함) |
| R-2 | `\begin{itemize}\n\item[(1)] a\n\item[$\bullet$] b\n\item[(가)] c\n\end{itemize}` 와 `\begin{description}\n\item[용어] 정의\n\end{description}` 정돈 | `a`/`b`/`c` 각자 줄 · `정의`만 남음(N3) |
| R-3 | 시트 가져오기(정돈 켬)로 여러 줄 해설 행 | 문제·풀이가 시트 원본의 줄 구성과 같다 · `$$` 앞뒤·선택지·표는 지금과 같다 · AI풀이 탭 불변 · 배지 '정돈 n'이 커진다 |
| R-4 | 같은 행을 정돈 끄고 | 문제·풀이 줄 구성이 R-3과 같다(분할·정형화만 없다) |
| R-5 | R-3 문항 → 내보내기 HWPX·PDF | 같은 줄바꿈 |
| R-6 | 한 줄 바꿈이 있는 기존 문항에서 정돈 → ⌘Z → 정돈 → 정돈 | 상태 문구 "· 줄바꿈 n" · ⌘Z 1회 원복 · 두 번째 정돈은 "정돈할 것이 없습니다" |
| R-7 | 본문 두 줄 + `\tag{1}`로 끝나는 줄 + 본문 한 줄을 정돈 | 번호가 그 줄 옆에 선다 · 앞뒤 문단과 분리 · HWPX에서도 번호가 그 줄에 |

---

## 부록 A. 시제품 (F7)

로컬 프로브(scratchpad · 커밋하지 않음): Stack 5,746행 → `rowToDraft` → 그림 블록 제외 → `tidyBlocks({autoFix:true})` → choices 제외 블록마다 판정(당시 `\tag` 갈래 없이).
`{ rows: 5746, rowsChanged: 3865, blocks: 42015, blocksChanged: 8824, hardBreaks: 23640, tagLineEnds: 15, mathOnlyLines: 1220 }`.
`mathOnlyLines` 1,220은 `$…$`만 있는 줄 — `MATH_ONLY_LINE_RE`(`locale.ts:80`)가 `[ \t]*$`라 줄 끝 두 칸이 있어도 수식 전용 줄로 읽혀 렌더의 빈 줄 삽입이 계속 걸린다(무해).

## 부록 B. CommonMark 실험 (v2 V2 — 락 버전)

remark-parse 11.0.0 · remark-gfm 4.0.1 · remark-math 6.0.0 · unified 11.0.5 · remark-rehype 11.1.2 · rehype-raw 7.0.0.

| 입력(prev␣␣⏎next) | 문단 끊김 | 결과 |
|---|---|---|
| `a␣␣⏎1) b` · `1. b` | 끊음 | 목록 시작 — hard break 무해 |
| `a␣␣⏎2) b` · `2. b` | **못 끊음** | `<p>a<br>⏎2) b</p>` — `spaces` 필요 |
| `a⏎- b` · `* b` · `+ b` | 끊음 | 글머리 목록(빈 `-`는 못 끊음 — `\S` 조건) |
| `a⏎> b` · `# b` · `$$` 펜스 · 표 · `<!-- -->` | 끊음 | — |
| 목록 항목 끝 `x␣␣` | — | 항목 문단 끝 hard break는 무시 |
| `---`/`===` 직후 | setext 위험은 hard break와 무관 | `preventSetextHeadings`가 계속 방어 |

## 부록 C. 판본 정정 기록

**v1 → v2 (web)**: E1 `\tag` 공백을 먹는 사본은 셋(`prepare.ts:57`) · E2 쌍 단위 판정 → 텍스트 단위 `hardBreakKinds` · E3 환경 줄 삭제 자리도 표시 · E4 case 제목 행 문장 명확화 · E5 `lineBreaks: 0` 초기값·호출부 두 곳 · E6 GAS 공백 정리는 itemize 셀에서만 · 보완 S1~S9 · 추가 결정 N1~N4. 검증 V1~V7 전부 통과(V5는 시그니처 정정 조건).

**v2 → v3 (CLI 교차검토)**:

| # | v2 | v3 | 근거 |
|---|---|---|---|
| **G1** | `\tag` 판정(`paragraph`)이 `none` 규칙들 **뒤** | ①②③ 다음·⑤⑥ **앞**(§3-1 ④) | 앞 줄이 이미 `␣␣`로 끝나면 v2 순서는 `none`을 내 번호 줄이 앞 문단에 남는다 — N1이 막으려던 상태 |
| **G2** | R0b 의사코드에 `inSkip` 가드 없음 | 현행 가드 유지(§3-3) | 빠지면 수식·코드 안 `\item`·환경 줄이 지워진다 — 현행 테스트 `:173`이 깨진다 |
| **G3** | `apply(out, k-1, kind)` 제자리 수정 | `applyBreakKinds` — 새 배열을 앞에서부터(§3-2) | `paragraph` 빈 줄 삽입이 뒤 인덱스를 민다 |
| **G4** | E5 "stats 전체 `deepEqual`이 있으면 깨진다" | 없음을 확인(F16) — 필드 추가만 | `tests/blockTidy.test.mjs` 실측 |
| **G5** | S5 "헬퍼 기본값 `lineBreaks:false`" | + 헬퍼 밖 직접 호출 8곳의 처리 원칙(§5-1) | 헬퍼를 거치지 않는 테스트가 8곳 |
| **G6** | N1 근거 = `.tag-marker` 문단 중앙 | + IR 문단당 `\tag` 하나(`ir.ts:244`) — 지금은 연속 `\tag` 줄의 번호가 내보내기에서 사라지고 있고 N1이 덤으로 고친다(F11) | 코드 확인 |

## 부록 D. 뒤집는 정책

M10 **P16**(라벨 보존 — 폐지, 환경 3종은 유지) · **P25**(enumerate `1) ` — 폐지) · **P30**(맨 `\item` → `- ` — 폐지, 근거는 D2 hard break가 받음) · M10 범위 밖 목록의 "`\item` → 마크다운 `- ` 변환"은 반대 방향(글머리를 만들지 않음)으로 확정. CLAUDE.md 「행이 분리되는 이유는 `insertMarkerLineBreaks`뿐이다」는 "+ raw_text의 hard break"로 개정(S3).


---

## 9. 구현 기록 (2026-11-05)

### 9-1. 커밋

| 레포 | 커밋 | 내용 |
|---|---|---|
| mathory | `2d4f9ca` | R0b 개정 · `hardBreakKinds`·`applyBreakKinds`(proofread) · R6 `preserveSourceLineBreaks`(blockTidy) · 호출부 셋 · `test:tidy` 28 → 38 |
| mathory | (이 문서 커밋) | CLAUDE.md(파일 구조 · R0b 절 개정 · R6 절 신설 · 정돈 규칙 순서 · 행 분리 절 · 현재 Phase) · roadmap · 이 확정본 |
| gas-project-audition | `9705cc3` | `unwrapItemize_` 맨 `\item` → 삭제(`- ` 폐지) · 주석. **push·clasp 배포는 덕수** |

### 9-2. 실행판 대비 이탈·보완

| # | 실행판 | 구현 | 이유 |
|---|---|---|---|
| **I1** | S1(R0b)·S2(R6) 두 커밋 | **한 커밋**(`2d4f9ca`) | R0b 테스트가 S2의 `lineBreaks` 옵션을 쓰는 헬퍼 `T`에 기댄다 — S1만 떼면 그 커밋에서 테스트가 깨진다 |
| **I2** | `hardBreakKinds` ② = 스캐너의 닫힌 수식 영역 | **+ `$$` 홀짝**(`ddOpen`) | 기존 표본 `$$\begin{aligned}\na\\b\n\end{aligned}$$`에서 R6이 display **안**에 두 칸을 넣었다(첫 테스트 실행이 잡음). 편집창 스캐너는 여는 `$$`와 내용이 같은 줄이면 빈 인라인 쌍으로 읽는다(CLAUDE.md R10). KaTeX가 공백을 무시해 렌더는 무해했지만 원문 오염이라 막았다. 코드펜스 안 줄은 홀짝 셈에서 뺀다 |
| **I3** | D5 GAS = Mathory와 같은 정책(라벨 전부 삭제) | **맨 `\item`의 `- `만 삭제 · `\item[X]` → `X ` 유지**(덕수 확정) | GAS는 `unwrapItemize_` 결과를 곧바로 `ds_expectedType_`(첫머리 인쇄 번호 `7.`)와 `parseMcqFromRaw_`(선지 마커 `(1)`~`(5)`·①~⑤)에 넣는다(`normalizeProblem.gs:241`). 라벨을 지우면 선지가 라벨로 온 행의 E·F~J 추출이 실패한다. 실측으로 규모를 잴 수 없었다 — **모든 시트(Data_Latex 원출력 포함)에 `\item` 0건**(2026-11-05) |
| **I4** | 헬퍼 밖 직접 호출 8곳 — 깨지면 판정 | **8곳 모두 R6 기본 켬 그대로 통과** | 입력이 한 줄이거나 분할 뒤 한 줄 |

### 9-3. 검증

- 단위 테스트 39종 전부 통과(`test:rules` 제외 — 무관) · `test:tidy` **38**(R0b 8 · R6 7 · `hardBreakKinds` 단위 1 포함) · `test:proofread` 50(P-2 무변경) · `test:sheet` 73(`stemHash` 무변경)
- `tsc --noEmit` 무오류 · `npm run build` 통과(`[icons:check] OK — 64종`) — dev 종료 → build → dev 재시작
- **Stack 실측**(구현 함수로 재계수): `{ rows: 5746, rowsChanged: 3863, lineBreaks: 23628, tagParagraphs: 35, tidyOffLineBreaks: 26672, nonIdempotentTabs: 0 }` — 시제품 23,640과의 차이 12는 I2(`$$` 홀짝)의 몫 · 정돈 끔 경로는 분할·정형화가 없어 경계가 더 많다 · **두 번째 정돈에서 바뀌는 탭 0**(멱등)
- GAS: `unwrapItemize_`를 Node에서 직접 실행 — `\item 첫째⏎\item 둘째` → `첫째⏎둘째` · 한 줄 출력 → 줄 가름 유지 · `\item[(1)] 3` → `(1) 3`

### 9-4. 남은 일

- 덕수: GAS push + clasp 배포 · Mathory push(작업 규칙 3) → 배포 뒤 Cmd+Shift+R
- 실물 검수 §6 R-1~R-7
- 끝나면 작업물(v1 · v2 `tidy-itemize-linebreaks-v2.md` · v3 사본)을 `docs/phaseSketch/_archive/정돈 소폭 개선/`으로
