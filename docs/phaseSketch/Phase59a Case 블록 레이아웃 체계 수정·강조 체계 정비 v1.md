# Phase 59a — Case 블록 레이아웃 체계 수정 · 강조 체계 정비 (구현 계획서 v1)

작성일: 2026-08-20 · 기준 커밋 **`fdeac85`** (main = origin) · 작성: web(레포 클론 대조)
입력: 덕수 구상안(2026-08-20) + Phase 59 확정본(`docs/phasedocs/Phase59 요약 보기·경우 블록.md`) + 소스 실측

> **v1의 성격**: 방향·구조·삭제 목록은 확정 제안, 좌표·수치는 실측 전 제안값이다(교차검토 대상).
> 구상안의 4개 축과 함께, **요청 (2) — Phase 59 중도 수정 누적에 대한 전반 검토** 결과를 §0에 싣고
> 각 문제를 본 Phase의 어느 절이 해소하는지 대응시켰다.
>
> **미결 항목 없음 (2026-08-20 덕수 확정)** — Q1~Q4는 전부 **기본안 채택**. Stage 1에서 실물 판정하고,
> 문제가 발견되면 그때 수정한다(각 Q에 폴백이 이미 명시돼 있다). 다음 단계는 CLI 교차검토 → v2
> (Phase 59와 같은 계보: v1 web 방향 확립 → v2 CLI 레포 전수 실측 — 검토 포인트는 부록 C).

---

## 0. Phase 59 전반 검토 — 중도 수정이 남긴 일관성 문제 (R1~R8)

Phase 59는 v4 착수본 위에 구현 중 개정 9건(§11-1~11-9)이 누적됐다. 개정 하나하나는 근거가 있었지만,
누적 결과를 레포 전체와 대조하면 아래 8건이 남아 있다. **R1~R5는 이번 구상안이 정면으로 해소하는 문제**이고,
**R6~R8은 이번 기회에 함께 정리해야 할 잔여 부채**다.

| # | 문제 | 해소 |
|---|---|---|
| **R1** | **경우 블록이 "제2의 들여쓰기 체계"를 만들었다.** 본문 3em/하위 6em, 그 안의 수식·리스트·① 밭은 6em/9em(인쇄 2·4/4·6em), 개재 블록용 `.case-gap-body`(+3em), 요약 발췌 `.outline-keys`(3em/런 안 6em), `.case-block ul {margin-left:3em}`·`!important` 마커 규칙 2건까지 — 최상위 규칙과 별개로 도는 좌표 체계가 CSS 6개 절에 흩어졌다. §11-2→11-6에서 같은 좌표를 두 번 다시 정한 것 자체가 체계가 무리였다는 신호다 | **§1** (전면 철거) |
| **R2** | **'강조'라는 말이 과적됐다.** callout의 이름은 '강조문'인데 실제 기능은 들여쓰기(색 불변)이고, `**`의 이름은 '핵심문장'인데 실제 역할은 강조 + 요약 발췌 + 톤 트리거의 3역이다. Phase 59 안에서도 '요약에 넣기' 명명 때 "'강조'는 이미 두 축을 뜻해서 못 쓴다"고 우회한 기록이 있다(§11-9) — 용어 체계가 막혀 있었다는 증거 | **§2·§3** |
| **R3** | **톤 시스템이 조건부(has-key)라 문항 간 외관이 비일관하다.** `**` 하나를 넣는 순간 탭 전체(수식 포함)의 톤이 반전된다. 특히 레거시 `**Case n.**` 라벨의 `**`가 key 마커로 오인돼 **케이스 분석을 쓴 옛 풀이는 저자 의도와 무관하게 전부 has-key 발동 상태**다(Phase 59 E1-b가 이를 "전제"로 수용했지만, 전제가 아니라 숨은 결합이다) | **§3-3** (톤다운 기본화로 조건 자체를 제거) |
| **R4** | **`**`와 요약의 결합이 저작 규칙 부채를 낳았다.** "핵심문장 마커는 문장 전체 단위로 감싸라"(사용 가이드) 같은 규칙은 발췌 기능 때문에 생긴 것이다 — 강조하고 싶은 범위와 요약에 남길 범위가 같은 마커에 묶여 있어서다 | **§3-2** (발췌 삭제) |
| **R5** | **'요약에 넣기' 스위치가 case·subcase 블록에서 무의미하다.** `buildOutline`은 경우 블록을 `!isCaseBlock` 조건으로 showInSummary 검사에서 제외하는데(`lib/solutionOutline.ts:111`) 편집창 스위치는 제목 블록만 뺀다(`EditorView.tsx:737`). 제목 블록은 같은 이유("아무 일도 안 하는 스위치는 오해만 준다")로 2026-08-18에 스위치를 제거했으면서 경우 계열은 누락됐다 | **§3-4** (스위치 제거) |
| **R6** | **문서 무결성**: phasedocs Phase 59 확정본이 §11-10·§11-11을 세 곳에서 참조하지만 해당 절이 없다(내용은 §11-5·11-7에 흡수된 채 번호만 남았다) | **§6 Stage 5** (문서 정정) |
| **R7** | **'핵심문장' 전제 문구가 UI 곳곳에 남는다**: OutlineToggle 툴팁 3종("제목·핵심문장·경우 …"), EditorView 요약 스위치 툴팁(`:750`), 사용 가이드 — §3 반영 시 전부 거짓말이 된다 | **§5 문구 좌표 일람 + Stage 5** |
| **R8** | **FolderView 래퍼 em ≠ 본문 px 편차(G8)가 이번엔 실해가 된다.** rail이 음수 좌표로 나가면 카드의 `overflow: hidden`(FolderView:510·582) + 좌측 패딩 22px에서 **잘릴** 수 있다 — Phase 59에서는 "기록만"이었지만 이제 실측·대응이 필수다 | **§1-4** (사이트별 좌표 토큰 + Stage 1 실측) |

