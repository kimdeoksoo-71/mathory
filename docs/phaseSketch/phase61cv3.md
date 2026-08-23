# Phase 61c 구현 계획서 — 대화 → 편집창 삽입 (v3 최종)

> 대상: CLI Claude (구현) · 상위 문서: `Phase61 시트 연동·정밀 검증 기획서 v2.md`의 **C축**
> 계보: v1(web, 2026-08-23) → v2 확정판(CLI 실측 + 덕수 확정 5건) → **v3(web 재검증·판정, 2026-08-23) 최종**
> 진실 원천: mathory **origin/main `4ad2207`** · rehype-katex는 npm 레지스트리의 **7.0.1 tarball 원문**으로 교차 확인
> 구현 기준: **v2 §5~§6·§11을 그대로 따르되, 본 문서 §3의 수정 3건(W1~W3)을 반영한다.** 그 외 사양 변경 0.
> 착수 시 CLAUDE.md 규칙 1에 따라 현재 파일을 다시 읽을 것.

---

## 0. v3 판정 요약

**v2의 정정 C1~C18을 전 항목 재검증했고, 검증 가능한 전부가 사실로 확인되어 수용한다.** 재검증 방법은 §1 표에 항목별로 남긴다(61a 교훈 — "각자 무엇을 읽었는가"를 기록). v2가 왕복 실측으로 잡아낸 C13(`insertText` 탭스톱)·C14(`FindingRow` onClick 충돌)은 v1이 코드를 읽고도 놓친 실물 충돌이며, 이번 계보 최고 기여다. **덕수 확정 5건(v2 §11)은 전부 존중 — 재론 없음.**

v3가 더하는 것은 셋이다:

1. **W1 — `range.containsNode`는 존재하지 않는 API다** (v2 §6.5). `containsNode(node, allowPartial)`는 `Selection`의 메서드이고 `Range`에는 없다. D10′가 스냅샷을 `cloneRange()`(= Range)로 뜨므로 v2 코드 그대로면 표 직렬화가 **첫 실행에서 TypeError**로 죽는다. → §3-1의 `rangeContainsNode` 헬퍼로 교체.
2. **W2 — `.katex-error` 직렬화에서 수식 구분자가 소실된다** (v2 §6.2). tarball 실측: 에러 span의 children은 `{type:'text', value}` — `value`는 `toText(scope)`로 뽑은 **구분자 없는** 수식 소스다(`lib/index.js:80,125-127`). textContent만 내면 `$`가 사라져 재렌더 시 평문이 된다. → 부모의 `math-display` 클래스로 판정해 `$…$`/`$$…$$` 복원. 에러 경로가 실제로는 **2단**이라는 정밀화 포함(§3-2).
3. **W3 — 왕복 테스트는 DOM 어댑터를 커버하지 않는다** (v2 D14′의 한계 명시). 테스트는 hast→미니트리로 들어가고, 프로덕션은 DOM→미니트리로 들어간다 — 두 변환기가 다른 코드다. 코어(`serializeNodes`)는 왕복이 지키지만 어댑터는 못 지킨다. → 한계를 문서화하고, 어댑터 검증은 **스텝 2 덕수 실물 검수 관문**이 전담함을 명시(§3-3).

판정 1건: **D13′의 `buildMathIndex` 사본 — 수용.** v1은 `lib/mathIndex.ts` import 재사용을 제안했지만, 실측 결과 61a·61b 순수 모듈 전부(`lib/verify/parse.ts:5` 등)가 "이 파일에 import를 두지 말 것 — tsc로 단독 컴파일" 주석으로 **import 0을 명문 관례로 못 박아 두었다**. 관례를 따른다. 단 조건 둘: ① 사본 양쪽(`lib/mathIndex.ts`·`lib/chatExtract.ts`)에 **서로를 가리키는 동기화 주석**을 단다(`preventSetextHeadings` 사본 관례). ② 사본 어긋남의 피해는 D1 개수 게이트 + D1′ 요소 안전망이 폴백으로 흡수함을 근거로 남긴다 — 어긋나도 오염이 아니라 강등이다.

