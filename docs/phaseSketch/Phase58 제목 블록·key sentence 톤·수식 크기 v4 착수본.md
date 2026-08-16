# Phase 58 — 제목 블록 재조정 · key sentence 톤 시스템 · 수식/원문자 크기 완화 **v4 (착수본)**

작성일: 2026-08-16 · 작성: CLI Claude (v3 재검증 + T0 선행 수행)
**기준 커밋: `21e1e73`** ← v2·v3의 `f7c4a37`에서 이동. **Phase 55c 커밋 2건이 EditorView를 61줄 고쳐 좌표가 일부 드리프트했다**(§3-1).

**적용 순서: v2 본문 → v3 §4 갱신표 → 본 문서 §4 갱신표.** 뒤가 앞을 이긴다. v4에 언급 없는 항목은 v2·v3 그대로 유효하다.

> **v4 요약** — v3의 지적 5건 중 **4건을 승인**하고(E0·E2·E4·E5 원리·D14 문제 인식·T0·V1~V3), **E2는 v3가 옳고 v2가 틀렸음을 확인**했다(§2-1). 그 위에 **정정 4건**을 얹는다:
>
> - **F1 (가장 중요)** — **E1도 여전히 불완전하다.** 제목 상단 여백은 2항이 아니라 **3항**이다(앞 블록에서 이월된 마진이 빠졌다). 실제 체감 = **3.4~3.9em**이고 앞 블록 타입에 따라 변동한다. → **D2의 "현행 유지" 결론은 v2·v3 둘 다 틀렸다. 조정이 필요하다.**
> - **F2** — E5의 처방(제목 규칙 *삭제*)은 **A안에서만** 무해하다. B안 승격 시 같은 불일치가 반대 방향으로 재발한다 → 삭제 대신 **`--text-secondary`로 고정**.
> - **F3** — ⌘⇧B는 **Safari도 점유**한다(v3는 Chrome·Edge만). 기능은 버튼만으로 완결되므로 **기본값을 "단축키 미배정"으로** 낮춘다.
> - **F4** — D14의 처방(`.problem-content-toned` 부착)은 색 외에 **`letter-spacing: -0.01em`을 함께 들여와** 이미 공개된 페이지의 줄바꿈을 바꾼다 → **색 규칙만 분리**해서 붙인다.
>
> 그리고 **T0을 v4에서 이미 수행**했다(§3-1) — 좌표 드리프트 4건과 v3가 남긴 미측정 항목(공유뷰 카드 배경색)을 확정했다.

---

## 1. v3 검증 결과 — 승인

| v3 항목 | v4 검증 | 판정 |
|---|---|---|
| **E0** v1의 "목업에서 가짜 볼드를 봤다"는 관찰이 아니라 추정이었다 | 자기 정정. C6(`.katex{font:normal …}` shorthand가 weight 리셋)은 `node_modules/katex/dist/katex.min.css`에서 직접 확인한 사실이므로 결론 불변 | ✅ 승인 |
| **E2** 명암비 재계산 — v2 수치 오류 | **v3가 옳다. v2가 틀렸다** — §2-1에서 원인까지 규명 | ✅ 승인 (v2 정정) |
| **E4** 가이드 문구가 A안 실상과 불일치 | 정확한 지적. A안에서 비key 텍스트는 무변화이고, 실제로 변하는 건 "수식이 본문 톤으로 내려앉는 것" | ✅ 승인 |
| **E5** 제목 톤 규칙의 숨은 회귀 | **실코드 확인**: `EditorPreview.tsx:336·338·342`의 h1/h2/h3 인라인 style에 `color` 속성이 **없다** → 현재 제목은 `.problem-content-toned`의 `--text-secondary`를 상속한다. v2 규칙은 has-key 문항의 제목만 진하게 만들어 문항 간 불일치를 낳는다. **지적 타당** | ✅ 승인 (처방은 F2로 수정) |
| **D14** 공유뷰에 `.problem-content-toned`가 없어 톤 기준선이 다르다 | 실코드 확인 ✔. v2가 발견만 하고 처방을 비운 것도 사실 | ✅ 승인 (처방은 F4로 수정) |
| **T0** 좌표 재대조 Stage 신설 | **필요했다** — 실제로 드리프트가 있었다(§3-1). v4에서 선행 수행 | ✅ 승인·수행완료 |
| **V1** key 행 끝 `\tag{n}`은 dim으로 남는다 | `\tag` 자동 제외(툴바 규칙 2)의 논리적 귀결. 참조번호는 routine 메타데이터이므로 의도된 동작 | ✅ 승인 |
| **V2** D8 가이드는 공백 없는 `**$x=…$**`로 표기 | 표기 통일 타당. (덧붙임: 실제 제약은 `**` 바로 안쪽이 비공백이어야 한다는 CommonMark 규칙이고, 이건 툴바 규칙 2가 이미 강제한다) | ✅ 승인 |
| **V3** 워크플로우 기록 | v1(web) → v2(CLI 실측) → v3(web 재검증) → **v4(CLI T0+재정정)**. roadmap에 4단계로 기록 | ✅ 승인 |
| **E3** ⌘⇧B 브라우저 충돌 | **부분 승인** — 충돌은 사실이나 범위가 Chrome·Edge보다 넓다(F3) |  ⚠ F3 |
| **E1** D2 여백 산술 정정 | **부분 승인** — em 기준 지적은 옳으나 항이 하나 더 있다(F1) | ⚠ F1 |
| v2 승인분(C1·C2·C3구조·C4/D3'·C6·C7·C8·C9·D13 및 D1'~D12'') | v3의 승인을 재확인 | ✅ 유지 |