> 검토 범위: `459cbcb`~`fdeac85`의 Phase 59~60 커밋 40여 개, 확정본 §11 전체, 렌더 사이트 5곳 + 요약 보기 2뷰의 현행 코드.
> 톤·요약·경우 블록의 **데이터 계약(raw_text 불변 · additive 타입 · 규칙 0 · 마이그레이션 0)은 훼손된 곳이 없었다** — 문제는 전부
> 표현 계층(좌표·용어·조건부 톤)에 있고, 그래서 이번 Phase도 순수 클라이언트로 끝난다.

---

## 1. Case 블록 레이아웃 체계 수정 (구상 1)

### 1-1. 기조

rail·dot·(요약 보기의) chevron을 **본문 영역 왼쪽 바깥(거터)** 으로 내보내고, rail 때문에 신설한
2단 들여쓰기 체계를 전부 철거한다. 경우·하위 경우의 문단 좌단 = **일반 텍스트와 동일한 0**.
경우 안의 display 수식·리스트·① 밭은 **최상위 규칙 그대로**(수식 3em 등)를 상속하므로 override가 사라진다.

요약 보기 제목 줄은 이미 §11-11에서 "chevron만 흐름 밖, 제목 좌단은 본문과 같은 선"으로 결정됐다 —
**Phase 59a는 그 원리를 경우 블록까지 일반화하는 것**이다. 구조 신호는 거터, 본문은 본문.

### 1-2. 새 좌표 체계 (제안값 — Stage 1 실측 후 확정)

x = 0 이 본문 좌단. 거터 좌표는 `:root` 토큰으로 두고 사이트별 1줄 override를 허용한다(R8 대응).

```css
--case-rail-x:    -1.6em;   /* rail·dot 중심선 */
--case-chevron-x: -0.8em;   /* 요약 보기 경우 줄 chevron 중심 (rail과 본문 사이) */
```

| 대상 | 좌표 | 비고 |
|---|---|---|
| rail · dot (경우·하위 공통) | **-1.6em** | 하위 경우도 같은 rail — inner rail 없음(D12′ 유지) |
| 요약 보기 경우 줄 chevron | **-0.8em** | dot 오른쪽·본문 왼쪽. 절대배치 유지, `top: 0.9em` 유지 |
| 요약 보기 제목 줄 chevron | 현행(흐름 밖) | 마진 3값(-1.2/+1/+0.2)을 경우 줄 chevron과 **같은 x로 정렬**되게 재조정 |
| 경우·하위 경우 본문/제목행 | **0** | `padding-left` 삭제 |
| 개재 블록(case-gap) | **0** | `.case-gap-body` 철거 — rail이 바깥에 있으므로 걸릴 것이 없다 |
| 경우 안 수식·리스트·① 밭 | 최상위 규칙 그대로 | override 전부 삭제 |
| 인쇄 rail | **-1.2em**(=12pt≈4.2mm) | 단 간격 10mm 안. §1-5 |

하위 경우의 시각 구분은 **dot 크기(0.52em/0.3em) + 라벨(C1/C1a)** 만 남는다 → **Q1**.

### 1-3. CSS 변경 (globals.css 561-744 절 재작성)

