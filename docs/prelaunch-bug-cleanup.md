# 공개 전 버그 청소 리스트

서비스 공개(오픈소스/외부 사용자 유입) 직전에 몰아서 처리할 버그 목록.
지금 당장 기능을 막지 않지만 공개 전에는 정리되어야 하는 것들. 발견 시점의 조사 결과를
함께 남겨, 나중에 착수할 때 처음부터 다시 파지 않도록 한다.

우선순위는 번호순이 아니라 **영향도** 기준: 2번(데이터 유실)이 1번보다 실질 피해가 크다.
1번이 첫 항목인 이유는 발견·조사가 가장 먼저 이뤄졌기 때문.

---

## 1. 한글 IME 조합 중 ⌘B(블록 분할) → 끝글자 중복

**증상**
마지막 글자를 조합 미완성(밑줄) 상태로 둔 채 ⌘B로 블록을 분할하면, 남는 블록의
끝글자가 두 개가 된다. 예: `# 수정은` → `# 수정은은`

**재현 조건** (2026-07-30, 덕수 관찰)
- ⌘B(블록 분할)일 때 발생. 미리보기 클릭·플러스 버튼 블록추가 등에서는 미발생
- 텍스트 앞에 `#`이 한 개 이상 있을 때. `#`이 없으면 발생하지 않음 (원인 미규명)
- 회피책: 마지막 글자를 스페이스·쉼표·마침표 등으로 확정한 뒤 ⌘B

**조사로 확정된 사실**
- **원인 범위는 `MarkdownEditor`(CodeMirror 6 + 우리 확장 5개) 안.** 임시 최소 진단
  페이지(MarkdownEditor + 분할 로직만)에서도 그대로 재현됨 → EditorView의 미리보기
  리렌더·스크롤 효과·헤더 unmount·저장 로직은 무관
- `EditorView.composing`은 조합 중 정상적으로 true (Android 전용 EditContext 경로가
  아니라 클래식 경로임을 `@codemirror/view` 소스에서 확인)
- CodeMirror는 `compositionend` 후 조합 결과를 **microtask** 또는 **50ms 타이머**로
  뒤늦게 문서에 반영한다 (`@codemirror/view` observers.compositionend)
- 커서가 문서 끝일 때는 `setContent`가 아예 실행되지 않는데도(아래 "적용된 완화" 참고)
  재현됨 → **문서 교체가 유일한 원인은 아님**

**시도했으나 효과 없던 것 (되돌림 — 다시 하지 말 것)**
- `blur()`로 IME 강제 커밋 후 실행 (첨부 문서의 "수정 B" 방식)
- 조합 여부와 무관하게 60ms 지연 후 실행 + `observer.forceFlush()`로 대기 중 DOM
  변화 강제 반영
- `lib/latex-highlight.ts`의 composing 가드는 **이미 예전부터 적용돼 있었음** (이번 건과 무관)

**적용해 둔 완화 (유지 중, 근본 해결 아님)**
- `MarkdownEditor`: LaTeX 린터가 조합 중에는 진단을 갱신하지 않음(직전 진단 유지) +
  `delay` 500 → 1200ms
- `EditorView.handleSplitBlock`: 커서가 끝이면 불필요한 문서 전체 교체를 건너뜀

**자동화 한계**
CDP `Input.imeSetComposition`으로는 재현되지 않는다(puppeteer로 8가지 타이밍 변형 시도
— 조합 상태는 정상 생성되나 중복은 발생 안 함). 즉 **검증은 실제 macOS IME 수동 확인만
가능**하고, 매 시도마다 사람이 붙어야 한다. 이게 이번에 보류한 주된 이유.

