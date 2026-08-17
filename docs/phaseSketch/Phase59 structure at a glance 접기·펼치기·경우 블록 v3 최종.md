# Phase 59 — Structure at a Glance: 풀이 접기·펼치기 · '경우(Case)' 블록 **v3 (최종)**

작성일: 2026-08-17 · 작성: web Claude (Fable) — CLI v2(실측 대조본)를 재검토 · 기준 커밋: **`459cbcb`** (v2와 동일)

> **확정 기록 (2026-08-17)** — 덕수가 **Q5를 기본값대로 확정**했다: 신규 표기 `C-1.` 유지 + 레거시 `Case 1.` 렌더 무변화(표기 혼재는 문항 단위로 자연 정리, 필요 시 후속 "레거시 → 블록 자동 변환 도구"로 해소). 아울러 **디자인 지시 1건을 추가 확정**했다: **D19 — 펼침 상태의 dot는 Mathory 로고 레드로 채우고, 접힘 상태의 dot는 테두리만 남긴다**(§3-3). Q1~Q4(v1)·Q5(v3)·D19까지 **전 미결 항목 확정 — 본 문서가 착수 확정안이다.**

> **검증 방법** — 이번 v3는 Phase 58 v3와 달리 **레포를 직접 클론해 대조했다**(공개 레포, HEAD가 v2 기준 커밋 `459cbcb`와 정확히 일치 — 미푸시 0건 재확인). v2의 정정 E1~E24와 인용 좌표를 파일 단위로 실측 재검증했고, v2의 CSS·코드 스킴이 실제 DOM 구조 위에서 성립하는지까지 확인했다.
>
> 결과: **v2의 정정·결정(D1′~D18)은 전건 사실이며 전부 승인한다.** 좌표 인용 24건 중 오기 0건 — ProblemView 1,061행, 라벨 열 폭 `7 × contentFontSize`, `handleSplitBlock`의 `type: 'text'`, `getPreviewBlocks`의 첫 비어있지 않은 탭 채택까지 전부 정확했다. 그 위에 v3는 다음을 더한다:
>
> - **정정 1건(중대)**: **F1** — v2 §5.3의 "5곳 공통 형태"는 **EditorView·PrintableContent에서 성립하지 않는다.** 두 사이트는 모든 블록을 래퍼 div로 감싸므로, case div를 그 안에 반환하면 `.case-block`끼리 형제가 아니게 되어 **rail 브리징 셀렉터가 전부 불발**한다(레일이 블록마다 끊김). 클래스를 사이트별 최상위 블록 요소에 다는 배치 규칙(D15′)으로 해소 — CSS는 v2 그대로.
> - **정밀화 1건**: **F3** — D2′ 레거시 승격은 블록 단위가 아니라 **행 단위**여야 한다(한 텍스트 블록에 `**Case 1.**`·`**Case 2.**`·`- **Case 1a.**`가 공존하는 것이 Phase 54의 표준 형태다).
> - **정정 1건(경미)**: **F4** — §6.3 특이도 오기 하나(결론 불변).
> - **실증 2건**: **F2** — v2가 "margin collapse 유효"라고 주장만 한 부분을 5개 사이트 DOM 구조로 실증(성립). **F5** — 토글 아이콘이 라벨 열 폭에 들어가는지 산술 확인(들어간다 — 2행 폴백은 예비로만).
>
> §1 검증표 → §2 정정 → §3 보강 → §4 v2 대비 변경분만 모은 최종 갱신표 (여기 명시된 갱신 외 **v2 전문이 착수 기준으로 유효**하다).

---

## 1. v2 검증 결과 — 전건 승인