**유지되는 것** — rail 조각·위 브리지·종단 기하(§11-1의 1.5em 규칙 3종), 불투명 `--case-rail`,
dot 상태 문법(D19: 채움/테두리 + `--case-dot-fill`), `--case-ring`, `case-cont`, 라벨·제목행 굵기 규칙,
톤 가드(§3-3에 따라 셀렉터만 이전), `.case-gap`의 rail 관통(개재 블록 앞뒤 연결).

**바뀌는 것** — 모든 `left: 1em`이 `left: var(--case-rail-x)`로, `.case-block`·`.case-sub`의 `padding-left` 삭제.

**삭제되는 것(철거 목록)**:

```
globals.css   .case-block { padding-left: 3em }  ·  .case-block.case-sub { padding-left: 6em }
              .case-gap-body 3규칙 (579-583)
              .case-block .preview-content > ul/ol { margin-left: 3em } (664-665)
              .case-block .preview-content p:has(.marker-circled) { … !important } (666)
              .outline-keys 들여쓰기 일체 (684-690)  ← §3-2에서 발췌 자체가 사라진다
PrintStyles   .case-block { padding-left: 2em } · .case-sub { 4em } · .case-gap-body 3규칙 (170-173)
              .case-block > ul/ol { margin-left: 2em } · ① !important (207-211)
lib/caseBlock caseGapClassName의 case-gap-body 분기 → 상수 'case-gap' 반환으로 단순화
              (GAP_MEDIA_TYPES 구분 소멸 — 이미지든 텍스트든 개재 블록은 전부 0em)
```

⚠ **G7(상하 padding 금지)·브리지 1.5em 물림 조건·불투명 rail은 그대로 살아 있는 제약**이다 — 철거 대상이 아니다.
⚠ `.case-block::before`의 `margin-left: -0.5px` 헤어라인 중심 보정도 토큰 이전 후 유지.

### 1-4. 여백 확보 (사이트별)

rail이 -1.6em(15px 기준 24px)에 서므로, 각 사이트에서 **rail 왼쪽에 남는 공간**을 실측·확보한다.
필요 거터 폭 ≈ 2.0em(rail 1.6 + dot 반경 + 여유) ≈ **30px@15px**.

| 사이트 | 현행 | 조치(제안) |
|---|---|---|
| **ProblemView** (TabBody) | 라벨 열 7em + `LABEL_GAP: 28` | **LABEL_GAP 28 → 56** — rail 좌우에 각각 ~1.5em 공기가 생기고, 라벨과 rail이 붙어 답답한 문제(구상 1-2-4-1)를 해소 |
| **EditorView 미리보기** | 채널 marginLeft 24 + 미리보기 padding '20px 32px', width `calc(35em + 64px)` | rail(24px)이 좌측 패딩(32px) 끝에 닿아 답답 → **padding '20px 48px' + width `calc(35em + 96px)`** (35em 측정폭 보존 — `:3344` 주석의 경고 준수). 채널 marginLeft **24 → 32** (구상 1-2-4-2) |
| **공유 1단** (ContentCard) | padding '32px 36px' | **좌우 48px**로 확대 |
| **공유 2단** (twoColumn) | ScrollColumn padding 24 | 우측 열 rail이 divider 쪽으로 나간다 — **열 사이 간격을 rail 폭+양측 여유 이상으로 실측 확보** (구상 1-2-4-3) |
| **FolderView 카드** | padding '18px 22px' + **overflow: hidden** | 22px < 24px라 rail이 잘린다(R8). 카드 컨테이너에 **`--case-rail-x: -1em` override + 좌측 패딩 28px** — 카드는 축소 미리보기라 거터를 좁혀도 무방. Stage 1에서 슬라이더 11/15/24 실측 |
| **인쇄** | `.case-block { padding-left: 2em }` | §1-5 |

⚠ EditorView는 `overflowY: auto` 컨테이너 **안쪽 패딩** 위에 rail이 그려지므로 클리핑이 없지만,
FolderView·공유 카드처럼 `overflow: hidden` 경계가 있는 곳은 **거터가 패딩 안에 들어와야** 한다.
Stage 1 검증의 제1항목이다.

### 1-5. 인쇄

- 본문 좌단 0, rail `left: -1.2em`(10pt 기준 12pt ≈ 4.2mm). 단 간격 10mm — 오른쪽 단의 rail과
  왼쪽 단 본문 사이에 ≥5mm가 남는다. 왼쪽 단 rail은 페이지 여백(20mm) 쪽이라 문제없다.
- ⚠ **multicol에서 음수 좌표 절대배치가 잘리는지 브라우저 실측 필수**(Chrome 인쇄 미리보기 + PDF).
  잘리면 인쇄만 대체 좌표(본문 좌단을 1.2em 들이고 rail을 0에)로 폴백한다 → **Q4**.