---

## 2. v2 정정 확인 (v3가 옳았던 것)

### 2-1. E2 승인 — v2 계산 오류의 원인

WCAG 상대휘도를 다시 계산했고 **v3 수치가 전부 맞다.** v2가 틀린 원인은 후보색 2종에서 `((c + 0.055) / 1.055)^2.4`의 **`/1.055`를 누락**하고 `(c + 0.055)^2.4`를 쓴 것이다. 토큰 2종(`#2D2A23`·`#5D5647`)은 제대로 계산해 v3와 일치했기 때문에 표 안에서만 불일치가 나 v2 시점에 잡히지 않았다.

**확정 명암비표** (v3 수치 + 공유뷰 배경 실측분 추가)

| 색 | `#F4EFE7`<br>편집 미리보기·ProblemView | `#EDE6DA`<br>FolderView 카드 | `#FEFDFB`<br>공유뷰 카드 *(v4 실측)* | 판정 |
|---|---|---|---|---|
| `--text-primary` `#2D2A23` | 12.51:1 | 11.54:1 | 14.08:1 | ✔ full |
| `--text-secondary` `#5D5647` | 6.35:1 | 5.86:1 | 7.15:1 | ✔ A안 dim |
| `#675F52` (B안) | 5.50:1 | **5.08:1** | 6.19:1 | ✔ 전 배경 통과, 여유 있음 |
| `#6b6a65` (v1안) | 4.73:1 | **4.37:1** | 5.33:1 | ✘ FolderView에서만 미달 |