| v2 주장 | v3 검증 방법 | 판정 |
|---|---|---|
| **E1** Phase 54가 `**Case n.**`/`- **Case na.**` 규약을 기구현 | `lib/locale.ts:86-99`(normalizeCaseBoundaries)·`:106-111`(convertSubcaseMarkers)·`lib/preprocess.ts:193-197`·`globals.css:328-336`·`PrintStyles.css:78-80`·Phase54 문서 D4("한글화는 추후 별도 결정")·D5 전부 실측 일치. **파급 3건(2중 체계·라벨의 has-key 오염·D8=Phase 54 D4의 답)도 전부 타당** | ✅ 승인 |
| **E2** K1 = 1.1em / 11pt | `globals.css` K1 주석 절("+0.5em → 화면 1.1em / 인쇄 11pt")·`.callout-block { margin: 1.1em 0 }`·`PrintStyles.css` callout `margin: 11pt 0` 실측 일치. v1의 1.5em은 Phase 57 v3(구버전 문서) 값을 그대로 옮긴 나의 오류 — 실코드는 Phase 57 **v4**에서 1.1em로 확정되어 있었다 | ✅ 승인 |
| **E3** 분기 순서는 사이트마다 다르다 | 5곳 전수 대조 — ProblemView·FolderView·EditorView는 `image→svg→ggb→BORDERED→callout→choices→기본`, ProblemTabContent는 **svg·ggb 분기 없음**, PrintableContent는 **choices가 선두**. 전부 일치. "callout 바로 앞이 유일한 공통 앵커" 판단 정확. **D16(렌더러 통합 금지) 승인** | ✅ 승인 |
| **E4** dot·rail 중심선 공유 | 산술 검산 — v1 방식은 0.25em 어긋남, `margin-left:-1px`+`translate(-50%,-50%)` 방식이 옳다 | ✅ 승인 |
| **E5** base-26 `letters()` | `fromCharCode(96+27)==='{'` — 자명. 함수 검산 통과(1→a, 26→z, 27→aa) | ✅ 승인 |
| **E6** margin collapse 기반 3규칙 | **F2로 실증**(§3-1) — 5개 사이트 모두 블록 나열 컨테이너가 flex/gap 아닌 일반 block div라 형제 collapse 성립. 단 **셀렉터가 닿으려면 F1의 배치 규칙이 선행**되어야 한다(§2-1) | ✅ (F1) |
| **E6′** inner rail 폐기 | 구상 원문 재확인 — inner rail은 v1의 창작 맞음. 가상요소 예산(2개) 논리 타당. 폐기 승인 — v1 저자로서 수용 | ✅ 승인 |
| **E7** 2-div 분할은 수식 클릭 매핑 파괴 | `EditorPreview.tsx:388-394`(인스턴스별 0부터 data-math-id 부여 useEffect)·`EditorView.tsx:1833-1840`(`[data-block-id]` 안 첫 매치) 실측 일치. **D15(단일 인스턴스 + 라벨 span 주입) 승인** — `rehypeRaw` 활성(`EditorPreview.tsx:302`) + marker span 선례로 주입 문자열 파싱도 안전 | ✅ 승인 |
| **E9** 상태 키 = `block_key ?? id` | `types/problem.ts:153-155` 주석 그대로("doc id는 저장마다 재발급") | ✅ 승인 |
| **E10** lucide 부재·Icons.tsx 3종뿐 | `package.json` lucide 0건 · `Icons.tsx:126-148` IconChevron/Left/Down 3종 확인 | ✅ 승인 |
| **E11** '전체 접기' 이름 충돌 | `EditorView.tsx:922-923` collapseMode · `:1722` "전체 접기 / 펼치기 토글" 실측. **"구조 보기 / 전체 보기" 명칭 승인** | ✅ 승인 |
| **E13** Phase 58 배포 완료 | HEAD `459cbcb`에 톤 시스템 최종형 전부 존재. **추가 확인**: `--tone-dim: #675F52`는 단순 "적용 중"이 아니라 **B안 승격 상태**다(globals 주석: A안 secondary는 "물러나는 느낌이 안 난다"는 덕수 판정으로 교체, 세 배경 4.5:1 전부 통과) — E17 가드가 지키는 "현행 색"의 의미가 명확해진다 | ✅ 승인 |
| **E14** 공유·스냅샷·실시간 3경로 = 렌더러 1개 | `SnapshotView.tsx:4` + `PublicProblemView` → `PublicViewerShell` → `ProblemTabContent` 임포트 체인 확인 | ✅ 승인 |
| **E15** 인쇄 fleqn override 필수 | `PrintStyles.css` `@media print` 블록의 `.katex-display{padding-left:0}` + `.fleqn > .katex{2em}` 재부여, callout의 두 줄 전례(`globals .callout-block .katex-display{padding-left:0}` + print fleqn override) 실측 일치 | ✅ 승인 |
| **E16** 2단 모드 탭 바 부재 | `PublicViewerShell.tsx` `twoColumn = wide && tabs.length === 2` — 2단 분기에 탭 바 렌더 없음. **토글의 ProblemTabContent 내장 결정 승인** | ✅ 승인 |
| **E17** 톤이 케이스 제목을 흐림 + 가드 | `globals.css` has-key dim(본문+`.katex`)·strong 600·h1~h3 가드(secondary + 제목 안 `.katex`는 primary) 실측 일치. **v2 가드가 h1~h3 가드와 정확히 동형**임을 확인 — 특이도 오기 1건만 정정(F4) | ✅ (F4) |
| **E18** 번호는 복사·내보내기에서 소실 | `ProblemView.tsx` 복사(`raw_text join`)·다운로드 동일, `exportMd.ts` `<!-- block: ${b.type} -->` 실측 일치. D18(주석에 라벨 동봉) 승인 | ✅ 승인 |
| **E19·E19′** FolderView 첫 비어있지 않은 탭 / 규칙 무검증 | `lib/firestore.ts` getPreviewBlocks · `firestore.rules`(블록 type 화이트리스트 없음 — type 검증은 discussion_sessions뿐) 실측 일치 | ✅ 승인 |
| **E20** 스크롤 앵커링 | ProblemView U-프레임(overflowY:auto div)·`ScrollColumn`(overflow:auto) 실측 일치. 최소 보정안 승인 | ✅ 승인 |
| **E21** outline은 `isToneScoped` 게이트 | `lib/keyTone.ts` isToneScoped·toneClass 실측 일치. **KEY_STRONG_RE는 현행 미export + `g` 없음**도 확인 — export + `_GLOBAL` 분리 계획 그대로 | ✅ 승인 |
| **E22** 라벨만 600, 제목행 500 | `.solution-tone.has-key strong { font-weight: 600 }` 실측. 위계 논리 타당 | ✅ 승인 |
| **E23·E24** 분할 산출물 text / 편집창 접기 자동 요약 | `EditorView.tsx:1571-1580`(`type: 'text'`, 파생 블록 새 block_key)·`:736-744`(라벨+previewText) 실측 일치 | ✅ 승인 |
| D9′(이어짓기)·S4(블록 단위 한계)·§3.4(⌘P·⌘F 사양화)·§4.1(TabBody 분리)·Q5 | 논리 검토 — 전부 타당. TabBody 분리는 ProblemView 1,061행 실측으로 근거 확인 | ✅ 채택 |