---

## 1. v2 정정 C1~C18 재검증 결과 (전건 수용)

| # | v3 재검증 방법 | 판정 |
|---|---|---|
| C1 (annotation 실재) | rehype-katex **7.0.1 tarball 직접 해체** — `renderToString(value, {...settings, displayMode, throwOnError:true})`에 `output` 없음 확인 | ✅ 수용 |
| C2 (스큐는 상수) | 소스 근거 정합(§2 표는 CLI 실측 — probe의 스텝 1 테스트 승격이 재실행을 대신한다) | ✅ 수용 |
| C3 (`.katex-error`는 `.katex` 클래스 없음) | tarball `lib/index.js:115-129` — `className:['katex-error']` 단독. **단 에러 경로는 2단이다** — §3-2에서 정밀화 | ✅ 수용+보강 |
| C4 (동일 길이 마스킹) | 논증 타당 — 비용 0에 from/to가 원본 오프셋으로 유효 | ✅ 수용 |
| C5 (cases 안 `\displaystyle` 주입 → 전역 제거) | `EditorPreview.tsx:201-208` 실측 — `\sum·\int·\prod·\iint·\iiint·\oint·\bigcup·\bigcap` 주입 확인 | ✅ 수용 |
| C6 (array 언랩 조건 2개) | `preprocessMath:186-199` — `hasEnvironment`면 래핑 자체를 건너뛰므로 조건 ②가 우리 래퍼를 특정. **사용자가 손으로 `array{l}\n\displaystyle`을 쓴 극단 케이스는 오언랩되지만, 재렌더 시 `preprocessMath`가 동일하게 재래핑하므로 표시 차이 0** — 수용 손실 아님(무해) | ✅ 수용+분석 보강 |
| C7 (`\tag` 앞 공백 미소비) | `EditorPreview.tsx:166-168` — `/\\tag\{(\d+)\}\s*$/`의 `\s*`는 **뒤**만 소비. 앞 공백은 텍스트 노드로 잔존 | ✅ 수용 |
| C8 (마커 뒤 공백 흡수) | `lib/locale.ts:56·59·64` — 세 정규식 모두 `[ \t]*` 말미 확인, 치환문은 미복원 | ✅ 수용 |
| C9 (`br` 뒤 `"\n"` 텍스트 노드 동반) | mdast-util-to-hast의 `break` 핸들러 표준 동작과 정합(CLI 왕복 실측 신뢰) | ✅ 수용 |
| C10 (검증 카드는 전부 div) | `VerifyReportCard.tsx` 전문 — `<p>` 0건 확인 | ✅ 수용 |
| C11 (카드는 `.comment-body` 안 / 게이트 스코프 = `.preview-content`) | `CommentPanel.tsx:1683-1691` 구조 실측 | ✅ 수용 |
| C12 (ProblemView도 `onRunVerify`·`onJumpToBlock` 전달 — JSDoc stale) | `ProblemView.tsx:990-1005` 실측 — `onRunVerify`·`verifyCharCount` 전달, `onJumpToBlock`은 오너 조건부 전달. **v1의 "61b D12 선례" 인용이 낡은 계획서 기준이었다** — 구현이 계획과 갈라진 지점을 v2가 잡았다 | ✅ 수용 |
| C13 (`insertText` `{}` 탭스톱) | `MarkdownEditor.tsx:326-345` — `braceCount>=2` 탭스톱 무장 + 첫 `{}` 커서 점프 확인 | ✅ 수용 (→ D12′) |
| C14 (`FindingRow` 행 전체 onClick) | `VerifyReportCard.tsx:206-221` + ProblemView도 `onJumpToBlock` 전달(C12) — **편집창·열람뷰 모두**에서 카드 드래그가 점프와 충돌 | ✅ 수용 (→ D11′) |
| C15 (팝오버 토큰 `--border-primary`) | `CommentPanel.tsx:1336-1343` 실측 — `border-primary`·`bg-card`·radius 6·`0 4px 16px` 그림자·11.5px | ✅ 수용 |
| C16 (미디어 블록도 ref 없음 / 문구 선례) | `EditorView.tsx:912-935` — `!block.collapsed` 게이트 안에서 image·svg·ggb는 `MediaBlockContent`(ref 미등록) 확인. alert 선례 `:2158-2161` | ✅ 수용 |
| C17 (복원 불가 손실 3종) | `preprocessLocale` 해당 행 확인 — "무손실"은 **수식에 한정**해 쓴다 | ✅ 수용 |
| C18 (라인 정정) | 표본 재확인: 패널 루트 777-787 ✓ · `messagesScrollRef` 선언 138 ✓ · verify 판정 1560 ✓ · 소스식 1685 ✓ · `.comment-body` 1683 ✓ · `CommentItem` 1529 ✓ · ProblemView 마운트 990 ✓ | ✅ 수용 |