- 세로 기준 0.85em(G4)·`#000` 채움(G5)·위 브리지 14pt는 그대로.

### 1-6. 회귀 확인 (Phase 59에서 배운 함정)

- **F1 형제 인접성**: 래퍼 규약(D15′)은 건드리지 않는다. 5사이트에서 `.case-block + .case-block` 매칭 재확인.
- **margin-left 금지**(§11-6): 새 좌표도 전부 `left`(절대배치)와 `padding`으로만.
- 좌표 토큰 도입 후 **FolderView G8 편차**는 "rail이 본문과 살짝 어긋남"에서 "rail 잘림"으로 양상이 바뀐다 — override로 흡수.
- 요약 보기: `.outline-keys` 소멸(§3-2) 후 OutlineSections의 `case-gap` 부착 로직(firstCase/lastCase)도 함께 삭제.

---

## 2. 명칭 변경 (구상 2)

| 항목 | 현행 | 변경 | 범위 |
|---|---|---|---|
| callout 블록 | '강조문' | **'들여쓰기'** | UI 라벨만. **타입 id `callout`·클래스 `.callout-block`·DB 불변** |
| box 블록 | '빈 글상자' | **'글상자'** | 동일 — 타입 id `box` 불변 |

- 코드 좌표: `EditorView.tsx:86`(BLOCK_TYPE_LABELS.callout) · `:93`(box). 라벨은 이 상수 한 곳에서만 공급된다(드롭다운·상단바·전체접기 바 공용).
- 취지 반영: '들여쓰기' 블록의 CSS 주석(globals.css:546-548)과 caseBlock·keyTone 주석의 "강조문" 표기를
  "들여쓰기(구 강조문)"로 정정 — **"강조"라는 단어를 레이아웃 장치에서 회수**하는 것이 이 항목의 실익이다(R2).
- 문서: 사용 가이드 · CLAUDE.md · roadmap의 호칭 갱신(Stage 5).
- ⚠ '(가), (나) 상자'·'ㄱ, ㄴ 상자' 라벨은 그대로 — '글상자'와의 계열감은 유지된다.

---

## 3. 강조와 '요약에 넣기'의 구조적·개념적 구별 (구상 3)

정비 후의 역할 분담 — 네 장치가 각자 한 가지 일만 한다:

| 장치 | 역할 | 요약 보기와의 관계 |
|---|---|---|
| 들여쓰기 블록(구 강조문) | **위치** (들여쓰기) | 무관 (스위치로만) |
| 강조 `**…**` (구 핵심문장) | **색·굵기** | **무관** (발췌 삭제) |
| 코칭 블록 (§4) | **신호** (전략·주의) | 무관 (스위치로만) |
| '요약에 넣기' 스위치 + 자동 항목 | **요약 구성** | 블록 단위로만 |

### 3-1. 버튼 이름 변경

`UnifiedToolbar.tsx:798` title `'핵심문장 (**로 강조)'` → **`'강조 (**…**)'`**. 거부 툴팁("감쌀 수 없는 선택입니다 …")은 유지.
내부 식별자(KeySentenceIcon, keyToggle*)는 유지해도 무방하나 주석에 "강조 토글(구 핵심문장)"을 병기한다.

### 3-2. 요약 보기에서 `**` 발췌 삭제

- `lib/solutionOutline.ts`: `extractKeySentences`·`joinKeys`·`OutlineItem.keys`·`kind: 'keys'` 삭제.
  행 단위 스캔 루프는 **레거시 `**Case n.**` 승격 전용으로 축소**해 유지한다(D2′는 살아 있다).
  이어짓기 블록은 요약에 아무것도 남기지 않게 된다(제목행이 없으므로) — 사양.
- `lib/keyTone.ts`: `KEY_STRONG_RE_GLOBAL` 삭제. `KEY_STRONG_RE`·`solutionHasKey`는 §3-3에서 함께 삭제.
- `OutlineSections.tsx`: keys 렌더 분기·`.outline-keys`·firstCase/lastCase gap 계산 삭제.
  접힌 경우는 **제목행만** 남는다(3-2 렌더 표의 4행이 "제목행 + 발췌" → "제목행"으로).
- CSS: `.outline-keys` 절 삭제.
- **파급**: 요약 보기에 남는 것 = 제목 · 경우/하위 경우 제목행 · showInSummary 블록.
  `hasOutlineContent` 게이트는 코드 그대로지만 **판정 결과가 좁아진다** — 제목도 경우도 없는 풀이는
  기본값 outline이어도 full로 강제 해제되는 문항이 늘어난다(§11-8 가드가 그대로 받아준다).
- 사용 가이드의 "문장 전체 단위로 감싸라" 규칙 폐기(R4 해소) — 이제 `**`는 아무 데나, 조각이라도 자유롭게.