---

## 2. v2 정정 (v3에서 바로잡음)

### 2-1. F1 ★ — "5곳 공통 형태"는 두 사이트에서 형제성이 깨진다 (v2 유일의 구조 결함)

v2 §5.3은 case 분기가 `<div class="case-block">…</div>`를 반환하는 코드를 "5곳 공통 형태"로 제시했다. 그러나 실제 DOM 구조는:

| 사이트 | 블록 나열 구조 | case div를 분기 안에서 반환하면 |
|---|---|---|
| ProblemView | 분기별 div가 **직접 형제** (`renderBlocks` map 반환값이 곧 형제 — callout과 동일) | ✅ 성립 |
| FolderView | 동일 | ✅ 성립 |
| ProblemTabContent | 동일 (`tone-baseline` div의 직접 자식) | ✅ 성립 |
| **EditorView 미리보기** | **모든 블록이 `<div data-block-id={id}>` 래퍼 안** (`EditorView.tsx:3163` — 분기는 래퍼 내부 삼항) | ❌ `.case-block`이 래퍼 안에 갇혀 형제 아님 |
| **PrintableContent** | **모든 블록이 `<div className="print-block">` 래퍼 안** (`PrintableContent.tsx:73`) | ❌ 동일 |

형제성이 깨지면 `.case-block + .case-block::before { top: 0 }`·`.case-block:has(+ .case-block)::before { bottom: -1.1em }`가 **한 번도 매치되지 않아**, 편집 미리보기와 인쇄에서 레일이 블록마다 끊긴 채 조용히 열화된다(스타일이 "틀리게" 나오는 게 아니라 "브리징만 안 되는" 형태라 검증 없이는 눈치채기 어렵다).