**devDependencies 검증**: `package-lock.json` 실측 — unified **11.0.5** · remark-parse **11.0.0** · remark-rehype **11.1.2** 설치 확인. v2 §6.4의 버전 명시와 정확히 일치, 신규 설치 0 주장 사실.

---

## 2. v3 수정 3건 (구현 반영 필수)

### 3-1. W1 — 표 전체 포함 판정 (v2 §6.5 교체)

`Range`에는 `containsNode`가 없다. 스냅샷(Range)으로 판정하려면:

```ts
/* SelectionInsertPopup.tsx — 어댑터 헬퍼 */
function rangeContainsNode(range: Range, node: Node): boolean {
  const r = (node.ownerDocument ?? document).createRange();
  r.selectNode(node);   // 표는 항상 부모가 있어 throw하지 않는다
  return range.compareBoundaryPoints(Range.START_TO_START, r) <= 0
      && range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
}
```

`Selection.containsNode(tbl, false)`를 팝업 표시 시점(스냅샷 뜰 때)에 미리 계산해 두는 방식도 무방 — 어느 쪽이든 **스냅샷 이후 Selection이 변해도 결과가 흔들리지 않게** 스냅샷 시점에 확정할 것. 나머지 표 직렬화 사양(§6.5)은 그대로.

### 3-2. W2 — `.katex-error` 직렬화 + 에러 경로 정밀화 (v2 §6.2 한 행 교체)

rehype-katex 7.0.1의 실제 에러 경로는 2단이다(tarball `lib/index.js:86-129`):
① `throwOnError:true`로 시도 → 실패 시 ② `strict:'ignore', throwOnError:false`로 **재시도** — 여기서 KaTeX가 자체 에러 span을 반환하거나 (strict성 경고였다면) **정상 `.katex`로 렌더될 수도** 있다 → ③ 그래도 throw면 rehype-katex가 `katex-error` span을 직접 만든다. ②·③ 어느 쪽이든 최종 에러 마크업은 `.katex` 클래스가 없는 `<span class="katex-error">`이고(게이트 규칙 C3 유효), **children은 구분자 없는 수식 소스 텍스트**다.

규칙표 해당 행 교체:

| DOM | 출력 |
|---|---|
| `.katex-error` | textContent를 **수식 구분자로 감싼다**: `el.closest('.math-display')`(rehype-katex 경로의 부모 클래스)면 `$$…$$`, 아니면 `$…$`. 검증 카드(`renderInlineMathHtml` 경로)의 에러 span은 항상 인라인 → `$…$` |

(카드 쪽도 실측 근거: `renderKatexCached`는 `throwOnError:false`라 파싱 실패 시 KaTeX 자체 에러 span **문자열이 비어 있지 않게** 반환되어 그대로 innerHTML로 들어간다 — `lib/katex-render.ts:16`. 따라서 카드에도 `.katex-error`가 나타날 수 있다.)

### 3-3. W3 — 왕복 테스트의 커버리지 한계 명시 (v2 D14′ 보강)