**다음에 착수할 때의 계획 (이분 탐색 2단계)**
1. `⌘B`가 하는 일을 하나씩만 남긴 4모드로 원인 동작을 가른다
   - `noop`(기록만) / `setcontent`(문서 교체만) / `state`(React 블록추가만) / `full`(실제 분할)
   - `noop`에서도 중복되면 → CodeMirror의 커밋 처리 자체가 원인(앱 레벨 회피 필요)
   - 판정 기준: 조합 시점 문서 길이 vs ⌘B 처리 후 문서 길이 (사용자가 같은 글자를 두 번
     타이핑한 경우와 구분하려면 조합 시점 스냅샷이 기준선이어야 함)
2. 원인이 CM 확장이면 5개(latex 하이라이트 / 린터 / 자동완성 / 검색·수식 하이라이트 /
   괄호 자동닫기 inputHandler)를 끄면서 이분 탐색
   - 주의: 괄호 자동닫기 `inputHandler`는 `(`·`[`·`{` 입력 시 `defaultInsert()`를
     우회하고 직접 dispatch한다 → 조합 관련 애노테이션이 빠지는 경로. 한글 입력에는
     해당 없어 보이지만 확인 대상

**같이 볼 것 (Phase 58 발견)** — `EditorView.tsx`의 전역 단축키 핸들러에서
⌘B(블록 분할)·⌘F(찾기)·⌘J(AI 완성)가 `e.key === 'b' | 'f' | 'j'`를 쓴다(2244-2254행 부근).
CLAUDE.md는 "Korean IME + CodeMirror 단축키는 `event.code`(물리키) 사용, `event.key` 금지"를
규칙으로 못박고 있는데 이 셋만 예외로 남아 있다(⌘Z·⌘⇧L은 `e.code`를 쓴다).
1번과 같은 ⌘B 경로라 **한글 조합 상태에서 이 세 단축키가 실제로 발화하는지부터 확인**하면
1번 이분 탐색의 사전 정리도 된다. Phase 58 P3의 "핵심문장" 버튼은 이 문제를 피하려고
단축키를 아예 배정하지 않았다.

---

## 2. 저장 왕복 중 타이핑 유실 (데이터 유실)

`EditorView.handleSave`는 Firestore 왕복(블록 delete-all → re-add → `getProblemWithBlocks`)
후 `setAllBlocks(서버본)`으로 상태를 덮어쓴다. 그 왕복 사이(수백 ms~수 초)에 입력한
글자는 사라진다. 탭 전환·편집기 이탈·⌘S 등 자동저장 경로 모두 해당.

사용자 체감은 "글자가 이상해진다"로 1번과 비슷하지만 **원인과 피해가 다르다**(이쪽은 실제
유실). 저장 중 입력을 잠그거나, 저장 시작 시점의 스냅샷과 현재 상태를 merge해야 한다.

## 3. 저장 후 모든 CodeMirror remount

저장 후 블록 `id`가 Firestore doc id로 교체되고(`delete-all → re-add` 구조), 렌더 키가
`key={block.id}`이므로 모든 편집기가 파괴·재생성된다.

- 고칠 때 함정: `MarkdownEditor`는 `initialValue`만 읽는 **비제어** 컴포넌트라, 현재 코드는
  이 remount에 의존해 버전 복원·드래프트 복구 내용을 편집창에 반영한다
  (`EditorView` 복원 경로에서 `id: v-${block_key}`로 재부여)
- 따라서 `key={block.block_key}`로 바꾸는 것만으로는 안 되고, 복원 경로에 명시적
  `setContent` 추가가 세트로 필요

## 4. 매 키입력마다 편집기 전체 리렌더

`handleBlockChange` + `setActiveMathId`가 키입력마다 `EditorView` 전체와
`EditorPreview`(ReactMarkdown + KaTeX)를 다시 렌더한다. memo 없음. 조합 지연·프레임
드롭의 원인이고, 1번 같은 타이밍 버그의 발생 확률을 높인다.