**처방 — D15′ (클래스 배치 규칙): case 클래스는 "사이트별 최상위 블록 요소"에 단다.**

```tsx
// EditorView (3163 래퍼) — 래퍼에 클래스를 병기하고, 삼항에 case 분기 추가(내용만 교체)
<div key={block.id} data-block-id={block.id}
     className={isCaseBlock(block.type)
       ? ['case-block', block.type === 'subcase' && 'case-sub', !label && 'case-cont']
           .filter(Boolean).join(' ')
       : undefined}
     style={{ paddingTop: headingTopPad }}>
  … : isCaseBlock(block.type) ? (
    <EditorPreview content={injectCaseLabel(block.raw_text, label)} borderless locale="ko"
                   activeMathId={…} onClickMath={…} />   // 기본 낙하와 동일 인자
  ) : …
</div>

// PrintableContent (73 래퍼) — 'print-block'에 병기. 내부는 PrintBlockRenderer 직접(추가 div 없음)
<div key={block.id} className={`print-block${isCaseBlock(block.type) ? ' case-block…' : ''}`} …>
```

- 나머지 3곳은 v2 §5.3 코드 그대로(반환 div가 이미 형제).
- **CSS는 v2 §6.2·§6.5에서 한 글자도 안 바뀐다** — 셀렉터가 닿을 위치에 클래스를 두는 문제일 뿐이다.
- 부작용 검토: EditorView 래퍼에 `padding-left: 3em`이 얹혀도 래퍼는 무스타일이던 요소라 충돌 0(heading 전용 paddingTop과 타입 배타). `data-block-id` 탐색(`:1835`)·활성 블록 수식 매핑은 래퍼 유지로 무변화 — E7 처방과 정합. `.print-block`은 **CSS 규칙이 0건인 무스타일 래퍼**임을 grep으로 확인(클래스 병기 안전).
- 이어짓기(`case-cont`)·하위(`case-sub`) 클래스도 같은 위치에 병기 — §6.2의 모든 셀렉터가 5곳에서 동일하게 작동한다.

### 2-2. F3 — D2′ 레거시 승격은 행 단위다

Phase 54 규약에서 케이스 라벨들은 **한 텍스트 블록 안에 여럿 공존**하는 것이 표준이다(`normalizeCaseBoundaries`가 한 블록 내 연속 라벨 사이에 빈 줄을 삽입하는 함수라는 것 자체가 그 증거다). v2 §3.1의 문면("`**Case n.**`으로 시작하는 텍스트 블록은 `kind:'case'` 항목으로")대로 블록 단위로 승격하면 **첫 라벨만 항목이 되고 둘째 케이스부터는 사라진다.**

**정밀화**: `buildOutline`의 레거시 처리는 텍스트 블록의 **행을 스캔**한다 —

```
행이 /^\*\*Case\s+\d+[a-z]?\.\*\*/   → kind:'case' 항목 (content = 그 행 전체 — 라벨 뒤 조건 포함)
행이 /^-\s+\*\*Case\s+\d+[a-z]\.\*\*/ → kind:'subcase' 항목 (동일)
그 외 행                              → key 발췌 대상으로 누적
```