- **구속 조건은 FolderView 카드 `#EDE6DA`** 하나다. 공유뷰는 셋 중 가장 밝아 D3 판정에 영향이 없다(v3 §3-1이 "미측정으로 남았으니 D3에 영향 줄 수 있다"고 우려한 항목 — **해소**).
- **dim↔full 명도 간격**: A안 `#5D5647`↔`#2D2A23` = **1.97:1** / B안 `#675F52`↔`#2D2A23` = **2.27:1**. B안이 15% 더 벌어진다.
- v3가 지적한 "dim이 두 종류로 보일 위험": `#675F52`↔`#5D5647` = **1.16:1**. 같은 화면에 `--text-secondary`를 쓰는 앱 크롬이 있으면 미묘한 두 회색이 공존한다 → B안 승격 시 확인 대상(T8').

**결론 불변**: A안(토큰 재사용) 채택 유지. 다만 v3 말대로 B안의 지위가 "예비"에서 **"주저 없이 승격 가능한 대안"**으로 올라간다.

### 2-2. E5 승인 — 실코드 확인

`EditorPreview.tsx:335-343`의 h1/h2/h3 인라인 style은 `fontSize`·`fontWeight`·`marginTop`·`marginBottom`·`lineHeight`(h2는 `paddingBottom`·`borderBottom` 추가)만 지정하고 **`color`가 없다.** 따라서 현재 제목은 `.problem-content-toned`의 `--text-secondary`를 상속한다 — v1의 "제목은 항상 풀 톤"이라는 전제 자체가 현행과 다르다. v2가 그 전제를 검증 없이 CSS로 옮긴 것이 E5다. 지적 타당.

---

## 3. v4 정정 (v3에 얹는 것)

### 3-0. F1 — E1도 불완전하다: 제목 상단 여백은 **3항**이다

v3의 E1은 "h2의 `margin: 1em`이 h2 자신의 font-size(1.3em) 기준"이라는 점을 옳게 잡았다. 그러나 **앞 블록에서 이월되는 마진이라는 세 번째 항이 빠졌다.**

**마진 상쇄 경로 (실코드 확인)**

앞 블록(text)의 마지막 `<p>`는 `.preview-content p { margin-bottom: 0.6em }`(globals 370-372)를 갖는다. 이 마진이 래퍼 밖으로 탈출하는지 확인했다:

| 통과해야 할 상자 | 상태 | 상쇄 차단 여부 |
|---|---|---|
| `.preview-content` div | padding·border·overflow 지정 없음 | 통과 |
| EditorPreview root div (`borderless`) | `padding: '0'` · `border: 'none'` · `overflow: 'visible'` · `height: '100%'` | 통과 — `height: 100%`는 부모 높이가 auto라 **계산값이 `auto`**가 되어(CSS 2.1 §10.5) 하단 마진 상쇄를 막지 못한다 |
| `<style>` 자식 요소 | UA 기본 `display: none` → 박스 미생성 | 무관 |
| 블록 래퍼 div (`[data-block-id]`) | heading이 아닌 블록은 padding 없음 | 통과 → 래퍼의 하단 마진이 된다 |

→ 앞 블록 래퍼는 **0.6em의 하단 마진을 갖고**, 다음(heading) 래퍼와 인접 형제 상쇄를 거쳐 그대로 남는다. heading 래퍼의 `paddingTop`은 padding이라 상쇄되지 않는다.

**현행 체감 상단 여백의 실제 구성**

```
[앞 블록 이월 마진]  +  [래퍼 paddingTop]  +  [h2 marginTop × h2 font-size]
     0.6em (text 뒤)        1.5em                 1em × 1.3 = 1.3em        = 3.4em
     1.1em (수식/리스트 뒤)  1.5em                                          = 3.9em
```

| | v2 주장 | v3 주장 | **v4 실측 구성** |
|---|---|---|---|
| 현행 체감 상단 | 2.5em | 2.8em | **3.4em (text 뒤) ~ 3.9em (display 수식·리스트 뒤)** |
| P1 적용 후 (h2 1.08em) | — | 2.58em | **3.18em ~ 3.68em** |
| D2 목표 | 2.4em | 2.4em | 2.4em |

**두 가지 귀결**

1. **D2의 "현행 유지" 결론은 v2·v3 둘 다 틀렸다.** 현행은 목표의 1.4~1.6배다. 조정이 필요하다.
2. **"체감 위 2.4em"은 현재 구조에서 단일 값으로 성립하지 않는다** — 앞 블록 타입에 따라 0.5em이 오르내린다. 목표를 값 하나로 못 박으려면 구조를 바꿔야 한다.

(덧붙임: 위는 **박스 모델** 기준이다. 앞 `<p>`의 `line-height: 1.8`과 h2의 `lineHeight: 1.4`가 만드는 half-leading이 잉크 대 잉크 간격을 더 벌린다 — 앞 p 하단 +0.4em, h2 상단 +0.13em 안팎. **최종 수치는 반드시 DevTools 실측으로 정한다**(T1''). CLAUDE.md의 "여백을 논하기 전에 기준선을 실측할 것"이 바로 이 함정이다.)

**처방 — 두 옵션 (덕수 판정 Q3)**

**옵션 A (권장, 저위험)** — `paddingTop`만 축소.

```
5개 사이트의  '1.5em'  →  '0.5em'
결과: text 뒤 0.6+0.5+1.08 = 2.18em / 수식 뒤 1.1+0.5+1.08 = 2.68em  (평균 ≈ 목표)
```
- 변동폭 ±0.25em이 남지만 지각 한계 근처다.
- `[data-block-id]` 래퍼의 박스 경계가 바뀌지 않아 **Phase 56 스크롤 앵커에 무영향**.

**옵션 B (정확, 중위험)** — `paddingTop` → `marginTop` 전환.

```
5개 사이트:  style={{ paddingTop: headingTopPad }}  →  style={{ marginTop: headingTopPad }}
             '1.5em' → '2.4em'
결과: 래퍼 marginTop·h2 marginTop·앞 블록 이월 마진이 하나로 상쇄되어
      gap = max(0.6~1.1, 2.4, 1.08×1) = 2.4em  — 앞 블록 타입과 무관하게 정확히 일정
```
- ⚠ **Phase 56 결합**: `[data-block-id]` 래퍼는 `computeBlockAwareScrollTop`(lib/editorScroll.ts:50-67)의 스크롤 앵커다. `blockRect.top`이 1.5em 아래로 이동해 **제목 블록으로 스크롤할 때의 정착 위치가 바뀐다**(현재는 빈 padding 1.5em이 상단에 남는다 — 개선일 수도 있으나 회귀 검증 필요). 메모리 `project_known_bug_math_click_scroll`이 가리키는 영역이다.
- 상쇄가 성립하려면 래퍼에 border·padding이 없어야 한다 — heading 블록 래퍼는 조건이 맞다.

→ **v4 권고는 A.** 목표 정확도보다 Phase 56 회귀 회피가 낫고, B는 여백 체계를 다시 손볼 때 묶어서 하는 편이 안전하다.

### 3-1. T0 — v4에서 선행 수행 (완료)

**① 기준 커밋 이동**: `f7c4a37` → **`21e1e73`**. 사이에 Phase 55c 2건(`ae908d7` 저장 아이콘 교체, `21e1e73` 상단바 순서 교환)이 들어와 `EditorView.tsx` 61줄 + `components/ui/Icons.tsx` 25줄이 바뀌었다.

**② 좌표 드리프트 — EditorView 미리보기 4개만 +7 이동**

| 항목 | v2 좌표 | **v4 확정** |
|---|---|---|
| `.scaled-preview … problem-content-toned` (톤 클래스 부착점) | 3183 | **3190** |
| `activeTab === 'question'` 조건부 래퍼 div | 3184 | **3191** |
| `const headingTopPad` | 3190 | **3197** |
| `<div data-block-id …>` | 3192 | **3199** |

**③ 좌표 불변 확인** — 나머지는 전부 그대로다: `EditorView.tsx` 116(`TEXT_BASED_TYPES`)·147(`buildMathIndex`)·2231/2244/2248/2252/2256(단축키) · `EditorPreview.tsx` 338(h2) · `globals.css` 27(`@font-face`)·101(Weights 주석)·108(`--katex-scale: 1.15em`) · `UnifiedToolbar.tsx` 22/23/35(`ICON_SIZE`/`SVG_PROPS`/`CORNER_BRACKETS`) · `ProblemView.tsx` 326/399/694/742 · `FolderView.tsx` 246/300/557 · `ProblemTabContent.tsx` 19/67 · `PrintableContent.tsx` 58.

**④ v3가 남긴 미측정 항목 — 공유뷰 카드 배경색**: `PublicViewerShell.tsx:130` `background: 'var(--bg-card, #fff)'` = **`#FEFDFB`**. 명암비는 §2-1 표에 반영했고 **D3 판정에 영향 없다**(세 배경 중 가장 관대).

**⑤ Stage 0 존치 범위 축소**: 위 ①~④로 T0의 실질은 끝났다. 착수 시점에는 `git log f7c4a37..HEAD --stat`로 **추가 드리프트만 확인**하면 된다(EditorView는 최근 변경이 잦으므로 미리보기 좌표를 다시 볼 것).

### 3-2. F2 — E5 처방 수정: 삭제가 아니라 `--text-secondary`로 고정

v3는 `.solution-tone.has-key h1,h2,h3 { color: primary }` 규칙을 **삭제**하자고 했다. A안(dim = `--text-secondary`)에서는 옳다 — 제목이 dim을 상속해도 값이 현행과 같으므로 no-op이다.

**그러나 B안(`--tone-dim: #675F52`)으로 승격하면 같은 불일치가 반대 방향으로 재발한다.** `#675F52`(L=0.117)는 `#5D5647`(L=0.094)보다 **밝으므로**, has-key 문항의 제목만 흐려진다. E5가 지적한 "문항 간 제목 불일치"가 그대로 돌아온다.

**처방**: 규칙을 지우지 말고 **고정값을 바꾼다.**

```css
/* E5+F2 — 제목은 has-key 여부·dim 값과 무관하게 현행 색(secondary)에 고정.
   A안에서는 상속과 동일한 no-op, B안에서는 제목만 dim을 따라가지 않게 하는 가드. */
.solution-tone.has-key h1,
.solution-tone.has-key h2,
.solution-tone.has-key h3 { color: var(--text-secondary); }
```

E5의 의도("진한 것은 key뿐" + 문항 간 제목 일치)를 A·B 양쪽에서 지킨다. 비용은 CSS 3줄이다.

### 3-3. F3 — ⌘⇧B는 Safari도 점유. 단축키를 필수에서 내린다

- **점유 실태**: Chrome·Edge = 북마크바 토글, **Safari = 즐겨찾기 바 토글(View ▸ Show Favorites Bar)**. v3는 Chrome·Edge만 적었으나 **주요 3 브라우저가 전부 ⌘⇧B를 쓴다.**
- 브라우저 메뉴 액셀러레이터를 `preventDefault`로 이길 수 있는지는 브라우저·OS·버전 조합마다 다르다. 실패 모드가 "강조 대신 북마크바가 열린다"라서, 실패해도 조용하지 않고 매번 거슬린다.
- **기능은 툴바 버튼만으로 완결된다.** 단축키는 편의 기능이지 요건이 아니다.

**처방**: 기본값을 **"단축키 미배정"**으로 낮춘다. Stage 5는 버튼까지만 구현하고, T10'에서 ⌘⇧B 가로채기가 Chrome·Safari **양쪽에서** 성공하면 그때 배정한다. 실패 시 대체 후보 **⌘⇧K**(Chrome·Safari 무충돌, Firefox 웹 콘솔과만 충돌 — Mathory 주 대상 브라우저가 아니다). 어느 쪽이든 등록은 CLAUDE.md 규칙대로 `e.code === 'KeyB'` / `'KeyK'`.

### 3-4. F4 — D14 처방 수정: `.problem-content-toned` 통째 부착 금지, 색만 분리

v3는 공유뷰 컨테이너에 `.problem-content-toned`를 붙이자고 했다. 그 클래스가 무엇을 들여오는지 실측했다(globals 190-197):

| 선언 | 공유뷰 현행 | 부착 시 변화 |
|---|---|---|
| `line-height: 1.8` | EditorPreview root가 이미 `lineHeight: '1.8'` 지정 | 없음 |
| `font-family: var(--font-ui)` | EditorPreview root가 이미 지정 | 없음 |
| `font-weight: var(--weight-regular)` | 기본 400 | 없음 |
| **`letter-spacing: -0.01em`** | 미지정(기본 normal) | **자간 축소 → 줄바꿈 위치 변경** |
| `color: var(--text-secondary)` / `.katex → primary` | 둘 다 primary | **의도한 변화** |

→ 클래스를 통째로 붙이면 **이미 공개된 페이지의 줄바꿈이 바뀐다.** 색 기준선만 맞추는 것이 D14의 목적이므로 색만 떼어 쓴다.

```css
/* globals.css — 색 기준선만 담는 클래스를 신설하고, 기존 클래스가 이를 포함하게 한다 */
.tone-baseline        { color: var(--text-secondary); }
.tone-baseline .katex { color: var(--text-primary); }

/* .problem-content-toned에서 색 2줄을 제거하고 마크업에서 두 클래스를 병기하거나,
   더 간단히 아래 한 줄로 기존 클래스가 새 규칙을 물려받게 한다. */
.problem-content-toned { /* line-height·letter-spacing·font-* 만 유지 */ }
```

마크업: `ProblemTabContent`의 컨테이너에 `className="tone-baseline"` (+ D9 스코프면 `solution-tone`·`has-key`). 5개 사이트는 `tone-baseline`을 공통으로 갖게 되어 **톤 기준선이 하나가 된다.**

⚠ 그래도 **공유뷰 전 문항의 본문색이 primary → secondary로 일괄 변경**되는 것은 남는다(D14의 본래 취지). 이미 공개된 페이지의 시각 변화이므로 T17에서 육안 확인 후 배포한다 — v3의 Q2 그대로.

---

## 4. 최종 갱신표 (v2 §2 · v3 §4 대비 변경분만)

| # | 항목 | v4 확정 | 출처 |
|---|---|---|---|
| **D2** | 제목 여백 | **"현행 유지" 폐기.** 현행 체감 상단 = 3.4~3.9em(3항 구성)으로 목표 2.4em의 1.4~1.6배 → **조정 필요.** 권고 = 옵션 A(`paddingTop` 1.5em → **0.5em**, 5개 사이트). 값은 T1'' DevTools 실측 후 확정 | **F1** |
| **D2'** | 여백 구조 | 옵션 B(`paddingTop` → `marginTop` 전환, 정확히 2.4em 고정)는 `[data-block-id]` 래퍼가 Phase 56 스크롤 앵커라 **회귀 위험** → 별건으로 보류 | **F1** · Q3 |
| **D3** | 톤 값 | A안 유지. **명암비표를 §2-1로 교체**(공유뷰 `#FEFDFB` 추가). B안 `#675F52`는 전 배경 통과·간격 2.27:1로 **즉시 승격 가능한 대안** | E2 · v4 실측 |
| **D9** | 제목 처리 | v3의 "규칙 삭제" → **`color: var(--text-secondary)`로 고정**(A안 no-op, B안 가드) | **F2** |
| **D14** | 공유뷰 기준선 | `.problem-content-toned` 통째 부착 **금지**. **`.tone-baseline`(색 2줄) 신설**해 5개 사이트 공유 | **F4** |
| **D7** | 단축키 | ⌘⇧B는 **Chrome·Edge·Safari 3사 전부 점유**. 기본값을 **"단축키 미배정"**으로. T10' 통과 시에만 배정, 대체 후보 ⌘⇧K | **F3** |
| **기준 커밋** | — | `f7c4a37` → **`21e1e73`**. EditorView 미리보기 좌표 4건 +7 이동(§3-1) | **T0** |
| Stage | 구현 순서 | Stage 0(T0)은 **v4에서 수행 완료** → 착수 시 추가 드리프트만 재확인. 이후 v2 Stage 1~6 그대로 | T0 |

### P2 CSS 최종형 (v3 §4의 CSS를 이것으로 교체)

```css
/* ═══ globals.css ═══ */

/* 톤 기준선 — 5개 렌더 사이트 공통 (D14/F4). 색만 담는다. */
.tone-baseline        { color: var(--text-secondary); }
.tone-baseline .katex { color: var(--text-primary); }

/* 톤 낮추기 — has-key일 때만 발동 (D4) */
.solution-tone.has-key       { color: var(--tone-dim, var(--text-secondary)); }
.solution-tone.has-key .katex { color: var(--tone-dim, var(--text-secondary)); }  /* D3' — 명시 color 덮기 */

/* key 복귀 — 인라인 `**` 하나뿐 (D13) */
.solution-tone.has-key strong,
.solution-tone.has-key strong .katex { color: var(--text-primary); }

/* D5 — 화면에서는 색으로만 구분 */
.solution-tone.has-key strong { font-weight: inherit; }

/* E5+F2 — 제목은 has-key 여부·dim 값과 무관하게 현행 색에 고정 */
.solution-tone.has-key h1,
.solution-tone.has-key h2,
.solution-tone.has-key h3 { color: var(--text-secondary); }
```

```css
/* ═══ PrintStyles.css — v2·v3 그대로 ═══ */
.print-body .solution-tone.has-key,
.print-body .solution-tone.has-key .katex { color: inherit; }
.print-body .solution-tone.has-key strong { font-weight: 700; }
```

**특이도 검산**: `.solution-tone.has-key strong .katex`(0,3,1) > `.solution-tone.has-key .katex`(0,3,0) > `.tone-baseline .katex`(0,2,0) ✔. 제목 규칙(0,3,0)은 `.solution-tone.has-key`(0,2,0)를 이긴다 ✔.

---

## 5. 검증 체크리스트 증분 (v2 §5 + v3 §5 + 아래)

| # | 항목 |
|---|---|
| **T1''** *(F1 — v3 T1' 대체)* | **제목 여백 실측이 값 결정보다 먼저다.** DevTools로 ① 앞 블록 타입별(text / display 수식 / 리스트 / ① 밭) 제목 상단 실간격을 각각 측정 ② 3항 구성(이월 마진·래퍼 padding·h2 마진)이 예측과 맞는지 확인 ③ 그 위에서 `paddingTop` 값을 역산. **측정 없이 0.5em을 확정하지 말 것** |
| **T8''** *(E2 — v3 T8' 대체)* | 세 배경(`#F4EFE7`·`#EDE6DA`·`#FEFDFB`) 전부에서 dim 4.5:1 이상 도구 측정 + dim↔full 지각 확인. **B안 승격 검토 시**: `#675F52`가 같은 화면의 `--text-secondary` 앱 크롬과 두 종류 회색으로 보이지 않는지(1.16:1) |
| **T8'''** *(F2)* | has-key 문항과 비has-key 문항의 **제목 색이 동일**한지(양쪽 다 secondary). B안 승격 시에도 유지되는지 |
| **T10''** *(F3 — v3 T10' 대체)* | 툴바 **버튼만으로** 전 기능 동작(단축키 없이). 그 다음 별건으로 Chrome·Safari에서 ⌘⇧B 가로채기 성공 여부 — 실패하면 배정하지 않거나 ⌘⇧K로 |
| **T17'** *(F4 — v3 T17 대체)* | `.tone-baseline` 부착 후 공유뷰: ① 색 기준선이 앱 열람뷰와 동일 ② **`letter-spacing`이 바뀌지 않아 줄바꿈 위치가 보존**되는지(부착 전후 스크린샷 대조) ③ 기존 공개 문항의 본문색 일괄 변화 육안 승인 |
| **T0'** *(축소)* | 착수 시 `git log 21e1e73..HEAD --stat -- components/ app/ lib/` 로 추가 드리프트만 확인. EditorView 미리보기 좌표는 특히 재확인 |

---

## 6. 미결 확인 사항 (덕수)

| # | 질문 | 기본값 (무응답 시) |
|---|---|---|
| **Q3** *(신규·F1)* | 제목 상단 여백 처방: **옵션 A**(`paddingTop` 1.5em→0.5em, 앞 블록 타입에 따라 ±0.25em 변동 잔존, Phase 56 스크롤 무영향) vs **옵션 B**(`paddingTop`→`marginTop` 전환, 정확히 2.4em 고정, 스크롤 앵커 이동) | **옵션 A** — 정확도보다 Phase 56 회귀 회피 우선. B는 여백 체계 재정비 시 별건으로 |
| Q1 *(v3)* | 제목 톤 처리 | **v4형 채택** — 삭제가 아니라 `--text-secondary` 고정(F2). v3 의도 유지 + B안 대비 |
| Q2 *(v3)* | D14 공유뷰 기준선 통일(공개 문항 본문색 일괄 변화) 수용? | **수용** — 단 F4대로 색만 분리해 자간 변화 없이. T17' 육안 확인 후 배포 |

이 3건 외에는 미결이 없다. 확정 시 **v2 본문 + v3 §4 + v4 §4가 착수 기준**이 된다.

---

## 7. 워크플로우 기록 (V3)

| 판 | 작성 | 기여 |
|---|---|---|
| v1 | web | 목업·디자인 방향 확정(D1·D2·D4~D9), P6 A안 착상 |
| v2 | CLI | 실측 9건(C1~C9)으로 사실관계 정정, D13 반영, P6 분리 판정, Stage 표 |
| v3 | web | v2 재검증 — **E2 명암비 오류 적발**, E1 em 기준 지적, **E5 숨은 회귀 적발**, D14·T0 보강 |
| **v4** | **CLI** | **T0 선행 수행(커밋·좌표 드리프트·공유뷰 배경 확정)**, F1(여백 3항 구성 — v2·v3 공통 오류), F2·F3·F4 처방 수정 |

교차검증이 실제로 작동한 사례다: v2가 v1의 사실관계를, v3가 v2의 계산을, v4가 v3의 산술 범위를 각각 잡았다. **각 판이 앞 판의 오류를 하나씩 남긴 채 넘어갔다는 점**이 기록의 요점 — 값·산술·좌표는 반드시 실측 주체가 검증할 것.