왕복 테스트의 입구는 **hast→미니트리 변환기(테스트 전용)**이고, 프로덕션 입구는 **DOM→미니트리 어댑터(Range 절단 포함)**다. 왕복이 지키는 것은 `serializeNodes` 코어와 규칙표뿐이며, **어댑터의 회귀(절단 오프셋·closest 판정·스킵 규칙)는 테스트가 못 잡는다.** 대응:

- 테스트용 hast→미니트리 변환기는 어댑터와 **필드 채움 규칙을 문서 주석으로 상호 참조**한다(두 변환기가 조용히 갈라지는 것 방지).
- 어댑터의 실물 검증은 **스텝 2 관문(덕수 실물 검수)**이 전담한다 — 검수 시나리오에 "선택 경계가 텍스트 중간·수식 중간·표 중간에 걸리는" 절단 케이스를 반드시 포함할 것(§9 T3·T12가 그 자리다).

---

## 3. 결정 최종표 (v1 D1~D10 · v2 개정 · v3 판정)

| # | 결정 | v3 판정 |
|---|---|---|
| D1 | 이중 복원 + 댓글 단위 게이트(`.preview-content` 스코프, `.katex-error` 1건이면 폴백) | 유지 |
| D1′ | 요소 단위 안전망(`data-math-id` 없으면 그 요소만 폴백) | 유지 |
| D2 | `data-comment-id` 스탬프 + `verify ? extractVerifyReport(content).body : content` 소스식. 카드 안 수식은 항상 ② 경로 | 유지 |
| D3·11-2 | 팝업 상시 마운트, `[편집창에 삽입]`만 `onInsertToEditor` 게이트. 선례 인용 = `onInsertGraphBlock` | 유지 (덕수 확정) |
| D4 | 단일 `.comment-body` 제한 | 유지 |
| D5 | 삽입 대상 = `activeBlockId`, ref 없으면 "텍스트 블록을 먼저 선택하세요" | 유지 |
| D6 | 수식 경계 확장(`closest('.katex')`) | 유지 |
| D7 | 구분자 정규화만, `$$` 빈 줄 정규화 금지(61a Y1) | 유지 |
| D8 | 직렬화 규칙표 = v2 §6.2 **+ W2 행 교체** | 수정 반영 |
| D9 | `selection.toString()` 금지 (1차 근거 = 마크다운 복원) | 유지 |
| D10·D10′ | mousedown preventDefault + Range 스냅샷 | 유지 |
| D11′ | `FindingRow` 선택 가드 3줄. (참고: "다른 곳의 선택이 남아 클릭이 오차단되는" 엣지는 클릭의 mousedown이 선택을 먼저 접으므로 실사용에서 자연 해소 — 가드 단순형 유지) | 유지+분석 |
| D12′·11-1 | `insertPlainText` 신설, `insertText`는 툴바 전용 존치. (선택 보강: changes와 selection을 **한 dispatch**로 합쳐도 된다 — CM이 selection을 변경 후 좌표로 적용하므로 중간 렌더 1회가 준다. 두 dispatch도 `insertText` 선례 그대로라 무방 — 구현 재량) | 유지 (덕수 확정) |
| D13′ | 코어 = 미니트리, `chatExtract.ts` import 0 + `buildMathIndex` 사본 | **수용** — §0 판정(양방향 동기화 주석 의무) |
| D14′·11-3 | 실 파이프라인 왕복 테스트 + devDep 3종 명시(버전 실측 일치) | 유지 + **W3 한계 명시** |
| 11-4 | 표 GFM 복원(전체 포함 시) | 유지 + **W1 판정 코드 교체** |
| 11-5 | [복사] = 마크다운 1종 | 유지 (덕수 확정) |

---

## 4. 작업 순서 (v2 §8 확정, 변경 없음)