- 레거시 항목에는 **자동 번호를 붙이지 않는다**(라벨이 원문에 이미 있다) — Q5의 "레거시 렌더 무변화" 기본값과 정합.
- 라벨 행이 발췌 대상에서 이미 빠지므로 v2의 사후 필터(`^Case\s+\d+[a-z]?\.$`)는 **이중 안전망으로 유지**(행 중간 인용 등 엣지 방어).
- 정규식 2개는 Phase 54 실코드의 것을 재사용(`locale.ts:91`·`:108`)하되, **상수를 lib로 추출해 3곳(locale·outline) 공유** — 사본 이격 방지.

### 2-3. F4 — §6.3 특이도 오기 (결론 불변)

`.solution-tone.has-key .case-block p:has(> .case-label:first-child) .katex`는 (0,5,1)이 아니라 **(0,6,1)**이다(클래스 4 + `:has()` 인자 최고 특이도 2 + 요소 1). 이겨야 할 상대(0,3,0)보다 크다는 결론은 그대로 — 기록만 정정. (첫 규칙 (0,5,1) 표기는 정확했다.)

---

## 3. v3 보강 (신규)

### 3-1. F2 — margin collapse 성립을 DOM 구조로 실증

v2 E6은 "형제 collapse는 유효"라고 주장만 했다. 실측: 블록 나열 컨테이너는 ProblemView `problem-content-toned` div · EditorView `toneClass` div · ProblemTabContent `tone-baseline` div · FolderView 반환 배열 컨테이너 · PrintableContent 섹션 컨테이너 — **전부 display 기본값(block)의 일반 div이고 flex/gap을 쓰지 않는다**(탭 행 레벨의 flex는 블록 나열보다 바깥층). 따라서 인접 `.case-block` 형제의 1.1em+1.1em은 1.1em으로 collapse하고, 브리징 보정 `-1.1em`이 정확히 마진을 관통한다. **F1의 배치 규칙이 지켜지는 한 v2의 3규칙 스킴은 5곳 전부에서 성립한다.**

### 3-2. D19 — dot 상태 표현: 펼침 = 로고 레드 채움 / 접힘 = 테두리만 (덕수 추가 지시)

dot가 장식이 아니라 **열림/닫힘 상태 표시기**가 된다. 색은 브랜드 토큰 재사용 — `--mathory-red: #D97757`("로고 전용 레드 — 로고 handoff 스펙", `globals.css:90-92`). 신규 색 0.

**상태 정의** — "펼침"은 케이스 본문이 보이는 모든 경우다: full 모드 전체 · outline 모드에서 `openCases`에 든 케이스 · EditorView 미리보기·FolderView·인쇄(상태 개념이 없는 사이트 = 항상 펼침 = 항상 채움). "접힘"은 outline 모드에서 닫힌 케이스뿐이다 → 열람 2뷰가 그때만 `case-closed` 클래스를 **D15′ 위치(최상위 블록 요소)에 병기**한다. 다른 사이트는 클래스를 만들지 않으므로 코드 변경 0.

**CSS — v2 §6.2의 dot 절만 교체:**

```css
/* dot — 상태 표시기 (D19): 펼침 = 로고 레드 채움 / 접힘 = 같은 색 테두리만 */
.case-block::after {
  content: '';
  position: absolute;
  left: 1em; top: 0.9em;
  transform: translate(-50%, -50%);
  width: 0.5em; height: 0.5em; border-radius: 50%;
  box-sizing: border-box;                    /* 두 상태의 외곽 치수 동일 */
  background: var(--mathory-red);
}
.case-block.case-closed::after {
  background: transparent;
  border: 1.5px solid var(--mathory-red);
}
.case-block.case-sub::after  { width: 0.34em; height: 0.34em; }
.case-block.case-cont::after { content: none; }                  /* 이어짓기 — 불변 */
```