### 3-3. 톤다운을 기본 설정으로

**has-key 조건 자체를 제거**한다. 풀이·추가 탭(현행 스코프 `isToneScoped` 유지, 문제 탭 제외)은
마커 유무와 무관하게 항상 dim 톤이고, `**` 구간만 primary + 600으로 선다.

```css
/* 변경 후 — .has-key 클래스 소멸, 규칙은 .solution-tone에 직접 */
.solution-tone        { color: var(--tone-dim); }
.solution-tone .katex { color: var(--tone-dim); }
.solution-tone strong,
.solution-tone strong .katex { color: var(--text-primary); }
.solution-tone strong { font-weight: var(--weight-semibold); }
.solution-tone h1, h2, h3 가드 · h1~h3 .katex 복귀 · .case-label 가드 — 셀렉터에서 .has-key만 제거
```

- `lib/keyTone.ts`: `solutionHasKey`·`KEY_STRONG_RE` 삭제, `toneClass`는 `'solution-tone'` 상수 반환으로 축소.
  파일 존치(스코프 판정 `isToneScoped`는 5사이트 공용).
- `PrintStyles.css:48-50`: 복원 규칙 셀렉터에서 `.has-key` 제거 — **인쇄는 지금처럼 100% 톤 + `**`만 700** (Phase 58 D6 불변).
- ⚠ **특이도 함정**: `.solution-tone .katex`는 (0,2,0)로 `.tone-baseline .katex`(0,2,0)와 **동률**이 된다
  (has-key 시절엔 (0,3,0)로 이겼다). 두 클래스는 EditorView에서 서로 다른 요소에 붙으므로 병기 셀렉터로 올릴 수 없다 —
  **globals.css 안에서 톤 절이 기준선 절(261-262) 뒤에 온다는 소스 순서에 의존**하게 된다. 규칙 옆에 ⚠ 주석 필수,
  또는 `.solution-tone .katex`를 `div.solution-tone .katex`로 한 단 올려 순서 의존을 없앤다(권장).
- **파급(의도된 외관 변화)**: `**`가 하나도 없는 기존 풀이도 수식이 dim으로 내려앉는다 — 구상안 3-1-4-1의 명시적 결정.
  Phase 58의 "마커 없는 문항은 픽셀 무변화(opt-in)" 원칙을 **의도적으로 폐기**하는 것임을 문서에 남긴다.
  R3의 레거시 `**Case n.**` 오발동 문제는 조건이 사라지므로 함께 소멸한다.
- V2 검증 항목("모드 전환 시 has-key 컨테이너 불변")은 대상이 소멸한다.

### 3-4. '요약에 넣기' — 블록 단위로 단순화

- 자동 포함: **제목 블록 · 경우 제목행 · 하위 경우 제목행** (구상의 "핵심문장 제외"는 §3-2로 이행 완료).
  코드상 `buildOutline`의 heading·case 처리 그대로 — 추가 변경 없음.
- 추가 포함: `showInSummary` 스위치를 켠 블록 (현행 유지).
- **R5 해소**: `EditorView.tsx:737`의 스위치 노출 조건을 `isHeading` → `isHeading || isCaseBlock(block.type)`으로.
  경우 블록에 남아 있는 `showInSummary: true`는 제목 블록 전례와 같이 "원래도 무시되던 값"이라 그대로 둔다.
- 문구: 스위치 툴팁(`:750`)·OutlineToggle 툴팁 3종을 "제목·경우·선택 블록" 기준으로 갱신(R7).

---

## 4. 코칭 블록 도입 (구상 4)

signaling 축의 구체화. GitHub alert(Markdown callout)의 시각 문법을 가져온 **블록 타입**으로 도입한다 —
블록 저작 모델이므로 `> [!IMPORTANT]` 원문 문법은 도입하지 않는다(타입이 의미를 나른다. raw_text는 본문만).

### 4-1. 데이터 모델

**additive 타입 2종**: `coach_important` · `coach_caution`.

- 단일 타입 + variant 필드 안도 검토했으나, 블록 기계장치(드롭다운·프리셋·TEXT_BASED·SPLITTABLE·SCANNED)가
  전부 타입 키라 **타입 2개 추가가 신규 배선 0**이다 — case/subcase(Phase 59)·list/callout(Phase 57)과 같은 패턴.
  항목 추가(구상 4-2-4)도 타입 하나 더 얹으면 된다.