| 스텝 | 내용 | 완료 기준 |
|---|---|---|
| 1 | `lib/chatExtract.ts`(+`buildMathIndex` 사본·양방향 주석) + probe 승격 왕복 테스트 + `npm run test:extract` | v2 §2 표본 17종 + 규칙표 왕복 + **W2 katex-error 구분자 케이스** 통과 |
| 2 | 팝업 + DOM→미니트리 어댑터 — [복사] 먼저 | **덕수 실물 검수 관문** — W3의 절단 케이스 포함 |
| 3 | `insertPlainText` + `onInsertToEditor` 배선 + [편집창에 삽입] | 삽입·dirty·undo 1회·no-target |
| 4 | `FindingRow` 가드 · 표 직렬화(**W1 헬퍼**) · `onRunVerify` JSDoc 정정 · roadmap·CLAUDE.md 갱신 | §5 체크리스트 통과 |

## 5. 검증 체크리스트

v2 §9의 T1~T12 전부 + 신규 2건:
**T13** `$\$5$`처럼 파싱이 깨진 수식을 포함한 선택 → 삽입 결과에 `$…$` 구분자가 살아 있다(W2) ·
**T14** 표 전체/일부 선택 판정이 스냅샷 이후 선택 변화에 흔들리지 않는다(W1 — 스냅샷 시점 확정).

## 6. 하지 말 것 (v1 §7 + v2 누적, 요지 재확인)

`EditorPreview`·전처리 파이프라인 수정 금지 · `selection.toString()` 금지 · annotation 무역변환 삽입 금지 ·
`$$` 빈 줄 정규화 중복 금지(61a Y1) · `insertText`를 채팅 삽입에 사용 금지(C13) · `scrollIntoView` 금지 ·
다크 토큰 금지 · `Range.containsNode` 호출 금지(존재하지 않는다 — W1) ·
사본(`buildMathIndex`·hast 변환기) 수정 시 원본과 동시 수정(동기화 주석 준수) ·
CLAUDE.md 작업 규칙: 수정 전 파일 읽기 · 커밋까지만(push는 덕수) · 완료 시 roadmap 갱신.

## 7. 이 Phase가 건드리지 않는 것

v2 §10과 동일(변경 총량 포함). W1~W3은 파일 목록을 바꾸지 않는다. 서버 0 · Firestore 0 · `npm install` 신규 0.

---

## 부록. 문서 계보와 교훈

| 버전 | 작성 | 산출 |
|---|---|---|
| v1 | web | 초안 — C-2 전제 재판정(annotation ≠ 원본) · 이중 복원 골격 · D1~D10 · Q1~Q8 |
| v2 확정판 | CLI | 실측 교차검토 — Q1~Q8 응답(실 파이프라인 구동) · C1~C18 · D11′~D14′ · 덕수 확정 5건 |
| **v3 최종** | **web** | **C1~C18 전건 재검증(레포 + rehype-katex tarball + package-lock) · W1~W3 수정 · D13′ 수용 판정** |

교훈 (61a·61b 계승 + 신규 1건): 이번 계보에서 v1은 소스를 읽고 구조(annotation ≠ 원본, 이중화)를 세웠고, v2는 **실제 파이프라인을 구동**해 소스 읽기로는 안 보이는 것(스큐의 빈도, `br`+`\n`, 마커 공백)을 잡았고, v3는 **패키지 원문과 표준 API 명세**로 남은 오류(존재하지 않는 `Range.containsNode`, 에러 span의 구분자)를 잡았다. **세 검증 수단(소스 정독 / 실행 실측 / 명세 대조)은 서로를 대체하지 못한다** — 어느 하나만 쓴 버전이 놓친 것을 다음 버전이 다른 수단으로 잡았다. 그리고 v2의 C12가 보여주듯 **계획서의 결정(61b D12)은 구현 후 실물과 다시 대조해야 한다** — 선례 인용은 계획서가 아니라 코드에서 떠 올 것.

*v3 최종 — 착수 가능. 덕수 준비물 없음(신규 설치·env·시트 작업 전부 0). 구현은 v2 §5~§6·§11 + 본 문서 §2(W1~W3)를 함께 볼 것.*