> **Phase 56 R8 교차 참조 (같은 뿌리)** — `handleCursorActivity`가 매 키입력마다
> `buildMathIndex`(문서 전체 O(n) 스캔)를 돌리고, Phase 56에서 추가된 typewriter
> 스크롤이 여기에 `getCursorCoords`(강제 레이아웃 읽기)를 더한다. typewriter 쪽은
> rAF 안에서 실행하고 하단 임계 밖이면 즉시 반환하도록 이미 제한했으나,
> `buildMathIndex` 메모이제이션은 이 항목과 함께 처리해야 한다.

## 5. `/api/copyright/register` 무인증

Phase 29 시점의 미결 사항. 현재 C2(무인증). 공개 전 C1으로 업그레이드 필요.

## 6. 내보낸 md에서 heading 블록이 탭 제목과 같은 레벨

Phase 55b GitHub 내보내기 관찰. `heading` 블록의 `raw_text`가 `## `로 시작하는데
탭 제목도 `## {tab.title}`이라, 아카이브 md에서 둘이 형제로 보여 탭 구분이 흐려진다.

- 원인이 아니라 원칙의 결과다 — `exportMd`는 렌더 재현을 목표로 하지 않고 `raw_text`를
  그대로 흘린다. 여기서 `##`→`###`로 강등하면 사용자 내용을 변형하게 된다
- ~~**제목 블록 디자인 개편 때 같이 처리**(덕수 결정 2026-08-15)~~ → **Phase 58에서 재검토했으나
  미처리로 남긴다.** 아래 조사 결과 참고

**Phase 58 조사 결과 (2026-08-16)**

Phase 58은 제목의 **렌더 크기**(1.18/1.08/1em)만 정했고 **마크다운 레벨**은 건드리지 않았다.
`BLOCK_PRESETS.heading`은 여전히 `'## '`이므로 이 항목은 자동으로 해소되지 않았다.

다만 조사 중 **사용자 내용을 변형하지 않는 해법**이 나왔다 — 강등할 쪽은 블록이 아니라
**export 자신의 래퍼**다:

```
lib/version/exportMd.ts:64   `## ${tab.title}`  →  `# ${tab.title}`
```

한 글자만 바꾸면 `# 탭 > ## heading 블록 > ### 블록 title`(같은 파일 68행)로 위계가 정렬된다.
현재는 탭(`##`)과 heading 블록(`##`)이 형제이면서 블록 title(`###`)이 그 아래인 모순 상태다.
frontmatter가 문서 제목을 따로 갖고 있어 h1 충돌도 없다.

**미처리 사유**: export 산출물 포맷이 바뀌는 변경이라 이미 GitHub에 올라간 아카이브와
새 파일의 헤딩 레벨이 달라진다. Phase 58의 범위(표시 계층)를 벗어나므로 덕수 판단으로 남긴다.
착수하면 한 줄 + 기존 아카이브와의 불일치 수용 여부 결정이 전부다.

## 7. 아이콘 시스템 잔여 부채 (Phase 55b I8·J4 → **개선묶음 M4가 대부분 해소, 2026-09-06**)

- ~~`ContextMenu.tsx`의 `IconDownload` 로컬 중복 정의~~ → **M4 D15가 해소**(ShareButton
  `ShareIcon` 사본 포함, `Icons.tsx` import로 통일)
- ~~`Icons.tsx` `strokeWidth` 1.8/2 혼재~~ → **M4가 해소** — Phosphor regular 단일 계열
  (fill 기반이라 굵기 축 자체가 사라졌다). 유지 예외는 `IconSave`(1.8)·브랜드 마크뿐
- `components/viewer/SvgViewer.tsx`·`GgbViewer.tsx`의 📌 이모지("초기뷰 저장" 버튼 라벨)
  → `IconPin` 교체 가능. **M4 범위 밖이라 잔존 — 유일하게 남은 항목**
- `IconGithub`은 공식 마크(fill). 의도된 예외 — 변형·GitHub 아닌 대상 돌려쓰기 금지(M4 D17 재확인)
