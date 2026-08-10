# Phase 56 — 편집창·미리보기 수식 세로 중앙 정렬 통일 + 상단 밀림 근본 대책 **v3 (최종)**

작성일: 2026-08-10 · 작성: web Claude (Fable) — CLI Claude(Opus 5) v2를 재검토 · 기준 커밋: **`ea14751`**

> **v3 개정 요약** — v2를 원 저자(web Claude)가 독립 재검증했다. **v2의 D0 실측과 버그1 원인 확정(`paddingBottom:'100vh'` + border-box)은 인과 사슬 전 단계를 실코드로 재확인하여 승인한다** — v1의 D1(`clip`)/D2(content-frame 가드) 폐기 판정도 수용한다. v2의 정정 4건(D3'·D5'·D8'·D11)과 신규 D12도 모두 타당하여 채택한다. 여기에 v3는 다음을 더한다:
>
> - **정정 2건**: **E1** §1-1(e)의 "찾기/바꾸기가 `scrollToPos`로 CM `scrollIntoView`를 디스패치한다"는 주장은 오류 — `scrollToPos`는 **호출부가 0곳인 죽은 코드**다(§2-1). **E2** D8' 스니펫에 `hasFocus()` 가드 누락 — D3'가 `docChanged`를 통과시키므로 비포커스 블록의 프로그램적 문서 변경(교정 자동수정·블록 분할 등)이 typewriter 스크롤을 오발화시킨다(§2-2).
> - **보강 4건**: **D2″** 칼럼 세로 변위 안전망(원인 수정과 별개의 불변식 강제 장치 — 사용자 요구사항 "재발 방지 근본 대책"의 직접 대응, §3-1), **D5″** 클램프 정책의 **양쪽 대칭화**(편집창만 클램프하면 사용자가 신고한 "제각각"이 그 지점에서 재현된다, §3-2), **D13** `scrollToPos` 제거(§3-3), **D14** `fastScrollTo` 경합 취소(§3-4).
> - **행동 변화 명시 1건**: D3' 채택 시 찾기/바꾸기 내비게이션이 더 이상 `activeMathId`(미리보기 수식 하이라이트)를 갱신하지 않게 됨 — 의도된 변화로 승인하되 문서화·검증 필수(§2-3).
>
> 이하 §1은 v2 승인 근거(v3 독립 검증표), §2는 v2 정정, §3은 보강, **§4는 구현자가 이것만 보면 되는 최종 결정 통합표**다.

---

## 1. v2 검증 결과 — 승인 (v3 독립 재검증 완료)

v3는 원격 저장소를 `ea14751`로 체크아웃하여 v2의 주장을 코드로 재확인했다:

| v2 주장 | v3 검증 | 판정 |
|---|---|---|
| 전역 `box-sizing: border-box` 존재 (D0 인과의 전제) | `app/globals.css:100-101` `* { box-sizing: border-box }` 확인 | ✅ |
| 편집 패널 `paddingBottom:'100vh'` | EV:2886 `padding:'8px 16px', paddingBottom:'100vh'` 확인 | ✅ |
| 미리보기 패널 동일 잠복 | EV:2951 `padding:'20px 32px 100vh 32px'` 확인 | ✅ |
| border-box에서 사용 높이는 패딩 합 미만 불가 → 패널 최소높이 `8px+100vh` 고정 → `overflow:hidden` 좌측 칼럼(EV:2874-2877 확인)에 상시 세로 틈 | CSS 명세상 정확 (content 높이는 0으로 바닥, border-box height는 패딩 합으로 플로어). **vOver = paddingTop + 상단 크롬 높이** 공식도 자체 유도로 일치 | ✅ |
| CM `scrollRectIntoView`는 overflow 스타일 무관하게 `scrollHeight>clientHeight`인 조상을 스크롤 / `scrollHeight<=clientHeight`면 세로 대입은 브라우저 클램프로 no-op | `@codemirror/view` dist 소스로 v1에서 이미 확인 + 클램프 규칙 정확 → **v1의 "가로 overflow만으로 세로 밀림" 논거 폐기 수용** | ✅ |
| CM `focus()`는 `focusPreventScroll`로 안전 | v1 검토 시점에 동일 확인 — 수용 | ✅ |
| `dad2588` IME composing 가드 존재 | ME:258-261 `view.composing` 가드 확인 | ✅ |
| `tsconfig strict:false` (타입 3중 불일치가 조용히 통과하는 이유) | tsconfig.json:11 확인 | ✅ |
| CM 래퍼 4번째 hidden 조상 (ME:834-843) + `autoHeight` 미전달 | 코드 확인 (D0 결과 범인 아님 — 목록 완전성용) | ✅ |
| §0-2 줄번호 시프트 표 | 표본 대조 (updateListener ME:668-679, 좌측 칼럼 EV:2874-2877, EV:225 불변식 주석 등) 일치 | ✅ |
| D3'·D5'·D8'·D11·D12, R8·R9, 구현 순서(버그1 최우선) | 논리 검토 — 전부 타당 | ✅ 채택 |

**v1 저자로서의 자기 정정**: v1 §2-1은 "CM이 hidden 조상을 민다"는 메커니즘 층위는 맞았으나, **세로 overflow가 왜 존재하는지**(패딩 플로어)를 특정하지 못한 채 트리거 후보(가로 스크롤바·팝업)를 잘못 짚었고, 따라서 처방(D1/D2)이 원인이 아닌 집행 층위를 겨냥했다. v2의 D0 실측 설계(범인 단정 → 수정안 A/B 검증)가 올바른 방법론이었다. 특히 **"창 높이를 바꿔도 밀림 폭이 일정"하다는 실측이 100vh 패딩 가설의 결정적 증거**다(팝업·스크롤바 가설로는 설명 불가).

---

## 2. v2 정정 (v3에서 바로잡음)

### 2-1. E1 — §1-1(e) "찾기/바꾸기가 `scrollToPos`를 디스패치" 는 오류

`ea14751` 전수 grep 결과 `scrollToPos`의 **호출부는 0곳**이다 (정의 ME:391-397과 인터페이스 ME:55뿐). `FindReplacePanel.tsx:149-157`은 `handle.setSelection(match)` 후 **`.scaled-editor`를 수동 스크롤**한다(Phase 18 교훈 그대로). 따라서:

- 버그1 재현 시나리오에서 "찾기/바꾸기 이동" 경로는 `EditorView.scrollIntoView` 디스패치가 **아니라**, `setSelection` dispatch에 CM이 `scrollIntoView`를 붙이는지 여부의 문제인데, **프로그램적 dispatch는 `scrollIntoView: true`를 명시하지 않는 한 CM이 자체 스크롤하지 않는다.** 재현 트리거는 사실상 **타이핑 단일 경로**로 좁혀진다 (v2 §1-0 실측과도 부합 — 하니스 트리거도 타이핑).
- 단, 죽은 코드 `scrollToPos`는 코드베이스 불변식("CM 내부 scrollIntoView 금지")과 정면 모순되는 **장전된 함정**이므로 이번에 제거한다 → **D13**(§3-3).

### 2-2. E2 — D8' 스니펫에 `hasFocus()` 가드 누락

D3'는 게이트를 `hasFocus() || docChanged`로 완화한다. 그 결과 **비포커스 에디터의 프로그램적 문서 변경**(교정 자동수정 `replaceRange`, 블록 분할 `setContent`, 찾기/바꾸기 치환)도 `handleCursorActivity` 본문에 진입하고, v2의 D8' 스니펫은 `isComposing()`만 검사하므로 — 해당 블록 커서가 우연히 패널 하단 임계 안에 있으면 **사용자가 타이핑하지 않았는데 typewriter 스크롤이 발화**한다. 수정: D8' 첫머리에 `if (!ref.hasFocus()) return;` 추가 (typewriter는 정의상 "사용자 타이핑" 전용). → §4 D8″ 최종 스니펫에 반영.

### 2-3. D3' 채택에 따른 행동 변화 1건 — 명시 승인 필요

현재는 찾기/바꾸기로 매치를 이동할 때 `setSelection`이 cursorActivity를 발화시켜 `activeMathId`가 따라 움직인다(= 매치가 수식이면 미리보기 하이라이트도 이동). **D3' 이후에는 검색 입력창이 포커스를 갖고 있으므로 이 dispatch가 차단**되어, 검색 내비게이션 중 미리보기 수식 하이라이트가 더 이상 따라오지 않는다. 검색은 자체 하이라이트 체계(`search-highlight.ts`)와 수동 스크롤을 갖고 있으므로 **v3는 이를 수용 가능한 의도된 변화로 판정**한다. 다만 덕수 확인 필요 + T15에 명시(§6). 원한다면 후속에서 FindReplacePanel이 매치의 mathId를 계산해 콜백으로 전달하는 확장이 가능하다(본 Phase 범위 밖).

---

## 3. v3 보강 (신규 결정)

### 3-1. D2″ — 칼럼 세로 변위 안전망 (v2의 "가드 불필요" 판정에 대한 이견)

v2는 D1'(scroll 가드)를 "대증요법"으로 폐기했다. **원인 수정(D1″)이 처방이라는 데는 동의**하지만, 이 버그의 역사는 "서로 다른 원인이 같은 증상(숨은 조상 영구 변위)으로 세 번 발현"이었고 사용자 요구사항이 명시적으로 **"재발 방지를 위한 근본적인 대책"**이다. 원인 하나를 제거해도 **불변식 자체("좌·우 칼럼과 content-frame은 세로로 스크롤되어서는 안 된다")를 강제하는 장치**는 코드에 없다 — 미래의 어떤 자식이든 칼럼에 세로 overflow를 다시 만들면(새 패널·오버레이·또 다른 100vh류 패딩) 동일 증상이 조용히 재발한다.

**D2″**: 좌측 칼럼·미리보기 칼럼·content-frame에 scroll 리스너를 달아 `scrollTop !== 0`이면 **즉시 0 복원 + 개발 모드에서 `console.warn`**(요소·scrollTop·scrollHeight-clientHeight 출력). 성격 규정: **수정이 아니라 불변식 집행 장치(tripwire)**다.

- 비용: 이 요소들은 사용자 스크롤이 불가능하므로 정상 상태에서 scroll 이벤트가 **한 번도 발생하지 않는다** — 상시 비용 0. D1″가 옳다면 영원히 침묵하고, 침묵하지 않는 날이 오면 그것이 곧 회귀 경보다.
- 렌더링 리스크: 리스너는 레이아웃에 관여하지 않음 — v2가 `clip` 전환에 대해 우려한 회귀 리스크와 무관.
- 발화 시 1프레임 흔들림 가능성은 영구 변위 대비 무해.

### 3-2. D5″ — 클램프 정책의 양쪽 대칭화 (v2 D5'의 편집창 단독 클램프는 불충분)

v2 D5'(블록이 패널에 들어오면 상단 가시성 우선, 넘치면 중앙)는 편집창 **한쪽에만** 적용된다. 그러면 "패널보다 작지만 절반보다 큰 블록의 상단부 수식"을 클릭했을 때 **편집창은 클램프(수식이 중앙 아님), 미리보기는 무조건 중앙** — 사용자가 신고한 바로 그 "제각각"이 이 지점에서 재현된다.

**D5″**: `scrollPreviewToMathCenter`에도 **동일한 규칙을 미러링**한다 — 미리보기 블록 요소(`[data-block-id]`)가 미리보기 패널에 들어오면 `min(수식중앙, 블록상단-8)`로 클램프, 넘치면 중앙. 양쪽이 같은 정책("블록이 화면에 들어오면 블록 처음부터 보여주고, 큰 블록이면 수식을 중앙에")을 따르므로 지각되는 동작이 일관된다. 편집창 블록과 미리보기 블록의 높이가 달라 경계 사례에서 완전 동일 픽셀은 아니지만(원리적 한계 — R7과 함께 문서화), 정책 불일치로 인한 발산은 사라진다.

### 3-3. D13 — `scrollToPos` 제거

호출부 0곳 + `EditorView.scrollIntoView(pos, {y:'center'})` 디스패치는 코드베이스 불변식과 모순. 인터페이스(ME:55)와 구현(ME:391-397)을 삭제한다. (되살릴 일이 생기면 그때는 `.scaled-editor` 수동 스크롤로 재작성해야 함을 주석 대신 본 Phase 문서가 증언한다.)

### 3-4. D14 — `fastScrollTo` 경합 취소

`fastScrollTo`(EV:200-214)는 rAF 루프 애니메이션이지만 **취소 장치가 없다**. 본 Phase로 스크롤 호출 지점이 늘어나(클릭 중앙 정렬 + typewriter) 두 애니메이션이 같은 컨테이너에 겹치면 프레임마다 서로 다른 보간값을 쓰는 **지터**가 생긴다. 컨테이너별 세대 카운터(WeakMap)로 새 호출이 이전 루프를 무효화하게 한다 (5줄 내외):

```tsx
const scrollGen = new WeakMap<HTMLElement, number>();
function fastScrollTo(container: HTMLElement, top: number, duration = 220) {
  const gen = (scrollGen.get(container) ?? 0) + 1;
  scrollGen.set(container, gen);
  // ... 기존 로직, step 안에서:
  //   if (scrollGen.get(container) !== gen) return;  // 새 호출이 오면 이 루프 중단
}
```

추가로 typewriter(D8″)와 fastScrollTo의 시작값 캡처 경합을 피하기 위해, **D8″ 호출을 rAF 안에서 실행**한다 — CM 자체의 최소 가시화 스크롤이 같은 틱에서 먼저 반영된 뒤 시작값을 캡처하게 되어 1프레임 되돌림 점프가 사라지고, 이것이 v2 R8이 요구한 rAF 스로틀 지점도 겸한다.

---

## 4. 최종 결정 통합표 (구현 기준 — 이 표가 v1·v2를 대체한다)

| # | 결정 | 내용 | 출처 |
|---|---|---|---|
| **D1″** | 버그1 확정 처방 | 편집 패널(EV:2886) `paddingBottom:'100vh'` 제거 → 내부 `maxWidth:'35em'` div(EV:2887)로 이관. 미리보기 패널(EV:2951) `100vh` → `20px`로 교체하고 내부 div(EV:2952)에 `paddingBottom:'100vh'` 부여 — 기존 조건부 스타일과는 `{ paddingBottom:'100vh', ...(activeTab==='question' ? {...} : {}) }` 병합으로 해결(새 래퍼 불필요). 회귀 방지 주석(v2 문안) 필수 | v2 (실측 검증) |
| **D2″** | 재발 방지 안전망 | 좌·우 칼럼 + content-frame에 scroll 리스너: `scrollTop→0` 복원 + dev `console.warn`. 불변식 집행 장치로서 채택 | v3 신규 |
| **D3'** | cursorActivity 게이트 | `if (!ref.hasFocus() && !info.docChanged) return;` — 선택만 바꾸는 비포커스 dispatch(=`clearSelection`, 버그2-2 원인)만 차단 | v2 |
| **D4** | activeMathId 명시 설정 | `handleBlockFocus`(클릭 지점 계산)·`handlePreviewMathClick`(전달값)에서 직접 `setActiveMathId`. `handlePreviewMathClick`은 `ref.focus()`를 `setSelection`보다 앞으로 (v1 §4-5 유지) | v1 |
| **D5″** | 수식 중앙 정렬 (대칭 클램프) | `computeMathCenterScrollTop`(v2 D5' 코드)을 편집창에, **동일 규칙 미러**를 미리보기에 적용. 세 클릭 경로(같은 블록/다른 블록/미리보기) 모두 이 쌍 사용. `computeBlockAwareScrollTop`은 그대로 존치 | v2+v3 |
| **D6** | 비수식 클릭 기존 동작 유지 | 같은 블록: 스크롤 없음 / 다른 블록: `scrollEditorToCursorCenter`+`scrollPreviewToBlockCenter` | v1 |
| **D7** | 클릭/키보드 구별 | `pointerSelect = update.transactions.some(tr => tr.isUserEvent('select.pointer'))` — 수식 중앙 정렬은 pointerSelect에서만 | v1 |
| **D8″** | typewriter (최종) | v2 D8' (발화선 하단 80px / 착지 45% / 260ms / `isComposing()` 가드) + **`hasFocus()` 가드 추가(E2)** + **rAF 내 실행(D14 연계)** | v2+v3 |
| **D9** | 단일 지점 주석 개정 | EV:225 주석: "일반 자동 스크롤은 `computeBlockAwareScrollTop`, 예외 2종(수식 클릭 대칭 정렬 `computeMathCenterScrollTop` / typewriter)은 각각 사유 명기" | v2 |
| **D10** | 저장 경로 불가침 | raw_text 저장 체인·Firestore 변경 없음 | v1 |
| **D11** | 순간 오하이라이트 방지 | `setActiveMathId`는 `info.blockId === activeBlockId`일 때만 (cross-block은 D4가 담당) | v2 |
| **D12** | 타입 통일 | `{line, offset, docChanged, pointerSelect, blockId}` 단일 타입 export, ME:32 / EV:747 / EV:910-911 3곳 공유. `MarkdownEditorHandle`에 `hasFocus()`·`isComposing()` 추가 | v2 |
| **D13** | `scrollToPos` 제거 | 호출부 0곳 + 불변식 모순 죽은 코드 삭제 (ME:55, 391-397) | v3 신규 |
| **D14** | fastScrollTo 경합 취소 | 세대 카운터로 이전 애니메이션 무효화 | v3 신규 |

폐기 확정: v1 D1(`clip` 전환)·D1'(대안 가드로서의)·D2(content-frame 원인 취급) — 단 D1'의 **기술 자체**는 D2″로 성격을 바꿔(원인 처방 → 불변식 집행) 부활했음을 명시한다.

### handleCursorActivity 최종 형태 (게이트 합성 순서)

```tsx
const handleCursorActivity = useCallback((info) => {
  const ref = editorRefs.current[info.blockId];
  if (!ref) return;
  if (!ref.hasFocus() && !info.docChanged) return;          // D3'
  const content = ref.getContent();
  const mathId = findMathIdAtCursor(buildMathIndex(content), info.offset);
  if (info.blockId === activeBlockId) {                     // D11
    setActiveMathId(mathId);
    setCursorInMath(isInsideMath(content, info.offset));
    if (info.pointerSelect && mathId >= 0) {                // D5″·D7 (같은 블록 수식 클릭)
      scrollEditorToMathCenter(info.blockId);
      scrollPreviewToMathCenter(info.blockId, mathId);
    }
  }
  if (info.docChanged) maybeRecenterOnBottomTyping(info.blockId);  // D8″ (내부에서 hasFocus·isComposing 검사)
}, [activeBlockId, /* 헬퍼들 */]);
```

---

## 5. 구현 순서 (v2 유지 + v3 반영)

1. **D1″ + D2″** — 버그1 처방 + 안전망. 독립 커밋. (v2 판단대로 최우선 — 가장 작고 가장 안전)
2. **D12 + D13** — 타입 통일, `hasFocus()`/`isComposing()` 추가, `pointerSelect` 계산, `scrollToPos` 제거. 독립 커밋.
3. **D3' + D4 + D11** — 버그2-2. 독립 커밋.
4. **D5″ + D6 + D7 + D14** — 버그2-1 정책 통일 + 경합 취소. 독립 커밋.
5. **D8″** — typewriter. 독립 커밋.
6. 문서 갱신(§7).

---

## 6. 검증 체크리스트

v1 T1~T11 + v2 T12~T18 유지, 다음을 수정·추가:

| # | 항목 |
|---|---|
| T12-c *(신규)* | **D2″ 침묵 확인**: 정상 사용(타이핑·클릭·검색·탭 전환·창 리사이즈) 중 dev 콘솔에 D2″ 경고가 **0건** — 경고가 나오면 D1″가 놓친 원인이 있다는 뜻이므로 즉시 조사 |
| T13' *(강화)* | 긴 블록 typewriter: v2 T13 + **비포커스 블록의 교정 자동수정/블록 분할 시 typewriter 미발화**(E2 회귀 확인) |
| T15' *(강화)* | v2 T15 + **찾기/바꾸기 내비게이션 중 미리보기 수식 하이라이트가 더 이상 따라오지 않는 변화(§2-3)를 덕수가 눈으로 확인하고 수용 여부 판정** |
| T19 *(신규)* | **D5″ 대칭성**: 패널 높이의 60~80% 크기 블록의 상단부 수식 클릭 → 편집창·미리보기 **둘 다** 블록 상단이 보이는 상태로 정렬(한쪽만 중앙으로 가지 않음) |
| T20 *(신규)* | **D14**: 수식 클릭 직후 연타(다른 수식 연속 클릭) → 스크롤 지터 없이 마지막 목표로 수렴 |
| T21 *(신규)* | **D13**: `scrollToPos` 참조가 코드베이스에 0건 (grep) + 빌드 통과 |

---

## 7. 문서 갱신 (v2 §7 승계 + v3 추가)

v2 §7의 6~11 전부 유지 (CLAUDE.md autoHeight 문구 정정, `paddingBottom:100vh` 금지 규칙 — 부록 A 문안, roadmap 교훈을 D0 결과로 교체, prelaunch-bug-cleanup R8 교차 참조, EV:225 주석 개정, v2 문서 phasedocs 이관). 추가:

12. roadmap Phase 56 절에 **검증 워크플로우 기록**: v1(web) → v2(CLI, D0 실측·오진 정정) → v3(web, 교차 정정·대칭화) — 상호 검증으로 잡아낸 것들(v1 오진, v2의 scrollToPos 오인·D8' 가드 누락)을 한 줄씩 남겨 다음 대형 수정 때 같은 워크플로우를 쓸 근거로 삼는다.
13. CLAUDE.md에 D2″ 불변식 1줄: "**편집 화면의 좌·우 칼럼과 content-frame은 세로로 스크롤되면 안 된다** — scroll 가드가 dev 경고를 낸다. 경고가 보이면 어떤 자식이 세로 overflow를 만든 것이므로 그 원인을 제거할 것 (Phase 56)."
14. Phase 15 비고(roadmap.md:95-103)에 "→ Phase 56" 상호참조 (v1 §7-2 유지).

---

## 8. 미결 확인 사항 (덕수)

| # | 질문 | 기본값 (무응답 시) |
|---|---|---|
| Q1 | §2-3 검색 내비게이션 중 미리보기 수식 하이라이트 미동기화 — 수용? | 수용 (검색 자체 하이라이트로 충분) |
| Q2 | D2″ 안전망 채택 — v2는 불필요 의견, v3는 채택 권고. 최종 판단? | 채택 (상시 비용 0, 회귀 경보 가치) |
| Q3 | T12-a (실앱에서 수정 전 `left-column` vOver 실측 — §1-0 공식의 실앱 검증) 수행 여부 | 수행 권장 (1분 소요, 공식이 맞으면 밀림 폭 = 8px+크롬 확인됨) |