- **v2 대비 delta 3건**: ① 채움색 `currentColor` → `var(--mathory-red)` ② `case-closed` 상태 규칙 신설 ③ 하위케이스의 `opacity: 0.75` **삭제** — 반투명 레드는 제3의 상태처럼 읽히므로, 하위 구분은 크기만으로 한다.
- **톤 시스템과의 관계**: dot는 이제 has-key dim에 동행하지 않는다(레일은 계속 `currentColor`로 동행). 케이스 제목행 가드(E17)와 같은 철학 — **구조 신호는 톤 불변**. `--mathory-red`(#D97757)의 클레이 배경 명암비는 텍스트 기준(4.5:1)에 못 미치지만 dot는 비텍스트 UI 요소(3:1 기준)이고 채움 면적으로 식별되므로 문제없다 — Stage 2 육안 확인만.
- **인쇄**: 상태가 없으므로 항상 채움. 색은 **로고 레드 유지가 기본안**(통일성 지시 — `@media print`의 `print-color-adjust: exact`가 이미 있어 색 인쇄 보장, v2 §6.5의 `background:#000`을 `var(--mathory-red)`로 교체). 흑백 인쇄에서 중간 회색조 시인성이 약하면 `#000` 폴백 1줄 — Stage 2 판정.
- **접힘 dot의 테두리 색**: 기본안은 채움과 같은 로고 레드(같은 색의 채움/테두리가 고전적 open/closed 문법). 대안(테두리만 `currentColor`)은 레드가 과하게 번잡할 때 Stage 2에서 교체 가능 — 1줄.
- **인터랙션 참고**: outline 모드 케이스 제목행의 chevron(v2 §4.3)은 유지하되, dot 상태 표시와 신호가 중복되어 거슬리면 Stage 4에서 케이스 행에 한해 chevron 생략을 판정한다(섹션 제목행 chevron은 불변).

### 3-3. 소소한 보강 4건

- **F5 — 토글 아이콘은 라벨 열에 들어간다**: 라벨 열 폭 = `7 × contentFontSize`(15px 기준 105px). 현행 내용물은 라벨 텍스트(fontSize 12 고정, '풀이' ≈ 24px) + 복사 버튼 22px + gap 4 — 신규 아이콘 22px + gap 4를 더해도 ≈ 76px < 105px. contentFontSize 11px(폭 77px)까지도 수용된다. v2의 "넘치면 2행" 폴백은 예비로만 남긴다.
- **V1 — dot 세로 기준의 정확한 한계**: `line-height: 1.8`은 `.preview-content` **인라인 style**이다(`EditorPreview.tsx:457`). `.case-block`(래퍼, `.preview-content` 밖)의 `top: 0.9em`은 래퍼의 font-size·line-height 기준이라 첫 행 중심과 어긋날 수 있다 — v2도 실측 대상이라 했지만, **어긋나는 메커니즘이 이것**임을 명시해 Stage 2에서 래퍼에 `line-height: 1.8` 상속을 함께 검토.
- **V2 — outline에서도 has-key 판정은 원본 blocks 기준**: `toneClass(tabId, blocks)`는 스켈레톤이 아니라 **원본 블록 배열**로 호출한다(현행 코드가 이미 그렇다). 접힘 상태에서 발췌만 렌더돼도 컨테이너 클래스가 흔들리지 않는다 — 모드 전환 시 톤 재계산·리플로우 없음.
- **V3 — 워크플로우 기록**: roadmap Phase 59 절에 v1(web, 방향·Q1~Q4 확정) → v2(CLI, 실측 정정 24건 — Phase 54 발굴·E7 클릭 매핑·K1 정정) → v3(web, **최초의 레포 직접 클론 검증** — 전건 승인 + 래퍼 형제성 결함 F1 적발)을 한 줄씩 남긴다. 교차검증 워크플로우의 세 번째 실행 사례.

---

## 4. 최종 갱신표 (v2 대비 변경분만 — 이 표 외 v2 전문 유효)

| # | 항목 | v3 확정 내용 | 출처 |
|---|---|---|---|
| **D15′** | 클래스 배치 규칙 | case 클래스(`case-block`·`case-sub`·`case-cont`)는 **사이트별 최상위 블록 요소**에: EditorView는 `data-block-id` 래퍼에 병기, PrintableContent는 `print-block`에 병기, 나머지 3곳은 v2 §5.3 반환 div 그대로. CSS 무변경 | F1 |
| D2′ | 레거시 승격 | **행 단위 스캔**으로 정밀화(블록당 여러 케이스 지원). 레거시 항목은 자동 번호 없음. Phase 54 정규식을 lib 상수로 추출해 공유 | F3 |
| §6.3 | 톤 가드 | 특이도 기록 (0,5,1) → **(0,6,1)** (결론 불변) | F4 |
| §6.2·§6.5 | rail CSS | **dot 절 제외 v2 그대로 확정** — collapse 실증으로 전제 봉인 | F2 |
| **D19** | dot 상태 표현 | **펼침 = `var(--mathory-red)` 채움 / 접힘(outline 닫힘) = 동색 테두리만.** `case-closed` 클래스는 열람 2뷰 outline 모드에서만 D15′ 위치에 병기. 하위 dot의 opacity 0.75 삭제(크기로만 구분). 인쇄 dot도 로고 레드 채움(#000 → 교체) | 덕수 지시 · §3-2 |
| §4.2 | 토글 배치 | 라벨 열 1행 수용 확인(105px vs ≈76px) — 2행 폴백은 예비 | F5 |
| Stage 2 | dot 실측 | 래퍼 line-height 상속 검토 항목 추가 | V1 |

---

## 5. 검증 체크리스트 증분 (v2 Stage 1~6 유지 + 아래 강화)

| # | 항목 |
|---|---|
| T1′ *(강화)* | Stage 1 + **F1 회귀**: EditorView 미리보기·인쇄에서 연속 케이스의 레일이 블록 경계에서 끊기지 않는지 — 5곳 각각에서 DevTools로 `.case-block + .case-block` 매치 여부 직접 확인 |
| T2′ *(강화)* | Stage 2 + **V1**: dot 중심 = 제목행 첫 줄 세로 중심 — 래퍼 line-height 상속 필요 여부 판정. + 인쇄 `.print-block.case-block` 병기 상태에서 브리징(-11pt) 실측. + **D19**: 레드 채움 dot의 클레이 3배경 시인성 / 흑백 인쇄 회색조 판정(약하면 #000 폴백) / 접힘 테두리 dot과 채움 dot의 외곽 치수 동일 확인 |
| T4′ *(신규)* | Stage 4 + **D19**: outline에서 케이스 여닫을 때 dot 채움↔테두리 전환이 즉시 반영 / 케이스 행 chevron과의 신호 중복 판정(거슬리면 케이스 행만 chevron 생략) / full 복귀 시 전체 dot 채움 |
| T3′ *(강화)* | Stage 3 + **F3 회귀**: `**Case 1.** … **Case 2.** … - **Case 2a.**`가 **한 블록에 든** 레거시 문항에서 구조 보기에 세 항목이 모두 뜨는지 |
| T5′ *(강화)* | Stage 5 + **V2**: 구조 보기 ↔ 전체 보기 전환 시 has-key 컨테이너 클래스 불변(리렌더 플래시 없음) |

---

## 6. 확인 사항 — **전건 확정 (2026-08-17 덕수)**

| # | 질문 | **확정** |
|---|---|---|
| Q5 | 레거시 `Case 1.` ↔ 신규 `C-1.` 표기 혼재(v2 §10) | **`C-1.` 유지 + 레거시 렌더 무변화** — 표기 혼재는 문항 단위로 자연 정리. 통일이 필요해지면 후속 후보의 "레거시 → 블록 자동 변환 도구"로 해소 |

**미결 항목 없음**(Q1~Q4는 v1에서, Q5는 본 문서에서 확정). **v2 전문 + 본 문서 §4 갱신표**가 착수 기준이며, CLI가 Stage 1부터 구현한다. 착수 시 `git log -1`이 `459cbcb`에서 움직였으면 v2 §8 좌표만 재확인한다.
