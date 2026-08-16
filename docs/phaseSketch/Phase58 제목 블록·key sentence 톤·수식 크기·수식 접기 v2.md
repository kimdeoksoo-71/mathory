# Phase 58 — 제목 블록 재조정 · key sentence 톤 시스템 · 수식/원문자 크기 완화 **v2 (착수본)**

작성일: 2026-08-16 · v1 작성: web Claude (Fable) · **v2 실측·정정: CLI Claude**
기준 문서: Phase 57 v3 최종 · **기준 커밋: `f7c4a37`** (Phase 55b 마무리)
Phase 57 배포 상태: **P3 callout · P5 원문자 모두 코드에 존재** → §0 선행 조건은 이미 충족(별도 선행 배포 불필요).

> **v2의 성격 — 착수본.** v1은 웹 목업 기준으로 작성되어 실코드 좌표를 추정에 의존했다. v2는 v1 §5의 12개 실측 항목을 전부 코드에서 확인한 결과를 반영해 **사실관계 오류 6건을 정정하고, 무효가 된 설계 3건(P1의 CSS 경로 · P5 전체 · D3의 색값)을 재작성**했다. 덕수가 목업에서 확정한 디자인 의도(D1·D2·D4~D9)는 그대로 두고 구현 수단만 바꿨다.
>
> **미결 항목 없음** — 구 Q1~Q12는 전부 v2 권장안대로 확정됐고(§7 대조표), 덕수의 추가 지시 2건도 반영했다: **① 툴바 아이콘을 브라켓 계열과 통일**(§3-3), **② callout은 톤 강조가 아니라 들여쓰기 강조 — v1의 "블록 key" 개념 폐기, key 마커를 인라인 `**` 하나로 단일화**(D13 · §1-1). **본 Phase 배포 범위는 P1~P5(Stage 1~6)이고, P6 수식 접기는 별도 Phase로 분리한다(D12').**

---

## 0. v1 → v2 정정 요약 (먼저 읽을 것)

| # | v1 진술 | 실측 결과 | 영향 |
|---|---|---|---|
| **C1** | `--katex-scale`을 `1.08`로 | 현행은 **`1.15em`(단위 포함)**. 무단위 `1.08`은 `font-size`에 **무효 선언** → `.katex`가 katex.min.css의 `font: normal 1.21em`으로 되돌아가 **오히려 커진다** | `1.08em`으로. §2-6 |
| **C2** | `.preview-content h2 {}` CSS로 제목 조정 | heading은 **EditorPreview.tsx:335-343 인라인 style**. globals.css 427-428은 주석만 있고 규칙이 없다. 인라인 style은 스타일시트를 이기므로 **v1 방식은 아무 효과가 없다** | TSX 직접 수정. §2-1 |
| **C3** | 블록 래퍼 간격을 실측해 마진 역산 | 5개 사이트 전부 **`paddingTop: '1.5em'` (heading && i!==0)** 이 이미 하드코딩. "문서 첫 제목 예외"도 이미 구현됨. 현행 체감 상단 = 1.5em + h2 marginTop 1em | D2는 사실상 **현행 유지**. §2-1 |
| **C4** | 톤 시스템을 새로 도입 | **이미 톤 체계가 있다** — `.problem-content-toned`(globals 190-197): 본문 `--text-secondary`, 수식 `--text-primary`. Phase 43의 "수식은 진하게, 본문은 흐리게" | 수식은 **명시 color를 갖고 있어 dim 상속이 닿지 않는다**. 별도 규칙 필수. §2-2 |
| **C5** | dim `#6b6a65`, 흰 배경 5.3:1 | 실배경은 흰색이 아니라 클레이. `#6b6a65`는 `--bg-content #F4EFE7`에서 **4.29:1**, FolderView 카드 `#EDE6DA`에서 **3.96:1** → **4.5:1 미달** | 색값 폐기·재선정. §2-2 |
| **C6** | KaTeX 가짜 볼드 차단이 D5의 근거 | katex.min.css `.katex{font:normal 1.21em …}` — `font` **shorthand가 font-weight를 normal로 리셋**한다. 가짜 볼드는 애초에 발생하지 않는다 | D5는 유지하되 **근거 교체**, 가드 CSS는 불필요(무해한 중복). §2-2·§2-4 |
| **C7** | P5: `.num-circle` 축소 | **`.num-circle`이 코드에 없다.** Phase 57 P5는 합성을 폐기하고 `@font-face 'MathoryCircled' + unicode-range`로 재구현 — **CSS 훅 자체가 없다** | §2-7 전면 재작성(`size-adjust` 디스크립터) |
| **C8** | `buildMathIndex` 재사용 / MathToolbar에 버튼 | `buildMathIndex`는 **EditorView.tsx:147 로컬 함수**(lib 아님). MathToolbar는 **"Step 3에서 이 파일 제거" 예정 레거시** — 실제 툴바는 UnifiedToolbar | lib 추출 + UnifiedToolbar. §2-5 |
| **C9** | P6: `.newline` 그룹핑으로 행 접기 | 성립하나 **범위가 좁다.** `\begin{aligned}`·`gathered`·`array`는 `.newline`을 **0개** 방출하고 `.mtable` + 절대 위치 vlist로 렌더 → **행 단위 접기 불가** | P6는 house style `$$ … \\ … $$` **전용**. §2-8 |

---

## 1. 범위와 선행 조건

- **P1 제목 블록**: heading 블록의 글자 크기·두께·언더라인·상하 여백 재조정.
- **P2 key sentence 톤 시스템**: 풀이 영역의 기본 텍스트·수식 톤을 낮추고, **key 마커(인라인 `**` 1종)** 가 붙은 구간만 100% 톤으로 렌더.
- **P3 저작 도구**: 툴바 "핵심문장" 버튼(선택 영역 `**` 토글).
- **P4 수식 크기 비율 완화**: `--katex-scale` **1.15em → 1.08em**(실측 튜닝).
- **P5 원문자 크기 완화**: `@font-face 'MathoryCircled'`에 **`size-adjust`** 추가.
- **P6 긴 display 수식 접기/펼치기**: 최상위 `\\` 4행 이상 display 수식 한정. **→ 본 Phase 범위 밖(D12'). 사양만 확정하고 별도 Phase로 착수.**

**본 Phase의 배포 범위 = P1 · P2 · P3 · P4 · P5.**

- **선행 조건 — 해소됨**: callout(강조문) 블록은 이미 구현·존재한다(`types/problem.ts`, `globals.css:402-415`, `PrintStyles.css:139-148`, 렌더 5곳 전부). Phase 57 Stage 선행 배포 불필요.
- 저장 경로 불가침(raw_text 체인·Firestore 무변경) — 전부 표시 단계에서 해결. **단 v1과 달리 TSX 수정이 불가피하다**(C2·C10·C11): 인라인 style·컨테이너 클래스·prop 추가는 표시 계층이므로 원칙에는 저촉하지 않는다.

### 1-1. key 마커 의미 모델 (**v2에서 개정** — v1의 "블록 key" 폐기)

> **개정 사유 (덕수, 2026-08-16)**: *"강조문은 들여쓰기를 통해 강조하고 싶은 거지, 문단 전체를 진한 톤으로 강조할 목적으로 만든 것이 아니다. 애초 계획에서 모호하게 처리했다."*
> v1은 callout을 "블록 단위 key 마커"로 규정했으나(v1 §0-1) 이는 **callout의 설계 의도를 잘못 읽은 것**이다. v2는 이 항을 폐기하고 **key 마커를 인라인 `**` 하나로 단일화**한다.

**강조의 두 축은 서로 독립이다.**

| 축 | 수단 | 단위 | 무엇을 하는가 |
|---|---|---|---|
| **위치 강조** (레이아웃) | callout(강조문) 블록 | 블록 | 들여쓰기로 도드라지게 한다. **톤과 무관** — 톤 시스템에서 일반 텍스트 블록과 완전히 동일하게 취급된다 |
| **톤 강조** (key) | `**...**` (markdown strong) | 문장/구 (한 블록·한 문단 내) | 그 구간만 100% 톤으로 올린다 |

즉 **callout 블록 안에서도 기본은 dim이고, 안에서 `**`로 감싼 부분만 100% 톤이 된다.** 두 축은 조합 가능하다 — "들여쓴 자리에 있는 key 문장"은 callout + `**`이고, "들여쓰기만" 또는 "톤만"도 각각 성립한다.

**display 수식 행의 강조 (D8 — v2 개정)**

`$$...$$`는 블록 문법이라 `**`로 감쌀 수 없다. 그래서 display 수식 행을 **톤으로** 강조하려면 인라인으로 바꿔 감싼다:

```
$$ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} $$      ← 톤 강조 불가 (블록)
**$ x = \frac{-b \pm \sqrt{b^2-4ac}}{2a} $**   ← 톤 강조 가능 (strong > inlineMath)
```

- Mathory는 인라인 수식에 `\displaystyle`을 자동 주입(preprocessMath)하므로 `$...$`로도 display급 조판이 나온다 — 실코드 확인 ✔.
- **들여쓰기까지 원하면** 그 행을 callout 블록에 둔다. `.callout-block { padding-left: 3em }`(globals 407)이 `.katex-display { padding-left: 3em }`(globals 206)과 **동일 값**이라 x좌표가 나란히 유지되고, 인쇄도 callout 2em ↔ fleqn 2em으로 일치한다(PrintStyles 24·142). `.tag-marker`(globals 293)는 float:right이고 callout이 `padding-right: 0`이라 참조번호 기준선도 유지된다 — 실코드 확인 ✔.
- 두 가지는 **별개 선택**이다. 들여쓰기만 원하면 callout에 두고 `**`를 쓰지 않으면 되고, 톤만 원하면 일반 블록에서 `**$...$**`로 쓰면 된다.

한계 1건 — `$$ A \\ B $$`처럼 **최상위 `\\`로 여러 행을 나눈 복합 display 수식**은 인라인 `$...$` 하나로 옮길 수 없다(KaTeX 인라인 모드는 최상위 줄바꿈 미지원). 대응: 한 줄에 하나씩 `$...$`로 나눠 쓴다. `\begin{cases}` 같은 환경 내부 다행 구조는 인라인에서도 렌더되므로 문제없다. §6에 문서화.

---

## 2. 결정표 (v2 — **전 항목 확정**)

> 구 Q1~Q12는 **전부 v2 권장안대로 확정**됐다(덕수, 2026-08-16). 미결 항목은 없다. 확정 근거는 §7에 대조표로 남긴다.

| # | 결정 | 내용 | 상태 |
|---|---|---|---|
| **D1** | 제목 블록 타이포 | h2 = 본문×**1.08**, 두께 **700**, **언더라인 제거**. **h1/h3도 동시 조정**(D1') | 확정 |
| **D1'** | 제목 3단계 재배치 | 현행 h1 1.5 / h2 1.3 / h3 1.15em. h2만 1.08로 내리면 **h3(1.15) > h2 역전** → **h1 1.18em / h2 1.08em / h3 1.0em(굵기만)** 으로 재배치 | **확정**(구 Q4) |
| **D1''** | 700 굵기 예외 | globals.css의 **"Weights — 3단계만 (700 금지)"**(101-104)에 대한 **제목 한정 예외**로 허용. 토큰 주석에 예외를 명기한다 | **확정**(구 Q9) |
| **D2** | 제목 여백 비대칭 | 목표 체감 위 2.4em / 아래 0.6em. **현행이 이미 위 2.5em(1.5em paddingTop + 1em marginTop) / 아래 0.5em** → 실질 변경은 아래 0.5→0.6em뿐. 위 2.5em은 **건드리지 않는다**(5개 사이트 동시 수정 리스크 > 이득) | 확정 |
| **D3** | 톤 값 | v1 `#6b6a65` **폐기**(4.5:1 미달). **A안 채택**: dim = 기존 `--text-secondary` #5D5647, full = 기존 `--text-primary` #2D2A23. 신규 색 0, 명도차 2.0:1. B안(`#675F52`)은 A안 목업이 "충분히 물러나지 않는다"고 판정될 때의 예비안으로만 보존 | **확정**(구 Q12) |
| **D3'** | 수식 dim 규칙 | `.problem-content-toned .katex { color: var(--text-primary) }`가 명시 color라 **상속 dim이 닿지 않는다** → 수식용 규칙을 반드시 별도로 쓴다 | 신규(C4) |
| **D4** | 폴백 규칙 | 풀이 전체에 **`**`가 하나도 없으면** 톤 낮추기 미적용. callout 존재 여부는 판정에 **넣지 않는다**(D13) | 확정(개정) |
| **D4'** | 기존 마커 자동 승격 | 기존 콘텐츠의 `**`는 **별도 정리 없이 그대로 key로 승격**한다(구 Q2). "opt-in"이 보호하는 것은 **`**`가 없는 문항뿐**이고, `**`가 있던 문항은 배포 즉시 톤 시스템이 켜진다 | 확정 — 신규 |
| **D13** | **callout은 톤과 무관** | 강조문 블록은 **들여쓰기로 위치를 강조하는 레이아웃 블록**이지 톤 강조 수단이 아니다(덕수). 톤 시스템에서 **일반 텍스트 블록과 완전히 동일하게** 취급 — 기본 dim, 안에서 `**`로 감싼 구간만 100%. v1의 "블록 key" 개념 및 `.callout-block` full-tone 규칙 **폐기** | **확정 — v2 개정** |
| **D5** | 강조 수단 = 톤만 (화면) | 화면에서 key는 색으로만 구분. `strong`의 font-weight를 스코프 내 상속으로 고정. **근거 정정: KaTeX 가짜 볼드는 원래 없다**(C6) — 이유는 "굵기+색 이중 신호 회피" | 확정(근거 교체) |
| **D5'** | 체감 강도 리스크 수용 | D5 + D3-A 조합은 key가 **현행 볼드보다 약해질 수 있다**(색 차 1단계 + 굵기 소실). T3·T8 육안 검증에서 부족하면 D3-B로 승격 | 확정(리스크 수용) |
| **D6** | 인쇄 예외 | 인쇄는 전부 100% 톤 + key만 굵게. **KaTeX weight 가드는 불필요**(C6) — 넣어도 무해하나 근거 없음 | 확정(가드 삭제) |
| **D6'** | 인쇄 key 수식 | 인쇄에서 key 안 **수식**은 굵기 강조를 받지 않는다(KaTeX가 자체적으로 weight normal). **수용** — 텍스트 굵기만으로 문장 단위 식별 가능 | **확정**(구 Q1) |
| **D7** | 툴바 "핵심문장" 버튼 | **UnifiedToolbar**(MathToolbar 아님, C8). 제약은 v1 유지 | 확정(위치 정정) |
| **D8** | display 수식 강조 관행 | §1-1 개정 — **톤 강조**는 인라인 `$...$` + `**`로 감싸기, **들여쓰기**는 callout. 두 축 독립 | 확정(개정) |
| **D9** | 스코프 | 톤 시스템은 풀이 영역만. **"풀이"의 정의 = `tabId !== 'question'`** (동적 `extra_N` 탭 포함, question만 제외) | **확정**(구 Q8) |
| **D9'** | 이미지 예외 | dim 상태에서 이미지·SVG·그래프는 **원 대비 유지**(색 필터·opacity 미적용) | **확정**(구 Q3) |
| **D10** | 수식 크기 완화 | `--katex-scale` **1.15em → 1.08em**(범위 1.06~1.10em). **반드시 `em` 단위**(C1) | 확정(단위 정정) |
| **D10'** | 인쇄 수식 무변경 | 인쇄는 `.print-body .katex { font-size: 1em }`으로 `--katex-scale`을 **아예 쓰지 않는 별도 경로** → 조정 대상 아님 | **확정**(구 Q5) |
| **D10''** | 인쇄 제목 무변경 | 인쇄 h1/h2/h3는 현행(13/12/11pt) **유지**. 본문 10pt 대비 1.2배로 이미 완만하고 언더라인도 없으며, 굵기 600이 위계를 만든다. 화면과의 **비율 불일치는 parity 의도적 예외**로 기재 | **확정**(구 Q10) |
| **D11** | 원문자 크기 완화 | `.num-circle` 폐기(C7). `@font-face 'MathoryCircled'`에 **`size-adjust: 92%`**(출발값) 추가 | 확정(수단 교체) |
| **D11'** | 원문자 화면·인쇄 동시 축소 | `--font-print`도 같은 family를 쓰므로 `size-adjust` 하나로 둘 다 줄어든다. **분리하지 않는다**(`@font-face` 추가 선언 불필요) | **확정**(구 Q11) |
| **D12** | 수식 접기/펼치기 | DOM 레벨 접기. **적용 범위 = 최상위 `\\` display 수식 한정**. aligned·gathered·array·cases는 대상 외(C9) | 확정(범위 축소) |
| **D12'** | P6 분리 | **본 Phase는 P1~P5까지.** P6는 T16(aligned 사용 실태) 조사 후 **별도 Phase**로 착수. D12 사양은 승계 | **확정**(구 Q7) |
| **D12''** | P6 적용 사이트 | 착수 시 **열람 계열 전부**(EditorView 미리보기·ProblemView·FolderView·ProblemTabContent 공유뷰), **인쇄만 제외** | **확정**(구 Q6) |

---

## 3. 구현 상세

### 3-1. P1 — 제목 블록

**실측 현행** — `components/editor/EditorPreview.tsx:335-343`, 전부 인라인 style:

```
h1: fontSize 1.5em,  fontWeight 600, marginTop 1em, marginBottom 0.5em, lineHeight 1.4
h2: fontSize 1.3em,  fontWeight 600, marginTop 1em, marginBottom 0.5em, lineHeight 1.4,
    paddingBottom 0.3em, borderBottom 1px solid #999
h3: fontSize 1.15em, fontWeight 600, marginTop 1em, marginBottom 0.5em, lineHeight 1.4
```

globals.css 427-428에는 "EditorPreview 내 제목: inline style이 우선, 여기는 fallback"이라는 **주석만 있고 규칙이 없다**. 인라인 style은 `!important` 없는 모든 스타일시트 규칙을 이긴다 → **CSS로는 손댈 수 없다. TSX를 고쳐야 한다**(C2).

**블록 래퍼 간격 실측**(C3) — 5개 렌더 사이트 전부 동일한 하드코딩이 이미 있다:

| 사이트 | 좌표 |
|---|---|
| EditorView 미리보기 | `EditorView.tsx:3190,3192` |
| ProblemView | `ProblemView.tsx:326,399` |
| FolderView | `FolderView.tsx:246,300` |
| ProblemTabContent(공유) | `ProblemTabContent.tsx:19,67` |
| PrintableContent | `PrintableContent.tsx:58` |

전부 `block.type === 'heading' && i !== 0 ? '1.5em' : undefined`를 래퍼 div의 `paddingTop`으로 준다. 즉:

- **"문서 첫 제목 margin-top 축소 예외"는 이미 구현돼 있다**(v1 §2-1의 요청 사항이 이미 충족).
- padding은 margin과 상쇄되지 않으므로 **현행 체감 상단 여백 = 1.5em(래퍼 paddingTop) + 1em(h2 marginTop) = 2.5em**. D2 목표 2.4em과 거의 같다.
- 현행 체감 하단 = h2 marginBottom **0.5em**. D2 목표 0.6em.

→ **D2는 "여백을 크게 바꾼다"가 아니라 "이미 맞다"가 결론이다.** 실제 변경은 하단 0.5→0.6em 한 줄뿐. 다만 **위 2.5em이 래퍼 padding과 h2 margin 두 곳에 흩어져 있는 것**은 유지보수상 나쁘므로, 한쪽으로 일원화할지는 선택(권장: 그대로 두고 건드리지 않음 — 5개 사이트 동시 수정 리스크가 이득보다 크다).

**제안 수정**(EditorPreview.tsx 335-343):

```tsx
h1: ({ children, ...props }) => (
  <h1 style={{ fontSize: '1.18em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h1>
),
h2: ({ children, ...props }) => (
  <h2 style={{ fontSize: '1.08em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h2>
),
h3: ({ children, ...props }) => (
  <h3 style={{ fontSize: '1em', fontWeight: 700, marginTop: '1em', marginBottom: '0.6em', lineHeight: 1.4, letterSpacing: '-0.01em' }} {...props}>{children}</h3>
),
```

- `paddingBottom`·`borderBottom` **삭제**(D1 언더라인 제거).
- **D1' (확정)** — h2만 1.3→1.08로 내리면 h3(1.15em)가 h2보다 커지는 역전이 생긴다. 위계가 무너지므로 h1/h3 동시 조정이 **필수**다. 위 값(1.18 / 1.08 / 1.0)은 "한 단계씩 차등" 원칙의 최소 개정안으로 채택됐다.
- `fontWeight` 600→700: globals.css의 `--weight-*` 토큰은 **"3단계만 (700 금지)"**(101-104)를 명시하고 있어 D1과 충돌한다 → **D1''로 해소: 제목 한정 예외로 허용.** globals.css 101행 주석을 `/* Weights — 3단계만 (700 금지. 예외: 본문 heading — Phase 58 D1'') */`로 갱신할 것.
- 글꼴 크기 슬라이더(`--content-font-size`)는 전부 em 기준이라 자동 동행. ✔

**인쇄**(PrintStyles.css:50-52) — 현행:

```
.print-body h1 { font-size: 13pt; font-weight: 600; margin: 0 0 6pt; }
.print-body h2 { font-size: 12pt; font-weight: 600; margin: 8pt 0 4pt; }
.print-body h3 { font-size: 11pt; font-weight: 600; margin: 6pt 0 3pt; }
```

- 본문 10pt 기준 h2 = **1.2배** — 화면 1.3배보다 이미 완만하다. 언더라인도 **이미 없다**(border-bottom은 `.print-tab-label`에만 있음).
- 화면을 1.08배로 맞추면 인쇄도 h1 11.8 / h2 10.8 / h3 10pt로 환산해야 parity가 되지만, 인쇄 h2가 본문과 0.8pt 차이면 위계가 사실상 사라진다 → **D10''로 확정: 인쇄 제목은 현행(13/12/11pt) 유지, 손대지 않는다.** 인쇄는 굵기 600이 이미 위계를 만들고 있고 언더라인도 원래 없다. **화면과의 비율 불일치는 parity 의도적 예외**로 CLAUDE.md에 기재(§6).

### 3-2. P2 — 톤 시스템

#### 기존 톤 체계 실측 (C4 — v1이 몰랐던 것)

`globals.css:188-197`:

```css
.problem-content-toned {
  line-height: 1.8; letter-spacing: -0.01em;
  color: var(--text-secondary);          /* #5D5647 — 본문은 톤다운 */
}
.problem-content-toned .katex { color: var(--text-primary); }   /* #2D2A23 — 수식은 진하게 */
```

Phase 43이 이미 "굵기 대신 명도 대비로 위계"를 도입했고, **현재 화면에서 가장 진한 것은 수식**이다. Phase 58의 목표(routine 전개는 물러나고 key가 앞으로)와 정확히 반대 방향이다 — 이 사실이 P2 설계의 출발점이 되어야 한다.

적용 사이트: `EditorView.tsx:3183` · `ProblemView.tsx:742` · `FolderView.tsx:557`.
**`ProblemTabContent`(공유뷰)와 `PrintableContent`(인쇄)에는 `.problem-content-toned`가 없다** → 공유뷰는 본문·수식 모두 기본색(`--text-primary`)으로 렌더된다. 톤 체계의 기준선이 사이트마다 다르다는 뜻이므로 P2 적용 시 반드시 함께 정리할 것.

#### 배경색·명암비 실측 (C5)

| 사이트 | 실배경 | 좌표 |
|---|---|---|
| EditorView 미리보기 | `--bg-content` **#F4EFE7** | `EditorView.tsx:3183` |
| ProblemView 본문 | `--bg-content` **#F4EFE7** | `ProblemView.tsx:671` |
| FolderView 카드 | `--block-bg-active` **#EDE6DA** (가장 어두움) | globals 63 |
| 공유뷰 ContentCard | 확인 필요 (`PublicViewerShell`) | — |

WCAG 명암비 계산값:

| 색 | #F4EFE7 | #EDE6DA | 판정 |
|---|---|---|---|
| `--text-primary` #2D2A23 | **12.47:1** | 11.52:1 | ✔ |
| `--text-secondary` #5D5647 | **6.34:1** | 5.85:1 | ✔ |
| v1 제안 `#6b6a65` | **4.29:1** | **3.96:1** | ✘ **미달** |
| v2 후보 `#675F52` | **4.93:1** | **4.55:1** | ✔ (여유 없음) |

→ **v1의 `#6b6a65`는 흰 배경(5.3:1) 가정에서 나온 값이고, 실제 클레이 배경에서는 두 사이트 모두 4.5:1을 통과하지 못한다. 폐기.**

#### D3 — 두 가지 안

**A안 (채택 — D3) — 기존 토큰 재사용, 신규 색 0**

```
dim  = var(--text-secondary)   #5D5647   (현행 본문색 그대로)
full = var(--text-primary)     #2D2A23   (현행 수식색 그대로)
```

- 명도 간격 **2.0:1** (상대휘도 0.1446 : 0.0735) — v1안(1.38:1)의 1.5배.
- **비key 텍스트는 픽셀 단위로 무변화.** 실제 변하는 것은 딱 두 가지: ① 비key **수식**이 `--text-primary` → `--text-secondary`로 내려앉는다(= 목표 그 자체), ② key 텍스트가 `--text-secondary` → `--text-primary`로 올라온다.
- 명암비는 이미 검증된 두 토큰이라 접근성 리스크 0. 다크모드 확장 시에도 토큰 하나만 따라간다.

**B안 (예비 — 미채택)** — 더 강한 후퇴

```css
:root { --tone-dim: #675F52; }   /* 세 배경 모두 4.5:1 통과 실측치 */
```

- routine을 A안보다 한 단계 더 후퇴시킨다. 다만 `#675F52`는 `--text-secondary`와 명도 차가 1.44:1로 작아 **"dim이 두 종류"인 것처럼 보일 위험**이 있고, 명암비 여유가 거의 없다(4.55:1).

→ **A안 확정(D3).** B안은 T3·T8 육안 검증에서 "충분히 물러나지 않는다"는 판정이 나올 때만 승격 — 그 경우 `--tone-dim` 토큰 한 줄 추가로 전환되도록 CSS를 `var(--tone-dim, var(--text-secondary))` 형태로 써 둔다(아래).

#### CSS

```css
/* globals.css */

/* ── 톤 낮추기: has-key일 때만 발동 (D4) ── */
.solution-tone.has-key { color: var(--tone-dim, var(--text-secondary)); }

/* ⚠ D3' (C4) — .problem-content-toned .katex(0,2,0)의 명시 color를 이겨야 한다.
   .solution-tone.has-key .katex = (0,3,0) > (0,2,0). 이 줄이 없으면 수식은 전혀 흐려지지 않는다. */
.solution-tone.has-key .katex { color: var(--tone-dim, var(--text-secondary)); }

/* ── key 복귀 — 인라인 `**` 하나뿐 (D13: callout 규칙 없음) ── */
.solution-tone.has-key strong,
.solution-tone.has-key strong .katex { color: var(--text-primary); }

/* 제목은 톤 대상 제외 (D9) */
.solution-tone.has-key h1,
.solution-tone.has-key h2,
.solution-tone.has-key h3 { color: var(--text-primary); }

/* D5 — 화면에서 굵기 배제. 근거는 "굵기+색 이중 신호 회피"(C6: 가짜 볼드는 원래 없다) */
.solution-tone.has-key strong { font-weight: inherit; }
```

**특이도 검산** — `.solution-tone.has-key strong .katex`(0,3,1)가 `.solution-tone.has-key .katex`(0,3,0)를 이긴다 ✔. `.problem-content-toned .katex`(0,2,0)는 둘 다에게 진다 ✔.

#### 강조문(callout) 블록의 톤 — D13 (v2 개정)

**callout 블록에 대한 톤 규칙은 만들지 않는다.** callout은 들여쓰기로 위치를 강조하는 레이아웃 블록이고, 톤 시스템에서는 **일반 텍스트 블록과 완전히 동일하게** 취급된다.

- 구조가 `.callout-block > EditorPreview > .preview-content > p`이므로, `.solution-tone`이 조상에 있으면 **callout 내부 텍스트·수식은 자동으로 dim이 되고, 안에서 `**`로 감싼 구간만 위 key 규칙에 걸려 100%로 올라온다.** 별도 CSS가 필요 없다 — 아무것도 안 쓰는 것이 정답이다.
- **has-key 판정에서도 callout을 빼야 한다**(§ 아래 `keyTone.ts`). callout만 있고 `**`가 없는 풀이는 톤 시스템이 켜지지 않는다 → **기존에 callout을 들여쓰기 용도로만 쓰던 문항은 시각 변화 0**이다. v1 설계에서 가장 컸던 회귀 위험이 이 개정으로 사라졌다.
- 조합은 자유롭다: 들여쓰기만(callout, `**` 없음) / 톤만(일반 블록 + `**`) / 둘 다(callout + `**`).
- question 탭의 callout은 스코프 밖(D9)이라 어느 경우든 무관하다.

> **v1 대비 삭제된 것**: `.solution-tone.has-key .callout-block { color: … }` 및 `.callout-block .katex` 규칙, `solutionHasKey`의 `type === 'callout'` 분기, 인쇄의 `.callout-block { font-weight: 700 }`. 셋 다 v1의 "블록 key" 전제에서 나온 것이므로 전부 제거한다.

**주의 사항**

- `--tone-full` 변수는 만들지 않는다 — A안에서는 `--text-primary`가 곧 full이고, 변수를 하나 더 두면 의미가 중복된다.
- `.has-key`가 없으면 어떤 규칙도 발동하지 않는다 → 마커 없는 문항 시각 변화 **0** (D4) ✔.
- **T2의 "픽셀 동등" 범위 정정**: 마커가 **없는** 문항은 완전 동등. 마커가 **있는** 문항은 비key *텍스트*만 동등하고 비key *수식*은 색이 바뀐다(의도).
- `currentColor` 연동 요소 — `.tag-marker`(font-size/family만 지정, 색은 상속) · `.marker-circled`(색 지정 없음) · BORDERED 블록 테두리(`border: 1.5px solid var(--text-muted)` — **고정색이라 dim의 영향을 받지 않는다**). 즉 dim 상태에서 테두리만 상대적으로 진해 보일 수 있다 → 실렌더 확인 후 v3 판정.
- 콘텐츠 내 `\textcolor`는 상속을 이기므로 유지됨 — 기재만.

#### 스코프 클래스를 붙일 지점 (5개 사이트 실측)

| 사이트 | 지점 | 필요한 작업 |
|---|---|---|
| **EditorView** | `EditorView.tsx:3184` — `activeTab === 'question' ? {...} : undefined` 조건부 래퍼 div | 같은 div에 `className` 추가. 탭 하나만 렌더하므로 `activeTab`으로 판정 |
| **ProblemView** | `ProblemView.tsx:742` — `<div className="problem-content-scaled problem-content-toned">`, 탭 루프 안. `isQuestion = tab.id === 'question'`(694)이 이미 있다 | className에 이어붙이기. **가장 깔끔** |
| **FolderView** | `FolderView.tsx:557` — 카드 본문 컨테이너 | 탭 루프 구조 확인 후 부착 |
| **ProblemTabContent** | `ProblemTabContent.tsx:14` — **`{ blocks }`만 받는다. tab 정체를 모른다** | **`tabId` prop 추가 필수.** 호출부 `PublicViewerShell.tsx:78,81,96`은 `tabs[0].id`/`tabs[1].id`/`activeTab`을 이미 갖고 있다 |
| **PrintableContent** | `PrintableContent.tsx:52` — 탭 루프. **`PrintTab = { label, blocks }` — id가 없다** | **`PrintTab`에 `id` 추가 필수(C10).** printTabs를 만드는 호출부(ProblemView·EditorView PDF 경로)도 함께 수정 |

**D9 스코프 정의 (확정)**: 탭은 동적(`question` / `solution` / `extra_N`)이다. 선례는 `ProblemView.tsx:694`의 `tab.id === 'question'`. → **`tabId !== 'question'`이면 톤 스코프 적용**(`extra_N` 포함, question만 제외). 5개 사이트에서 같은 판정식을 쓰도록 `keyTone.ts`에 함께 둔다:

```ts
export const isToneScoped = (tabId: string) => tabId !== 'question';
```

#### has-key 판정 로직 (§2-3 정정)

```ts
// lib/keyTone.ts (신규, 5개 렌더 사이트 공유)
import { Block } from '../types/problem';

/** CommonMark 유효 강조 근사. lookbehind 회피(구형 Safari 대비). */
const KEY_STRONG_RE = /\*\*(?=\S)[\s\S]*?\S\*\*/;

/** D13 — callout은 판정에 넣지 않는다. key 마커는 `**` 하나뿐. */
export function solutionHasKey(blocks: Pick<Block, 'raw_text'>[]): boolean {
  return blocks.some((b) => KEY_STRONG_RE.test(b.raw_text));
}
```

- **v1의 `type === 'callout'` 분기를 삭제했다**(D13). callout만 있고 `**`가 없는 풀이는 톤 시스템이 켜지지 않는다.
- **v1의 `isTextBased(b.type)` 게이트도 제거했다.** `TEXT_BASED_TYPES`는 `EditorView.tsx:116`의 **모듈 로컬 상수이고 export되지 않는다.** keyTone.ts가 사본을 두면 CLAUDE.md의 "상수 6종은 전부 EditorView 상단" 규칙을 깨뜨린다. 타입 게이트 없이 raw_text만 검사해도 실질 오탐이 없다(image/svg/ggb의 raw_text는 URL·`<img src>`라 `**`가 등장하지 않는다) → `type` 필드 자체가 불필요해져 시그니처가 `Pick<Block, 'raw_text'>`로 줄었다.
- 정규식 근사로 충분 — 오탐의 최악 결과가 "톤 시스템이 켜짐"이라 파괴적이지 않다.
- `blocks` 참조 동일성 기준 `useMemo` — 편집 미리보기에서 타이핑마다 전수 regex 방지.
- **D4' 자동 승격의 귀결(D13 개정 후)**: 켜지는 조건이 `**` 하나로 좁혀졌으므로 **영향 범위가 v1보다 훨씬 작다.** 기존 문항이 볼드 용도로 `**`를 쓴 경우에만 배포 즉시 톤이 켜진다. 원치 않으면 `**`를 지우면 꺼진다 — 사용 가이드에 명기(§6).
- T12(실태 조사)는 **게이트가 아니라 사전 고지용**이다 — P2 착수를 막지 않는다. 조사 대상도 `**` 하나로 줄었다(callout 조사는 불필요해졌다).

#### 인쇄 (D6)

```css
/* PrintStyles.css */
.print-body .solution-tone.has-key,
.print-body .solution-tone.has-key .katex { color: inherit; }   /* 100% 복원 */
.print-body .solution-tone.has-key strong { font-weight: 700; }   /* D13 — callout 규칙 없음 */
```

- **v1의 `.katex { font-weight: 400 }` 가드는 삭제했다**(C6). katex.min.css `.katex{font: normal 1.21em …}`의 `font` shorthand가 이미 weight를 normal로 리셋하므로 상속 볼드가 발생하지 않는다. 넣어도 무해하지만 근거 없는 코드가 남는 것이 나쁘다.
- 특이도: `.print-body .solution-tone.has-key`(0,3,0) > `.solution-tone.has-key`(0,2,0) ✔. globals.css는 `.print-root` 서브트리에도 적용되므로 이 복원 규칙이 반드시 필요하다.
- `@media print { * { print-color-adjust: exact } }`(PrintStyles 18-21)가 있어 색이 그대로 인쇄된다 → 복원 규칙 누락 시 회색 인쇄가 나간다.
- **화면·인쇄 parity의 의도적 예외**임을 CLAUDE.md에 1줄 명기(§6).

### 3-3. P3 — 툴바 "핵심문장" 버튼 (D7)

**위치 정정**(C8): `MathToolbar.tsx`는 파일 상단 주석에 **"Step 3에서 커스터마이징 가능한 그룹 시스템으로 교체될 예정 — 그 시점에 이 파일 제거"**라고 적힌 레거시다. 실제 툴바는 `UnifiedToolbar.tsx`이고, `rightItems` 배열(797행 부근) + `IconButton` + `divider(key)`가 확립된 패턴이다.

```
UnifiedToolbarProps에 추가:  onToggleKey: () => void;  keyToggleDisabled: boolean;
rightItems에 항목 추가:      { key: 'keysent', node: <IconButton title="핵심문장" .../> }
```

⚠ `rightItems`는 폭이 좁아지면 **끝부터 hide**되는 반응형이다(717-760 부근 `leftWidth` 측정 로직) → 핵심문장 버튼은 배열 **앞쪽**에 둬야 좁은 화면에서 살아남는다.

#### 아이콘 (덕수 지시 — 기존 브라켓 아이콘 계열과 통일)

**실측한 기존 규격** — `UnifiedToolbar.tsx:22-42`. 툴바 아이콘 11종(`InlineMathIcon` … `AiMathGenIcon`)이 전부 이 두 상수를 공유한다:

```tsx
const ICON_SIZE = 22;
const SVG_PROPS = {
  width: 22, height: 22, viewBox: '0 0 64 64',
  fill: 'none', stroke: 'currentColor',
  strokeWidth: 3.5, strokeLinecap: 'round', strokeLinejoin: 'round',
  'aria-hidden': true,
};
const CORNER_BRACKETS = (            /* 네 모서리 ⌐ ¬ ⌐ ¬ — 계열 정체성 */
  <>
    <path d="M8 20 L8 8 L20 8" />   <path d="M44 8 L56 8 L56 20" />
    <path d="M56 44 L56 56 L44 56" /><path d="M20 56 L8 56 L8 44" />
  </>
);
```

계열 규칙: ① `viewBox 0 0 64 64`, 안쪽 작화 영역은 대략 **x·y 16~48** ② 모든 선은 `stroke="currentColor"` + `strokeWidth 3.5` ③ 면으로 칠하는 요소는 `fill="currentColor" stroke="none"`(`SnippetIcon`의 점 3개, `AiMathGenIcon`의 반짝임이 선례) ④ `CORNER_BRACKETS`를 맨 앞에 둔다.

**제안 도안 — `KeySentenceIcon`**: 보통 행 2개 사이에 **칠해진 강조 행 1개**. 기능(주변은 물러나고 key 한 줄만 앞으로)을 그대로 그린 것이고, 새 idiom을 만들지 않는다.

```tsx
function KeySentenceIcon() {
  return (
    <svg {...SVG_PROPS}>
      {CORNER_BRACKETS}
      <path d="M18 22 L46 22" />                                                   {/* 보통 행 */}
      <rect x="18" y="27.5" width="26" height="9" rx="2"
            fill="currentColor" stroke="none" />                                   {/* key 행 — 면 */}
      <path d="M18 42 L38 42" />                                                   {/* 보통 행 */}
    </svg>
  );
}
```

- 22px 렌더 시 선 ≈1.2px vs 바 ≈3.1px로 대비가 충분하다. 브라켓(x·y 8~20, 44~56)과 겹치지 않는다.
- `ProofreadIcon`(4행 + 체크)과 혼동되지 않도록 **행을 3개로 줄이고 가운데를 면으로** 처리했다.

> **`.svg` 파일 대신 인라인 컴포넌트를 권장한다.** 툴바 아이콘 11종은 전부 `stroke="currentColor"`로 그려져 `IconButton`의 hover·active·disabled 색 변화를 상속받는다(`ICON_BTN_BASE.color: var(--text-muted)`). 별도 `.svg` 파일을 `<img>`로 불러오면 **`currentColor`가 끊겨 상태별 색 변화가 전부 죽는다.** `public/icons/ai/*.svg`가 파일인 것은 그것들이 색이 고정된 브랜드 마크이기 때문이고, 모노크롬 툴바 아이콘과는 성격이 다르다. 굳이 파일로 분리하려면 `<img>`가 아니라 CSS `mask-image`로 써야 하는데, 그러면 11종만 인라인이고 1종만 다른 방식이 되어 통일성 요구와 오히려 어긋난다. → **`UnifiedToolbar.tsx`의 아이콘 블록(44-200행)에 12번째 컴포넌트로 추가**하는 것이 "기존과 통일"의 실질이다. 덕수가 그래도 파일 분리를 원하면 11종 전부를 같이 옮기는 별건 리팩터링으로 다룰 것.

**핸들 확장** — `MarkdownEditorHandle`(MarkdownEditor.tsx:47-73)에 추가:

```ts
toggleKeyWrap(): 'wrapped' | 'unwrapped' | 'rejected';
```

동작 규칙(v1 유지 + 정정):

1. **선택 없음 → rejected**. 버튼 tooltip 안내.
2. **경계 정돈**: 선택 양끝 공백 제외(`** text**` 불발 방지). 행 끝 `\tag{n}`이 포함되면 자동 제외 — **근거 실측**: 텍스트 행 tag 변환 정규식이 `/\\tag\{(\d+)\}\s*$/gm`(EditorPreview.tsx:170)로 **행 끝 앵커**다. `… \tag{1}**`가 되면 `\s*$`가 `**`에 막혀 매칭이 깨지고 참조번호가 원문 그대로 노출된다.
3. **문단 제약**: 정돈된 선택 안에 빈 줄이 있으면 rejected. 블록 경계는 에디터가 블록당 CM 1개라 자동 충족.
4. **수식 경계 가드**: `buildMathIndex`는 **`EditorView.tsx:147`의 로컬 함수**다(C8). 재사용하려면 `lib/mathIndex.ts`로 추출하고 EditorView의 호출부 4곳(2059·2089·2123·2145)을 import로 교체할 것. 선택 양끝이 수식 구간 내부면 rejected, `$...$` 통째 포함은 허용, `$$` 구간을 걸치면 rejected(→ D8 관행으로 유도).
5. **토글**: 이미 `**...**`로 감싸져 있으면 제거, 아니면 삽입. 단일 트랜잭션 dispatch → CM 히스토리·Phase 55a 블록 undo에 자연 편입.
6. rejected 피드백은 CLI 재량.

**단축키**(C9) — 점유 실측:

| 키 | 용도 | 좌표 |
|---|---|---|
| ⌘B | **블록 분할** | EditorView.tsx:2248 |
| ⌘F | 찾기/바꾸기 | 2244 |
| ⌘J | AI 완성 | 2252 |
| ⌘Z / ⌘⇧Z | 블록 undo/redo | 2231 |
| ⌘⇧L | 수식 행 분할 | 2256 |
| Ctrl+N → M/N | 인라인/블록 수식 (chord) | MarkdownEditor.tsx:560,576 · math-editor-extensions.ts:265,276 |

→ **⌘⇧B 권장**(B=bold 연상 유지, 충돌 없음). 등록은 **`e.code === 'KeyB'`**로 — CLAUDE.md의 한글 IME 규칙.

> **부수 발견 (본 Phase 범위 밖)**: 기존 ⌘B·⌘F·⌘J 핸들러가 `e.key === 'b' | 'f' | 'j'`를 쓴다(EditorView 2244-2254). CLAUDE.md는 "Korean IME + CodeMirror 단축키는 `event.code`(물리키) 사용, `event.key` 금지"를 규칙으로 못박고 있다. 한글 입력 상태에서 실제로 동작하는지 확인이 필요하며, 문제가 있으면 `docs/prelaunch-bug-cleanup.md`에 등록할 것.

### 3-4. P4 — 수식 크기 비율 완화 (D10)

**실측 현행** — `globals.css:106-108`:

```css
/* 화면 수식 크기 — 본문 대비 배율. 반드시 em 단위(단위 없으면 무효 → 미적용).
   KaTeX 기본 1.21em → 1.15em으로 살짝 축소 */
--katex-scale: 1.15em;
```

**⚠ C1 — v1의 치명적 오류**: 값에 **`em` 단위가 붙어 있다.** 소비처는 `font-size: var(--katex-scale)`(globals 211-214) 하나뿐이므로, v1이 제안한 무단위 `1.08`을 넣으면 `font-size: 1.08`이라는 **무효 선언**이 되어 declaration이 폐기되고 `.katex`는 katex.min.css의 `font: normal 1.21em`로 되돌아간다 → **수식이 줄기는커녕 1.15em → 1.21em으로 커진다.** globals.css 106행 주석이 정확히 이 함정을 경고하고 있다.

```css
:root { --katex-scale: 1.08em; }   /* 1.15em → 출발값 1.08em, 튜닝 범위 1.06~1.10em */
```

**파급 목록 (실측 전수)** — 이 변수를 읽는 곳은 globals.css:211-214 **한 곳뿐**이다:

| 대상 | 좌표 | 스케일 변경 영향 |
|---|---|---|
| `.preview-content .katex` / `.problem-content-toned .katex` | globals 211-214 | **유일한 소비처.** 여기만 바뀐다 |
| `.tag-marker` (수식 밖 참조번호) | globals 293-299 | `font-size: inherit`, `.katex` 바깥 → **무영향**. 단 주석의 "1.15" 문구 갱신 필요 |
| `.katex-html > .tag` (수식 안 참조번호) | globals 321-325 | 절대값 `var(--content-font-size, 15px) !important` → 값은 불변이나 **수식 대비 상대 체감은 커진다**. 참조번호는 본문 크기와 맞추는 것이 Phase 57 P4의 의도이므로 방향은 옳다. 육안 확인 |
| `.katex .text` (수식 안 한글) | globals 217-220 | 절대값 15px → 불변. 수식 글리프가 줄면서 **한글:수식 크기차가 좁혀져 조화가 개선**된다 (부수 이득) |
| `.base:has(.mfrac, .sqrt, .op-symbol.large-op)`의 0.4em 패딩 | globals 349-353 | em이 `.katex` font-size 기준이라 **자동 비례 축소**. 별도 조정 불필요. 스케일이 줄면 라인박스 침범도 완화 |
| `.tag { bottom: 0.79em }` | globals 305-311 | `.tag` 자체가 절대 15px라 0.79em의 기준도 15px → **불변** ✔ |
| Phase 56 수식 세로 중앙 정렬 | `lib/editorScroll.ts` 등 | 런타임 `getBoundingClientRect` 측정 기반이라 자동 추종. **회귀 테스트 대상**(T13) |
| 인쇄 | PrintStyles 76 `.print-body .katex { font-size: 1em }` | **변수 미사용 → 무변경 확정**(D10'의 근거) |

**튜닝 방법**: 한글(Pretendard)과 KaTeX 세리프는 같은 font-size에서 x-height가 다르므로 숫자로 결정 불가. 실문항(HAJI.26FS01.15처럼 인라인 수식이 본문에 섞인 문단)에서 1.06/1.08/1.10em을 나란히 비교해 확정.

### 3-5. P5 — 원문자 크기 완화 (D11 — 전면 재작성)

**⚠ C7 — v1의 §2-7은 통째로 무효다.** `.num-circle` 클래스는 코드베이스에 존재하지 않는다. Phase 57 P5는 합성 원문자를 **폐기**하고(globals.css 417-425의 실패 기록 참조) 글꼴 교체로 재구현했다:

```css
/* globals.css:26-34 */
@font-face {
  font-family: 'MathoryCircled';
  src: local('AppleGothic'), local('Apple SD Gothic Neo'), local('Malgun Gothic'),
       url('…notosanskr…woff2') format('woff2');
  unicode-range: U+2460-2473;   /* ① ~ ⑳ */
  font-display: swap;
}
/* globals.css:95,99 — 스택 맨 앞 */
--font-ui:    'MathoryCircled', 'Pretendard Variable', …;
--font-print: 'MathoryCircled', 'Noto Serif KR', …;
```

원문(raw_text)의 ① 문자를 그대로 두는 것이 이 방식의 요점이므로 **CSS 훅(클래스·span)이 아예 없다.** 크기를 CSS 규칙으로 줄일 수단이 없다.

**유일한 레버: `@font-face`의 `size-adjust` 디스크립터**

```css
@font-face {
  font-family: 'MathoryCircled';
  src: local('AppleGothic'), local('Apple SD Gothic Neo'), local('Malgun Gothic'),
       url('…') format('woff2');
  unicode-range: U+2460-2473;
  size-adjust: 92%;          /* Phase 58 P5 — 출발값, 실측 튜닝 (범위 85~96%) */
  font-display: swap;
}
```

`size-adjust`는 글리프 아웃라인과 폰트 메트릭을 함께 스케일하므로 **글자 크기와 라인박스 기여분이 동시에 줄어든다** — 합성 방식에서 필요했던 `vertical-align`·`line-height` 수동 보정이 불필요하다. 세로 위치가 어긋나면 `ascent-override` / `descent-override`를 추가로 쓴다.

**주의 3건**

1. **화면·인쇄 동시 적용 — 확정(D11')**: `--font-print`도 같은 `'MathoryCircled'`를 쓴다(globals 99) → `size-adjust` 하나로 둘 다 줄어든다. **분리하지 않는다.** (분리가 필요해지면 동일 `src`의 `@font-face`를 `MathoryCircledPrint` family로 하나 더 선언하는 것이 방법이나, 현재는 동일 판정을 인쇄에도 적용한다.)
2. **브라우저 지원**: Chrome 92+ / Firefox 92+ / **Safari 17+**. 미지원 브라우저는 디스크립터를 무시 → 현행 크기 유지(graceful degradation). 배포 리스크 없음.
3. **기기별 편차**: `local('AppleGothic')`(macOS) / `Malgun Gothic`(Windows) / Noto 웹폰트 폴백은 원문자 글리프 크기가 서로 다르다. `size-adjust` 한 값은 **macOS/AppleGothic 기준**으로 맞추고 나머지는 감수한다(현재도 같은 상황).

**적용 지점** — 클래스가 없으므로 자동으로 전 지점에 걸린다: 본문 원문자 · `.marker-circled` 내부 · 선택지 라벨(`ChoicesBlock` / `PrintChoicesBlock`의 `①②③④⑤`) · 편집창 · 툴바 · MD 내보내기(글꼴만) · 인쇄. **이것이 이 방식의 이점이자, 인쇄만 따로 못 만드는 이유다.**

**Phase 57 검증 기준 재실행**: 행간(1.8) 불침범 / 선택지 3·5등분 baseline 정렬 / `p:has(.marker-circled)`의 `padding-left: 2em`·`text-indent: -2em` 내어쓰기 폭이 축소된 글리프와 여전히 맞는지(globals 284-288) — **여기가 P5의 진짜 리스크**다. 2em 내어쓰기 폭은 고정값이므로 원문자가 줄면 마커와 본문 사이 간격이 벌어진다. 축소율에 따라 2em을 함께 조정해야 할 수 있다(화면 globals 284-288 + 인쇄 PrintStyles 128-129, **두 곳 1:1 대응 유지**).

### 3-6. P6 — 긴 display 수식 접기/펼치기 (D12)

**타당성 검증 결과 (katex 0.16.28, `node -e` 실측)**

| 입력 | `span.mspace.newline` 개수 | 판정 |
|---|---|---|
| `a=1 \\ b=2` (최상위 2행) | **1** | ✔ 행 수 = n−1 |
| `a=1 \\ b=2 \\ c=3 \\ d=4` (최상위 4행) | **3** | ✔ |
| `\begin{cases} … \\ … \\ … \end{cases}` | **0** | ✔ 의도대로 미산입 |
| `\begin{aligned} a&=1 \\ b&=2 \\ c&=3 \end{aligned}` | **0** | ⚠ **접기 불가** |
| 최상위 `\\` + `\tag*{(1)}` | **1** | ✔ `.tag`는 형제 노드 |

**A안(`.newline` 그룹핑)은 성립한다. 단 v1이 예상한 것보다 적용 범위가 좁다** (C9):

- `\begin{aligned}` / `gathered` / `array`는 `.newline`을 **0개** 방출하고, `.base > .mord > .mtable > .col-align-r|l > .vlist-t > .vlist` 구조에서 **각 행이 `style="top:-4.66em"` 같은 절대 위치**로, 그리고 **열(column)마다 따로** 배치된다. 즉 한 행이 DOM상 연속 서브트리가 아니고, `display:none`을 걸어도 `.vlist`의 고정 `height`가 유지되어 **빈 자리만 남는다.** 행 단위 접기가 원리적으로 불가능하다.
- 따라서 **P6는 house style `$$ … \\ … $$` 전용**이다. globals.css:343-348 주석("다중행 독립수식 `$$ … \\ … $$`")과 `⌘⇧L 수식 행 분할` 기능이 이 스타일을 전제하고 있으므로 실제 콘텐츠는 대부분 커버될 가능성이 높지만, **전 문항 raw_text에서 `\begin{aligned|gathered|array}` 사용 실태를 grep으로 확인해야 한다**(신규 T16). aligned 사용 비율이 높으면 P6의 가치가 크게 떨어진다.

**추가 실측 정정 2건**

- **한 행 = `.base` 1개가 아니다.** `a=1` 한 행이 `.base` **2개**(`a =` / `1`)로 쪼개졌다. 그룹핑 단위는 "`.newline` 경계 사이의 **모든** `.katex-html` 자식"이어야 한다. v1의 "해당 `.base` 그룹" 표현을 이렇게 정확화할 것.
- **`.tag`는 `.katex-html`의 직계 자식**이다(globals 305의 셀렉터가 근거). 그룹핑에서 **명시적으로 제외**하지 않으면 마지막 행에 딸려 들어가 참조번호가 사라진다.
- 참고: `\\`는 display 모드에서 KaTeX strict 경고(`newLineInDisplayMode`) 대상이지만, 앱이 `strict: false`(EditorPreview 333 · PrintableContent 96)로 호출하므로 무해하다.

**동작 사양** (v1 유지 + 범위 한정)

1. 렌더 후 각 `.katex-display`에서 `.katex-html > .mspace.newline` 개수를 세어 행 수 = n+1 산출. **≥4행**이면 접기 대상으로 마킹.
2. 접기 시 첫 행·마지막 행 사이의 모든 자식(+ 인접 `.newline`, `.tag` 제외)을 `display:none` 하고 그 자리에 클릭 가능한 **"⋯ N행 접힘"** 합성 행 삽입. 스타일은 dim 톤.
3. **기본 펼침**. 상태 비영속(블록 id + 수식 순번 키의 ref 맵). 원문이 바뀐 수식은 펼침으로 리셋.
4. 적용 사이트(D12'' 확정): **열람 계열 전부** — EditorView 미리보기 · ProblemView · FolderView · ProblemTabContent(공유뷰). **인쇄만 제외(항상 펼침).**

**잔여 검증·주의**

- **react-markdown 재렌더 수명주기**: DOM 직접 조작은 재렌더에 소실된다. `useEffect` 후처리로 매 렌더마다 재적용(마킹 + 접힘 상태 재부여). Phase 57의 전처리·후처리 선례와 같은 계열.
- **KaTeX 버전 고정**: `package.json`의 `"katex": "^0.16.28"` — **캐럿 범위라 마이너 업그레이드가 자동으로 들어온다.** `.newline` 구조 의존을 도입하려면 **정확 버전으로 핀 고정**하거나, 구조 부재 시 조용히 기능을 끄는 방어 코드를 넣을 것.
- **`.tag` bottom 보정**(globals 305-311)이 접힘 후 줄어든 높이에서도 마지막 행 baseline에 맞는지 확인.
- **Phase 56 연계**: `activeMathId` 하이라이트·클릭 중앙 정렬이 접힌 영역을 목표로 하면 **자동 펼침 후 스크롤**. 편집 커서가 접힌 행 원문에 들어갈 때도 동일. 훅 지점은 EditorView의 수식 클릭 핸들러(2089·2123·2145 부근).
- **터치 기기**: hover 없음 → 접기 대상에 상시 소형 버튼 노출로 대체.
- **스크롤 점프**: 토글 시 해당 수식이 뷰포트에 남도록 보정(`lib/editorScroll.ts` 재사용).

**공수 판정 — D12'로 확정**: v1의 "큰 작업" 판정에 더해 적용 범위가 house style 전용으로 좁혀져 비용 대비 효용이 낮아졌다. → **본 Phase는 P1~P5까지 배포하고, P6는 T16(aligned 사용 실태) 조사 결과를 본 뒤 별도 Phase로 착수한다.** 위 D12 사양(§3-6 전체)은 그대로 승계하므로 분리 Phase는 사양 재작성 없이 구현부터 시작할 수 있다.

### 3-7. (선택) 에디터 내 key 시각화

`lib/latex-highlight.ts`에 `**...**` 구간 데코레이션 추가(수식 보호 구간 바깥에서만). 본 Phase 필수 아님.

---

## 4. 구현 순서 (v2 — 본 Phase = Stage 1~6)

| Stage | 작업 | 파일 | 성격 |
|---|---|---|---|
| **1** | **P4 수식 크기** — `--katex-scale: 1.15em → 1.08em` + 주석의 "1.15" 문구 3곳 갱신(globals 107·292·319) | globals.css 1곳 | 값 1개. 독립 커밋 |
| **2** | **P5 원문자 크기** — `@font-face`에 `size-adjust` 추가 + 내어쓰기 2em 재검(화면·인쇄 1:1) | globals.css · PrintStyles.css | 독립 커밋. **Safari 17 미만은 무변화** |
| **3** | **P1 제목 블록** — h1/h2/h3 인라인 style 동시 개정(D1'), h2 언더라인 제거, marginBottom 0.6em, `--weight-*` 주석에 700 예외 명기(D1''). **인쇄 제목은 손대지 않는다**(D10'') | EditorPreview.tsx 335-343 · globals.css 101 | 독립 커밋. (P4 뒤가 옳다 — 제목 체감이 수식 스케일에 상대적) |
| **4** | **P2 톤 시스템** — `lib/keyTone.ts`(`solutionHasKey` + `isToneScoped`) + `PrintTab.id` 추가 + `ProblemTabContent` tabId prop + 5개 사이트 클래스 + globals/PrintStyles CSS | 8~10개 파일 | 가장 큰 작업. 독립 커밋 |
| **5** | **P3 툴바 버튼** — `lib/mathIndex.ts` 추출 → `MarkdownEditorHandle.toggleKeyWrap` → `KeySentenceIcon` 추가 → UnifiedToolbar 배선 → ⌘⇧B(`e.code`) 등록 | MarkdownEditor · EditorView · UnifiedToolbar | 독립 커밋 |
| **6** | 문서 갱신(§6) + **T16** aligned 사용 실태 조사(P6 분리 Phase 착수 판단 자료) | CLAUDE.md · roadmap · prelaunch-bug-cleanup.md | — |
| — | ~~P6 수식 접기~~ | — | **별도 Phase로 분리**(D12'). 사양은 §3-6 승계 |

---

## 5. 검증 체크리스트 (v2)

| # | 항목 |
|---|---|
| T1 | 제목: 언더라인 없음, **h1>h2>h3 위계 역전 없음**(D1'), 체감 여백 위>아래. 연속 heading·문서 첫 heading·문제/풀이 두 영역 |
| T2 | **마커 없는 문항 무변화**: `**`가 전혀 없는 문항의 화면·인쇄가 Phase 58 전과 픽셀 동등(제목·수식크기·원문자 변화 제외) — D4 핵심 보증. **callout만 있고 `**`가 없는 문항도 여기 포함**(D13) |
| T2' | **마커 있는 문항의 변화 범위**: 비key **텍스트**는 픽셀 동등, 비key **수식**만 색 변화 — 그 외 변한 것이 없는지 |
| T3 | `**` 1개 삽입 순간 풀이 전체가 dim으로 전환, 해당 구간만 풀 톤 — 편집 미리보기 실시간 |
| T4 | `**문장 $인라인수식$ 문장**`: **수식 색까지 함께 복귀**(D3' 규칙 검증 — 이게 빠지면 수식이 안 흐려진다). 굵기 변화 없음 |
| T5 | **D13 핵심 검증** — callout 블록: ① `**` 없는 callout은 주변과 **똑같이 dim**(홀로 진하게 튀지 않음) ② callout 안 `**` 구간만 100% ③ callout만 있는 풀이는 톤 미발동 ④ 들여쓰기가 인접 katex-display와 x좌표 일치, 행 끝 `\tag{n}` 정상 |
| T6 | D8 관행: `**$...$**`로 감싼 인라인 수식이 원 `$$...$$` display 렌더와 조판 동등 수준인지, **수식 색이 100%로 올라오는지** 육안 비교. 다행 수식은 줄당 `$...$` 분할 결과 확인 |
| T7 | 문제(question) 영역: `**`가 있어도 톤 미발동(스코프 격리) |
| T7' | **extra_N 탭**(동적 탭)에서도 톤 스코프가 발동(D9: `tabId !== 'question'`) |
| T8 | 명암비 도구 측정: dim이 `--bg-content #F4EFE7`·`--block-bg-active #EDE6DA`·공유뷰 카드 배경 **세 곳 모두** 4.5:1 이상. dim↔full 차이가 한눈에 지각되는지 — **부족하면 D3-B(`--tone-dim: #675F52`) 승격 판단**(D5') |
| T9 | 인쇄: 전체 100% 톤 복원(`.print-body` 오버라이드 동작), key 텍스트만 굵게, 흑백 인쇄 확인 |
| T10 | 툴바: 감싸기/해제 토글, 공백·`\tag` 자동 제외, 문단 넘는 선택 거부, 수식 내부 경계 거부, **undo 1회로 복원**, 좁은 화면에서 버튼 미소실, ⌘⇧B가 한글 입력 상태에서도 동작(`e.code`) |
| T10' | 아이콘: `KeySentenceIcon`이 브라켓 계열 11종과 나란히 놓았을 때 이질감 없음(22px 실렌더), hover·active·disabled에서 **색이 함께 변하는지**(currentColor 상속), `ProofreadIcon`과 혼동되지 않는지 |
| T11 | 5개 렌더 사이트 전부 T2~T5 동일 동작 — 특히 **`PrintTab.id` 추가 누락 시 인쇄에서 조용히 미적용**되므로 인쇄를 반드시 포함 |
| T12 | 기존 콘텐츠 실태: 전 문항 raw_text에서 **볼드 용도 `**`** 목록화(callout 조사는 D13으로 불필요해짐). **게이트가 아니라 사전 고지용**(D4' 자동 승격) — 배포 즉시 톤이 켜질 문항 목록을 덕수에게 미리 전달 |
| T13 | P4: 인라인 수식 섞인 문단에서 1.06/1.08/1.10em 비교 → 육안 승인. **파급표 8행 전수 확인**(§3-4). display 수식·`\tag` 위치·Phase 56 세로정렬 무붕괴. 인쇄 무변화 |
| T14 | P5: 원문자가 행간(1.8) 불침범, 두 자리(⑩~⑳) 가독, 선택지 3·5등분 baseline, **`p:has(.marker-circled)`의 2em 내어쓰기와 축소된 글리프가 여전히 맞는지**, 본문·선택지·편집창·인쇄 4곳 일관, **Safari 17 미만에서 무변화(깨짐 아님) 확인** |
| T13' | P1: 인쇄 제목이 **바뀌지 않았는지**(D10'' — PrintStyles 50-52 무수정) |
| **T16** | **P6 분리 Phase 착수 판단용**(본 Phase에서 조사만): 전 문항 raw_text grep — `\begin{aligned\|gathered\|array}` 사용 문항 수 vs 최상위 `\\` 사용 문항 수. aligned 비율이 높으면 P6 효용 재평가 |
| ~~T15~~ | P6 구현 검증 항목 — **분리 Phase로 이월**: 최상위 4행 수식 접기→"첫 행 + ⋯ + 마지막 행", cases 내부 `\\` 미산입, 3행 이하 버튼 미노출, `\tag` 보존, 기본 펼침, 타이핑 재렌더 상태 유지, 접힌 수식 클릭 시 자동 펼침, 인쇄 항상 펼침 |

---

## 6. 문서 갱신

1. **CLAUDE.md**
   - **"key sentence 톤 시스템 — key 마커는 인라인 `**` **하나뿐**이다. 강조문(callout)은 들여쓰기로 위치를 강조하는 레이아웃 블록이고 톤과 무관하다(D13) — callout 안에서도 기본은 dim, `**` 구간만 100%. `**`가 없는 풀이는 톤 낮추기 미발동(D4). 스코프는 `tabId !== 'question'`(D9). 인쇄는 parity 의도적 예외(전체 100% + key만 굵게, D6)."**
   - **"`.problem-content-toned`가 수식에 명시 color를 준다 — 수식 색을 바꾸려면 `.katex`를 직접 겨냥해야 한다(상속으로는 안 닿는다)."**
   - **"`--katex-scale`은 `em` 단위 포함 값이다. 무단위로 바꾸면 선언이 무효가 되어 KaTeX 기본 1.21em으로 되돌아간다(= 커진다)."**
   - **"heading 스타일은 `EditorPreview.tsx` 인라인 style이 유일한 진실 — globals.css의 heading 절은 규칙 없는 주석이다. CSS로 못 바꾼다."**
   - **"원문자 크기 조절 레버는 `@font-face 'MathoryCircled'`의 `size-adjust` 하나뿐이다(클래스 없음). 화면·인쇄가 같은 family를 공유한다."**
   - **"툴바 아이콘은 `UnifiedToolbar.tsx` 안의 인라인 SVG 컴포넌트 계열이다 — `SVG_PROPS` + `CORNER_BRACKETS` 공유, `stroke="currentColor"`. 별도 `.svg` 파일로 빼면 상태별 색 변화가 죽는다."**
   - **"제목 블록은 `--weight-*`의 '700 금지'에 대한 유일한 예외다(D1'')."**
2. **사용 가이드**(에디터 도움말 또는 phasedocs)
   - **강조의 두 축(D13)** — "강조문 블록은 **들여쓰기**로 강조합니다. **색(톤)**으로 강조하려면 `**`로 감싸세요. 둘은 별개라 따로 써도 되고 같이 써도 됩니다."
   - **D8 관행** — "독립행 수식 `$$...$$`은 색으로 강조할 수 없습니다(블록 문법). 강조하려면 인라인으로 바꿔 `**$...$**`로 쓰세요 — 크기·조판은 그대로입니다. 여러 행짜리 수식은 줄당 `$...$`로 나눠 쓰세요."
   - **D4' 자동 승격** — "풀이에 `**`가 하나라도 있으면 그 풀이 전체가 흐려지고 `**` 구간만 진하게 표시됩니다. 원치 않으면 `**`를 지우세요."
3. **roadmap** Phase 58 절 신설 — 디자인 목표와의 대응(핵심 아이디어 전달 = 톤 시스템 / 일목요연 = 제목 블록 · Phase 57 여백 체계) 명기. **P6는 별도 Phase(59 후보)로 예고.**
4. **prelaunch-bug-cleanup.md**: ⌘B/⌘F/⌘J의 `e.key` 사용(§3-3 부수 발견) 등록.
5. 본 문서 v2 = **착수본**. phasedocs 이관 후 구현 시작.

---

## 7. 질문 종결 대조표 (전 항목 확정 — 2026-08-16)

**미결 항목 없음.** 구 Q1~Q12는 전부 v2 권장안대로 확정됐다. 아래는 어떤 결정이 어느 조항으로 흡수됐는지의 대조표다.

| 구 # | 질문 | 확정 | 흡수된 조항 |
|---|---|---|---|
| Q1 | 인쇄에서 key 안 수식이 굵기 강조를 못 받는 것 | **수용** | D6' |
| Q2 | 기존 `**`를 자동 key 승격할 것인가 | **자동 승격**(사전 정리 없음) | **D4'** |
| Q3 | dim 상태에서 이미지 원 대비 유지 | **수용** | D9' |
| Q4 | h1/h2/h3 동시 재배치 | **1.18 / 1.08 / 1.0em** | D1' |
| Q5 | 인쇄 수식 크기 조정 | **무변경** | D10' |
| Q6 | P6 적용 사이트 | **열람 계열 전부, 인쇄만 제외** | D12'' |
| Q7 | P6 구현 시점 | **별도 Phase로 분리** | D12' |
| Q8 | 톤 스코프에서 "풀이"의 정의 | **`tabId !== 'question'`** | D9 |
| Q9 | `font-weight: 700`과 "700 금지" 토큰 규칙 충돌 | **제목 한정 예외 + 주석 갱신** | D1'' |
| Q10 | 인쇄 제목 비율 | **현행 유지**(13/12/11pt), parity 예외 | D10'' |
| Q11 | 원문자 `size-adjust`의 화면·인쇄 분리 | **분리하지 않음**(동시 축소) | D11' |
| Q12 | 톤 값 A안 vs B안 | **A안**(기존 토큰 재사용) | D3 |
| — | 툴바 아이콘 (덕수 추가 지시) | 브라켓 계열과 통일한 **`KeySentenceIcon`** — 인라인 SVG 컴포넌트 | §3-3 |
| — | **callout의 톤 처리** (덕수 개정 지시) | **톤과 무관 — 들여쓰기 전용 레이아웃 블록.** v1의 "블록 key" 폐기, key 마커는 `**` 하나로 단일화 | **D13** · §1-1 |

### 착수 후 남는 판단 2건 (구현 중 육안 판정)

| # | 내용 | 판정 시점 |
|---|---|---|
| J1 | **D3-B 승격 여부** — A안(dim=`--text-secondary`)의 명도차 2.0:1이 "충분히 물러난" 느낌을 주는가. 부족하면 `--tone-dim: #675F52` 한 줄 추가 | Stage 4 완료 후 T8 |
| J2 | **P4·P5 실측 튜닝값** — `--katex-scale` 1.06/1.08/1.10em 중, `size-adjust` 85~96% 중 | Stage 1·2 각 T13·T14 |