- `types/problem.ts` union에 2종 추가. **Firestore 규칙 0 · 마이그레이션 0 · 서버 0** (type 필드는 이미 자유 문자열 저장).
- 라벨(BLOCK_TYPE_LABELS): `'코칭 (Important)'` · `'코칭 (Caution)'` → **Q2**. 프리셋 `''`. TEXT_BASED·SPLITTABLE에 포함.
  `SCANNED_TYPES`(solutionOutline)에도 포함 — 본문 안 `**`는 §3-2 이후 발췌 대상이 아니지만 레거시 스캔 일관성 유지.

### 4-2. 렌더·CSS

5사이트 공통, callout 분기 옆에 신설. `.coach-block` + `.coach-important`/`.coach-caution`.

```
레이아웃  왼쪽 세로 바 0.25em(GitHub 규격) + 본문. 좌단은 본문 0에서 시작(들여쓰기 없음 —
          위치 강조는 '들여쓰기' 블록의 일이다). 상하 K1(1.1em / 11pt).
제목 줄   아이콘 + 라벨 워드("Important" / "Caution") — GitHub과 동일하게 색·600 굵기, 본문 위에 한 줄.
아이콘    Icons.tsx 신설 2종 (viewBox 24 · strokeWidth 1.8~2 · currentColor — 기존 규격.
          Important = 말풍선+느낌표(octicon report 계열), Caution = 팔각+느낌표(octicon stop 계열)).
          lucide·octicons 의존성은 추가하지 않는다 — 경로 직접 작성.
색 토큰   --coach-important: #6639ba;  --coach-caution: #a40e26;
```

**색 명암비 실측** (부록 A 산식, 구속 조건 = 카드 `#EDE6DA` — G1의 교훈: 임계값 인용 금지, 수치를 남긴다):

| 전경 | 클레이 `#F4EFE7` | **카드 `#EDE6DA`** | 공유 `#FEFDFB` | 백지 |
|---|---|---|---|---|
| GitHub 기본 Important `#8250df` | 4.41 | **4.07 ✗(텍스트 4.5 미달)** | 4.96 | 5.05 |
| **채택 `#6639ba`** (GitHub purple-700) | 6.42 | **5.92 ✓** | 7.22 | 7.34 |
| GitHub 기본 Caution `#cf222e` | 4.68 | **4.32 ✗** | 5.27 | 5.36 |
| **채택 `#a40e26`** (GitHub red-700) | 6.87 | **6.34 ✓** | 7.74 | 7.87 |

라벨 워드는 텍스트라 4.5:1이 기준 — GitHub light 기본값(600 계열)은 미달이라 **같은 팔레트의 700 계열로 승급**한다.
바·아이콘(비텍스트 3:1)도 같은 토큰 하나로 통일(토큰 2개로 끝).

- **톤**: 본문은 `.solution-tone`의 dim을 그대로 상속(코칭 블록은 신호를 테두리·색으로 이미 갖는다).
  본문 안 `**`도 평소처럼 동작. 라벨 워드·바·아이콘은 코칭 색 — 톤 불변("구조 신호는 톤 불변" — dot·rail과 같은 원칙).
- **인쇄**: 흑백 기준 — 바 `#000` 0.3mm + 라벨 워드 700. 컬러 인쇄 전환은 `--coach-*` 토큰 교체 1줄(G5 전례).
  `break-inside`는 걸지 않는다(코칭은 길 수 있다 — 경우 블록과 같은 판단). 제목 줄만 `break-after: avoid`.
- **경우 사이 개재 시**: `.case-gap`으로 rail 관통 — rail이 거터(-1.6em)에 있으므로 코칭 바(0em)와 겹치지 않는다(§1의 이득).
- **요약 보기**: 자동 포함 없음. `showInSummary` 스위치로만(구상 4-3) — 코드 추가 0 (스위치는 이미 범용).

---

## 5. 파일 좌표 일람 (`fdeac85` 기준)

```
# §1 레이아웃
app/globals.css:561-744          case 절 재작성 (좌표 토큰화 · 들여쓰기 철거 · outline-keys 삭제)
app/globals.css::root            --case-rail-x · --case-chevron-x 신설
components/print/PrintStyles.css:153-211  인쇄 case 절 재작성 (동일 원리)
lib/caseBlock.ts:155-165         caseGapClassName 단순화 (case-gap-body·GAP_MEDIA_TYPES 삭제)
components/problem/TabBody.tsx:29           LABEL_GAP 28 → 56
components/editor/EditorView.tsx:3345-3350  미리보기 폭·패딩·채널
components/share/ProblemTabContent.tsx      ContentCard 패딩
components/share/PublicViewerShell.tsx      2단 간격 (실측 후)
components/problem/FolderView.tsx:508-584   카드 패딩 + --case-rail-x override
components/problem/OutlineSections.tsx      case-gap 부착 로직(firstCase/lastCase) 삭제

# §2 명칭
components/editor/EditorView.tsx:86,93      BLOCK_TYPE_LABELS

# §3 강조·요약·톤
components/editor/UnifiedToolbar.tsx:798    버튼 title
lib/solutionOutline.ts                      keys 계열 삭제 · 레거시 스캔 축소
lib/keyTone.ts                              solutionHasKey·RE 2종 삭제 · toneClass 축소
app/globals.css:272-316                     톤 절 재작성 (.has-key 소멸 · 특이도 ⚠)
components/print/PrintStyles.css:48-50      복원 규칙 셀렉터
components/editor/EditorView.tsx:737,750    요약 스위치 — case 계열 제외 + 툴팁
components/ui/OutlineToggle.tsx:35-38       툴팁 3종

# §4 코칭
types/problem.ts:160                        union에 coach_important·coach_caution
components/editor/EditorView.tsx:82-136     라벨·TYPES·프리셋·TEXT_BASED·SPLITTABLE
components/ui/Icons.tsx                     아이콘 2종
app/globals.css                             .coach-block 절 + --coach-* 토큰
components/print/PrintStyles.css            인쇄 .coach-block
렌더 5사이트                                 callout 분기 옆 coach 분기 (EditorView:3439 근처 ·
                                            TabBody:141 · FolderView · ProblemTabContent · PrintableContent)
lib/solutionOutline.ts:55-57                SCANNED_TYPES에 2종

# 문서 (Stage 5)
docs/phasedocs/Phase59 …md                  R6 정정(§11-10·11-11 참조 정리) + 59a 확정본 신설
docs/phasedocs/사용 가이드 — 강조와 톤.md    §2·§3 반영 전면 개정
CLAUDE.md · docs/roadmap.md                 블록 타입·명칭·톤 기본값 갱신
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0** — Phase 59와 같은 순수 클라이언트 작업.

---

## 6. Stage 계획과 검증

**Stage 1 · 레이아웃 철거·거터 이설 (§1)** — 가장 파급이 크므로 먼저.
- 5사이트 × {경우 3+하위 2, 이어짓기, 개재 이미지·목록·글상자} 스케치 대조
- rail·dot·chevron 좌표 실측 / 4경계 레일 연속성 / 브리지 삐짐 0.0px 유지
- **클리핑**: FolderView 슬라이더 11/15/24 · 공유 카드 · 인쇄 multicol(**Q4**) — overflow 경계마다 rail 생존 확인
- 여백 판정: ProblemView 라벨↔rail↔본문 / EditorView 채널 / 공유 2단 (덕수 육안 — 구상 1-2-4의 "답답하지 않게")
- **Q1 판정 카드**: 들여쓰기 없는 하위 경우가 dot 크기+라벨만으로 구별되는가
- 회귀: 최상위 수식 3em·리스트·① 좌표 무변화 / F1 형제 인접성 / Phase 56 스크롤(getBoundingClientRect 기반이라 무영향 예상)

**Stage 2 · 명칭 (§2)** — 드롭다운·상단바·전체접기 바에서 라벨 확인. 10분짜리 스테이지지만 문서 갱신과 묶는다.

**Stage 3 · 톤 기본화 + 요약 단순화 (§3)**
- `**` 없는 문항: 풀이 dim / 문제 탭 불변 / 인쇄 100% 복원
- `**` 있는 문항: 픽셀 대조 — has-key 시절과 **동일해야 한다** (기본화는 "없던 문항"만 바꾼다)
- 요약 보기: 발췌가 사라지고 제목·경우 제목행·선택 블록만 / 접힌 경우 = 제목행만 / 게이트 강제 해제 동작
- 특이도 ⚠ 항목: `.tone-baseline .katex` 동률 확인(DevTools computed) — 순서 의존 제거안 적용 여부 판정
- 레거시 `**Case n.**` 문항: 톤·요약 항목 승격 모두 현행과 동일

**Stage 4 · 코칭 블록 (§4)**
- 추가·저장·재로드·undo·⌘B 분할(뒤 블록 text) / 5사이트 렌더 / 흑백 인쇄
- 색 육안 판정(수치는 통과 상태로 착수) / dim 본문 위에서 라벨·바가 앞으로 나오는가
- 경우 사이 개재 시 rail 관통 + 바와의 간섭 없음

**Stage 5 · 통합·문서**
- roadmap · CLAUDE.md(블록 타입 2종 추가 · 톤 기본값 · '들여쓰기'/'글상자' 명칭 · 좌표 토큰) 
- 사용 가이드 전면 개정: "강조의 두 축" → **"위치(들여쓰기) · 색(강조) · 신호(코칭) · 요약(스위치)" 4분법**
- R6 문서 정정 · Phase 59 확정본에 "레이아웃 §4·§11-1~11-7은 59a로 대체" 표기
- `npm run test:case` 27개 재실행(라벨·이어짓기 로직 불변 — 통과 예상) + 필요시 outline 테스트에서 keys 단언 삭제

---

## 7. 확인 사항 — **전건 기본안 확정 (2026-08-20 덕수)**

재질의 없음. Stage 1 실물 판정에서 문제가 보이면 아래 폴백으로 그때 수정한다.

| # | 확정 내용 | 폴백 (문제 발견 시) |
|---|---|---|
| **Q1** | 하위 경우 위계는 **dot 크기(0.52/0.3em) + 라벨(C1/C1a)** 로 표현 — 들여쓰기 없음 | (a) 하위 dot을 rail 오른쪽 별도 열(-0.8em)로 (b) 하위 라벨 색 차등 |
| **Q2** | 코칭 라벨 워드는 영문 `Important`/`Caution` 유지 | 한글 전환은 라벨 상수 1곳 교체(구상 4-2-4의 예정된 여지) |
| **Q3** | EditorView 채널 32px·미리보기 패딩 48px로 착수 | Stage 1 육안 판정으로 수치만 조정 |
| **Q4** | 인쇄도 rail 음수 좌표(-1.2em)로 착수 | multicol에서 잘리면 인쇄만 "본문 1.2em 들임 + rail 0" 폴백 |

---

## 부록 A. 명암비 산식

Phase 59 부록 A와 동일(§4-2 표가 그 산식의 산출물). 구속 조건은 카드 `#EDE6DA`, 텍스트 4.5:1 · 비텍스트 3:1.

## 부록 B. 이 문서가 삭제를 명시한 것들 (요약)

케이스 들여쓰기 3/6/9em 전부 · `.case-gap-body` · 케이스 내부 ul/① override(!important 2건 포함) ·
`.outline-keys` · `extractKeySentences`·`kind:'keys'` · `solutionHasKey`·`KEY_STRONG_RE(+GLOBAL)` ·
`.has-key` 클래스 · case 계열의 '요약에 넣기' 스위치 · `caseGapClassName`의 타입 분기.

**삭제가 곧 이 Phase의 산출물이다** — Phase 59가 중도 수정으로 불린 표현 계층을, 데이터 계약은 건드리지 않고 걷어낸다.

## 부록 C. CLI 교차검토(v2) 요청 포인트

v1은 web에서 레포 클론 대조로 작성했다. v2는 다음을 **실측으로 판정**해 달라 (Phase 59 v2의 "정정 24건" 방식):

1. **행번호·좌표 전수 확인** — §5 파일 좌표 일람이 `fdeac85` 실물과 일치하는가. 특히 EditorView의
   미리보기 컨테이너(:3345-3350)·요약 스위치(:737·:750)·BLOCK_TYPE_LABELS(:86·:93), globals.css 절 경계(561-744 · 272-316).
2. **특이도 동률(§3-3 ⚠)** — `.solution-tone .katex` (0,2,0) vs `.tone-baseline .katex` (0,2,0). 권장안
   (`div.solution-tone .katex` 승급)의 부작용 유무. EditorView처럼 두 클래스가 다른 요소에 붙는 사이트 전수 확인.
3. **rail 클리핑 경로 전수** — `overflow: hidden|auto` 조상을 5사이트 + 요약 2뷰에서 실측(특히 FolderView 카드,
   공유 ContentCard, 인쇄 multicol). §1-4의 override 값(-1em)·패딩 값이 충분한가.
4. **거터 폭 산술** — LABEL_GAP 56px, 채널 32px, 카드 48px 제안값이 contentFontSize 11~24px 전 구간에서 버티는가
   (rail x는 em, 여백은 px — G8 계열의 단위 혼합 지점이 새로 생긴다).
5. **삭제 안전성** — `KEY_STRONG_RE`·`solutionHasKey`·`extractKeySentences`·`.outline-keys`·`case-gap-body`의
   소비처가 §5 목록 밖에 더 없는지 grep 전수. `tests/caseBlock.test.mjs`·`test:export`에 keys 단언이 있는지.
6. **코칭 블록 기계장치 누락** — 타입 2종 추가 시 스쳐 가는 상수·분기(normalizeBlockType·BORDERED_TYPES·
   전체접기 요약·proofread·exportMd·버전 diff·Undo 배선 등)에서 default 경로가 안전한가.
7. **명암비 재계산** — §4-2 표(부록 A 산식)와 코칭 색의 dim 본문(#675F52) 대비 시인성.
