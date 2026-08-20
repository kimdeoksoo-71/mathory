# Phase 59a — Case 블록 레이아웃 체계 수정 · 강조 체계 정비 (구현 계획서 v2)

작성일: 2026-08-20 · 기준 커밋 **`fdeac85`** (main = origin) · 작성: CLI(레포 실측)
입력: 덕수 구상서(2026-08-20) + v1(web) + 소스 전수 실측

> **v2의 성격**: v1이 세운 방향(거터 이주 · 명칭 · 톤 기본화 · 코칭 블록)은 **전부 유지**한다.
> 바꾼 것은 **좌표·색·파일 좌표·삭제 파급**의 사실관계다. v1은 레포 클론을 눈으로 대조해
> 썼기 때문에 "값이 맞는지"를 계산하지 않은 자리가 남았고, 그중 셋은 그대로 구현하면
> 실제로 깨진다(C1·C5·C14). §0이 정정 목록이고 §1~§7이 정정을 반영한 실행판이다.
>
> **v1 대비 결론이 뒤집힌 것 3건**: ① 명암비 구속 배경색이 틀렸다(#EDE6DA → **#E8DFCE**)
> ② rail/chevron 좌표쌍 (-1.6/-0.8)은 작은 글꼴에서 **겹친다** ③ 공유 2단은 손댈 곳이 없다.
> **v1 대비 새로 발견한 필수 작업 2건**: 테스트 파일 개정(C8) · `toneClass` 시그니처 파급(C7).
>
> **2026-08-20 덕수 결정 반영 — 미결 항목 0**: Q5(FolderView 카드는 rail·dot 미표시) ·
> Q6(`LABEL_GAP` 비례화) · Q7(톤 기본화 낙차 수용)이 확정되어 §7이 '확인 사항'에서
> **'결정 사항'** 으로 바뀌었다. Q1~Q4는 v1에서 이미 기본안 채택. **이 문서는 착수 가능 상태다.**

---

## 0. v1 정정 목록

각 항목에 **근거(파일:행)** 를 달았다. 번호는 v2에서만 쓰는 것이고 v1의 R1~R8과 무관하다.
R1~R8(Phase 59 잔여 부채 진단)은 전수 재확인 결과 **전부 사실이다** — §0-B 참조.

### C1. 명암비 구속 배경색이 틀렸다 — `#EDE6DA`가 아니라 **`#E8DFCE`**

`--block-bg-active`는 커밋 **`78a780f`**(편집창 블록 배경 3단계 구별 강화)에서 `#E8DFCE`로
바뀌었다([globals.css:75](app/globals.css#L75)). FolderView 카드가 이 토큰을 그대로 쓴다
([FolderView.tsx:505](components/problem/FolderView.tsx#L505)). v1의 표뿐 아니라 **CLAUDE.md ·
Phase 58 · Phase 59 문서가 전부 `#EDE6DA`로 stale**하다.

재계산(산식 `((c+0.055)/1.055)^2.4`, 배경 `#E8DFCE`):

| 전경 | 구 표기 `#EDE6DA` | **실제 `#E8DFCE`** | 판정 |
|---|---|---|---|
| `--case-dot` `#BC5F3F` | 3.49 | **3.28** | 비텍스트 3:1 통과 (여유 0.28로 축소) |
| `--tone-dim` `#675F52` | 5.08 | **4.76** | 텍스트 4.5:1 통과 |
| `--text-secondary` `#5D5647` | 5.86 | **5.50** | 통과 |
| GitHub Important `#8250df` | 4.07 | **3.81** | 미달 |
| GitHub Caution `#cf222e` | 4.32 | **4.05** | 미달 |
| 채택 `#6639ba` | 5.92 | **5.55** | 통과 |
| 채택 `#a40e26` | 6.34 | **5.95** | 통과 |

→ **v1의 색 채택 결론(GitHub 기본값 대신 700 계열)은 그대로 유효하고, 오히려 더 필요해졌다.**
표만 갈면 된다. 다만 `--case-dot`의 여유가 0.28밖에 없다는 사실은 새로 기록할 것.

### C2. `--tone-dim`은 이미 정의돼 있다 → §3-3의 회귀 서술이 달라진다

[globals.css:138](app/globals.css#L138)에 `--tone-dim: #675F52`가 **이미 있다**. 138행 위 주석은
맞지만 [globals.css:282](app/globals.css#L282)의 "필요하면 :root에 한 줄 추가하면 된다"는 stale이다.

따라서 톤 기본화(§3-3)의 실제 픽셀 변화는 v1이 적은 것보다 크다:

| 대상 | 현행 (`**` 없는 풀이) | 변경 후 | 낙차 |
|---|---|---|---|
| 본문 글자 | `#5D5647` (tone-baseline) | `#675F52` | 작다 |
| **본문 수식** | `#2D2A23` (tone-baseline .katex) | `#675F52` | **크다** |

`**`가 있는 풀이는 무변화. → Stage 3의 검증 문구를 "**`**`가 없던 기존 풀이는 수식이 눈에 띄게
물러난다**"로 바꿀 것. v1의 "픽셀 대조 → has-key 있을 때와 동일"은 맞지만, 그 "동일"이
무엇을 의미하는지가 빠져 있어 검수자가 변화를 버그로 오인할 수 있다.

### C3. FolderView에서 rail을 자르는 것은 카드가 아니라 **내부 콘텐츠 div**다

v1 §1-4는 "카드 컨테이너에 override + 좌측 패딩 28px"이라 했지만, 카드
([FolderView.tsx:504-516](components/problem/FolderView.tsx#L504-L516), `padding: '18px 22px'` +
`overflow:hidden`) 안쪽의 `.problem-content-scaled` div
([FolderView.tsx:581-583](components/problem/FolderView.tsx#L581-L583))가 **`overflow:'hidden'` + 패딩 0**이다.
**카드 패딩을 아무리 키워도 rail은 이 안쪽 div에서 잘린다.** 그리고 이 div의 `overflow:hidden`은
카드 '잘림' 연출과 하단 페이드의 기준이라 제거할 수 없다.

→ 대응은 §1-4에서 아예 다르게 간다(카드에서는 rail·dot을 **그리지 않는다**). Q5.

### C4. EditorView 채널 56px은 **3일 전에 의도적으로 정한 값**이다

커밋 **`83c8f47`**(기타 개선 4: 편집창↔미리보기 채널 확장 32px → 56px)과 그 근거 주석
([EditorView.tsx:3337-3344](components/editor/EditorView.tsx#L3337-L3344))이 살아 있다.
v1은 이 결정을 인용하지 않고 80px로 올린다. **결론(80px)은 정합적이지만 근거가 필요하다**:

> 83c8f47이 정한 것은 "편집 띠 우단 → 미리보기 **첫 글자**"다. 59a는 그 사이에 rail 거터를
> 새로 끼운다 → 같은 체감을 유지하려면 **56px + 거터 폭**이 되어야 한다.

그리고 v1의 배분(marginLeft 24→32, padding 32→48 좌우 동시)은 **우측 패딩까지 키워 폭이 32px
늘어난다.** 좌측만 키우는 편이 낫다 — §1-4의 개정안 참조.

### C5. **rail/chevron 좌표쌍 (-1.6em / -0.8em)은 작은 글꼴에서 겹친다** (v1 최대 오류)

요약 보기의 경우 줄 chevron은 `.case-head .outline-chevron`
([globals.css:728-733](app/globals.css#L728-L733))이고, **폭이 지정돼 있지 않다** — 실제 폭은
`<IconChevron size={12}>`의 **고정 12px**이다([OutlineSections.tsx:62](components/problem/OutlineSections.tsx#L62)).
`left`도 중심이 아니라 **좌단**이다. v1은 `--case-chevron-x`를 "중심"으로 정의하면서 이 둘을
확인하지 않았다.

v1 좌표로 실측 계산(dot 반경 0.26em):

| 글꼴 | dot 우단 | chevron 좌단 (중심 -0.8em, 폭 12px) | 간극 |
|---|---|---|---|
| 24px | -32.2px | -25.2px | 7.0px |
| 15px | -20.1px | -18.0px | 2.1px |
| **11px** | **-14.7px** | **-14.8px** | **-0.1px → 겹침** |

원인은 CLAUDE.md가 이미 경고한 **em/px 단위 혼합**(G8 계열)이다. 아이콘만 px라 글꼴을 줄이면
chevron이 상대적으로 커져 dot을 덮는다.

**정정 좌표 (§1-2에서 확정)**:
- chevron을 **em화**한다 — `.outline-chevron svg { width: .8em; height: .8em }` + 컨테이너 `width: 1em`
- `--case-chevron-x: **-0.7em**` (중심). 이 값을 고르는 이유: **`.section-head`의 제목 줄 chevron
  중심이 이미 정확히 -0.7em이다**(`margin-left:-1.2em` + 폭 1em의 절반). 즉 **제목 줄 CSS를
  한 줄도 안 고치고** 두 chevron이 같은 x에 선다. v1이 예고한 "마진 3개 재조정"이 통째로 사라진다.
- `--case-rail-x: **-1.8em**` → dot 우단 -1.54em, chevron 좌단 -1.2em, **여유 0.34em**이 모든
  글꼴에서 비례 유지된다.
- 필요 거터 폭 = dot 좌단 2.06em → 여유 포함 **2.2em** (33px@15 · 24px@11 · 53px@24)

### C6. §3-3 특이도 경보는 **범위가 과했다** — 실제 위험은 한 줄뿐

`.has-key`를 기계적으로 지웠을 때 각 규칙이 어떻게 되는지 전수 계산했다:

| 규칙 | 삭제 후 특이도 | 이겨야 할 상대 | 판정 |
|---|---|---|---|
| `.solution-tone` (색) | (0,1,0) | — | 안전 |
| **`.solution-tone .katex`** | **(0,2,0)** | `.tone-baseline .katex` **(0,2,0)** | **동률 → 소스 순서 의존** |
| `.solution-tone strong` | (0,1,1) | 위 dim (0,1,0) | 안전 |
| `.solution-tone h1~h3` | (0,1,1) / `.katex` (0,2,1) | (0,1,0)/(0,2,0) | 안전 |
| `.case-label` 가드 (671) | (0,2,0) | (0,1,0) | 안전 |
| `.case-block p:has(…)` 가드 | (0,4,1) / `.katex` (0,5,1) | (0,1,0)/(0,2,0) | 안전 |
| **인쇄 복원** `.print-body .solution-tone` | (0,2,0) / `.katex` (0,3,0) / `strong` (0,2,1) | globals (0,1,0)/(0,2,0)/(0,1,1) | **전부 안전** |

→ **위험한 것은 `.solution-tone .katex` 딱 한 줄**이고, 나머지 6곳은 `.has-key`만 지우면 된다
(주석의 특이도 수치는 갱신 필요). v1이 "인쇄도 자동 치환"이라 넘어간 부분은 **결과적으로 맞다**.

그리고 v1의 권장 해법 `div.solution-tone .katex`는 5곳이 전부 `div`인지에 의존한다
(실측: TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69 — 모두 div라
성립하지만, 렌더 사이트가 늘면 조용히 깨진다). **`.solution-tone.solution-tone .katex` (0,3,0)**
이 요소 타입 가정 없이 확실하다 → 이쪽을 채택한다.

### C7. `toneClass` 시그니처가 바뀐다 — 호출부 4곳 파급 (v1 누락)

`solutionHasKey` 삭제 → [keyTone.ts:59-62](lib/keyTone.ts#L59-L62)의 `blocks` 인자가 죽는다.
호출부 4곳을 함께 고쳐야 한다: TabBody:226 · ProblemTabContent:114 · EditorView:3352 ·
PrintableContent:69. (`isToneScoped` 단독 호출 2곳 — TabBody:50 · ProblemTabContent:34 — 은 무변경.)

함수 자체는 `isToneScoped(tabId) ? 'solution-tone' : ''` 한 줄로 줄지만 **유지한다** — 5곳이
같은 문자열을 쓰게 하는 단일 출처라는 존재 이유가 그대로다.

### C8. **테스트는 "필요시"가 아니라 반드시 깨진다** (v1 오판)

v1 Stage 5는 "`npm run test:case` 27개 재실행(로직 불변 → 통과 예상)"이라 적었으나:

- [tests/caseBlock.test.mjs:11](tests/caseBlock.test.mjs#L11)이 `extractKeySentences`를 **import**한다 → 삭제 즉시 실행 실패
- 144·150행: `extractKeySentences` **전용 테스트 2개** → 삭제 대상
- 182·191·213·239행: `item.keys` · `kind: 'keys'` 단언 → 전부 개정 대상

→ **테스트 개정은 Stage 3의 필수 산출물**이고, 개수는 27 → 약 23~24로 준다. `test:export`는
`exportMd.ts`가 타입을 문자열로 흘릴 뿐이라 무영향(C15).

### C9. `extractKeySentences` 삭제로 죽는 코드가 v1 기재보다 넓다

[solutionOutline.ts](lib/solutionOutline.ts)에서 함께 사라지는 것: `KEY_STRONG_RE_GLOBAL` import(13) ·
`OutlineItem.keys`(35)·`kind:'keys'`(23) · `joinKeys`(83-85) · `extractKeySentences`(68-81) ·
**텍스트 계열 스캔의 `pending`·`group`·`flush`(142-147, 163, 165)**. 남는 것은
"레거시 `**Case n.**` 행을 항목으로 승격"뿐이라, 루프가 `forEach` 한 줄로 줄어든다.
[OutlineSections.tsx](components/problem/OutlineSections.tsx)에서는 `CaseItem`의 keys 폴백(97-99)과
keys 렌더 분기(126-131), `firstCase`/`lastCase` 계산(114-115)이 사라진다.

### C10. 요약 게이트가 닫히는 범위를 정량화할 것

`hasOutlineContent`([solutionOutline.ts:172](lib/solutionOutline.ts#L172))가 통과시키던 조건 3개 중
`**` 발췌가 사라진다 → **제목도 경우도 없이 `**`만 있던 풀이**는 요약 토글이 disabled가 되고
ProblemView는 `mode: available ? mode : 'full'`([useOutlineState.ts:99](hooks/useOutlineState.ts#L99))로
full 강제된다. 이건 사양이지만, **OutlineToggle의 disabled 툴팁**
([OutlineToggle.tsx:35](components/ui/OutlineToggle.tsx#L35)) `'제목·핵심문장·경우 블록이 없습니다'`를
반드시 고쳐야 한다 — 안 고치면 "핵심문장을 넣었는데 왜 안 켜지나"가 된다.

### C11. §3-4는 **이어짓기 블록을 요약에서 완전히 지운다** — 수용하되 우회로를 문서화

이어짓기(제목행 없는 case)는 지금 `kind:'keys'`로만 요약에 나타난다
([solutionOutline.ts:130-133](lib/solutionOutline.ts#L130-L133)). §3-2가 그걸 없애고 §3-4가
스위치까지 빼면 **남길 방법이 0**이 된다.

→ **수용한다.** 이어짓기의 존재 이유가 "경우 사이에 다른 블록을 끼우는 것"이므로, 요약에
남기고 싶은 내용은 그 **사이 블록(case-gap)** 에 두고 그 블록의 스위치를 켜면 된다. 이 우회로를
사용 가이드에 명시할 것.
(기각한 대안: 제목 유무로 스위치를 분기 → **첫 줄을 타이핑하면 스위치가 사라지는** UX가 된다.)

### C12. 파일 좌표 오류 5건

| v1 기재 | 실제 |
|---|---|
| `ProblemTabContent.tsx` — ContentCard 패딩 | **`PublicViewerShell.tsx:128-136`** (ContentCard는 Shell 안에 있다) |
| `PublicViewerShell.tsx` — 2단 간격 | `ScrollColumn`은 **`PublicViewerShell.tsx:113-124`**, 다만 **손댈 필요 없다** → C13 |
| `OutlineToggle.tsx:35-38` | **34-38** (`title={disabled` 부터) |
| `globals.css:561-744` (case 절) | **561-759** — `.outline-chevron` 규칙까지가 한 덩어리다 |
| `docs/phasedocs/사용 가이드 — 강조와 **키**.md` | **`사용 가이드 — 강조와 톤.md`** |

(정확했던 것: `types/problem.ts:160` · `TabBody.tsx:29` · `EditorView.tsx:86,93,737,750` ·
`EditorView.tsx:3345-3350` · `UnifiedToolbar.tsx:798` · `caseBlock.ts:155-165` ·
`PrintStyles.css:48-50` · `globals.css:272-316` · `solutionOutline.ts:111`.)

### C13. 공유 2단은 **손댈 곳이 없다** (v1이 만든 유령 작업)

[PublicViewerShell.tsx:76-83](components/share/PublicViewerShell.tsx#L76-L83)에서 2단 분기도
**같은 `ContentCard`** 를 쓴다. rail은 ContentCard의 좌측 패딩(36px) 안에 들어가고, ContentCard와
ScrollColumn 어느 쪽에도 `overflow:hidden`이 없다. → **ContentCard 좌측 패딩 하나만 챙기면
1단·2단이 동시에 해결된다.** ScrollColumn 패딩·divider 간격은 무관하다.

덤으로 ContentCard는 `fontSize: 15` **고정**이라([PublicViewerShell.tsx:133](components/share/PublicViewerShell.tsx#L133))
공유 화면에는 em/px 혼합 위험 자체가 없다. 필요 거터 2.2em = 33px < 현행 36px → **현행으로도
잘리지는 않는다.** 다만 여유 3px는 답답하므로 40px로만 올린다(그리고 `maxWidth`의 +72px을 +76px로).

### C14. 코칭 블록의 좌측 바 위치가 **미정의이며 자기모순**이다

v1 §4-2는 "왼쪽 세로 바 0.25em + 본문. **좌단은 본문 0에서 시작(들여쓰기 없음)**"이라 적었는데,
바와 본문이 같은 x면 **겹친다**. 그렇다고 §1의 논리("구조 신호는 거터로")를 따라 바를 거터로
보내면, 경우 사이에 낀 코칭 블록에서 **rail과 정확히 같은 자리**가 된다.

→ **해결: 코칭 블록은 글상자(gana/roman/box) 규약을 따른다.**
바깥 좌단 = 본문 0, 바는 그 좌단에, 본문은 **상자 안쪽 패딩**만큼 들어간다.
**상자의 안쪽 패딩은 '들여쓰기 강조'가 아니다** — 글상자 3종이 이미 `padding: '12px 16px'`로
같은 일을 하고 있고 아무도 그것을 들여쓰기라 부르지 않는다
([EditorView.tsx:3414-3418](components/editor/EditorView.tsx#L3414-L3418)).
이러면 §2의 명칭 체계('들여쓰기' = callout 전용)와도 충돌하지 않고 rail(-1.8em)과도 겹치지 않는다.

### C15. §4의 "신규 배선 0"은 실측 결과 **대체로 맞다** — 확인한 소비처 전량

| 소비처 | 조치 |
|---|---|
| EditorView 타입 상수 6종 (82·102·112·127·134·145) | **4곳에 추가** (LABELS·TYPES·PRESETS·TEXT_BASED·SPLITTABLE / BORDERED는 제외) |
| 사이트별 `BORDERED_TYPES` 사본 4개 (TabBody:28 · FolderView:28 · ProblemTabContent:14 · PrintableContent:44) | **무변경** — 코칭은 bordered가 아니다 |
| `normalizeBlockType` (EditorView:138~) | 무변경 (레거시 2종 전용) |
| `exportMd.ts` (:71·:75) | **무변경** — 타입을 `<!-- block: {type} -->`로 그대로 흘린다. 아카이브에 `coach_important` 문자열이 남는다는 사실만 기록 |
| `EmptyBlockChips` (EditorView:180-185) | 무변경 (3칩 고정 목록) |
| `SCANNED_TYPES` (solutionOutline:55-57) | 추가 — §3-2 이후 용도가 "레거시 라벨 스캔"뿐이라 실효는 없지만 일관성 |

→ 실제 배선 = **타입 union 1줄 + EditorView 상수 4곳 + 렌더 5사이트 + CSS 2곳 + 아이콘 2개**.
v1의 판단이 맞다. 다만 "기계장치가 전부 타입 키"라는 근거는 위 표로 대체할 것(4개 사본의 존재는
CLAUDE.md의 "상수 6종은 전부 EditorView 상단"과 어긋나므로 오해를 부른다).

### C16. 인쇄 rail 침범량 재계산

`.print-body { font-size: 10pt }`([PrintStyles.css:34](components/print/PrintStyles.css#L34)) 확인.
`--case-rail-x` 인쇄값 -1.2em = 12pt = **4.23mm**. 그러나 v1은 **dot 반경을 빼먹었다** —
인쇄 dot 0.44em의 반경 0.22em = 2.2pt = 0.78mm를 더해 **실제 침범 5.01mm**, 단 간격 10mm에서
좌측 단 본문까지 **4.99mm** 남는다. (v1의 "≥5mm"는 우연히 맞았다.)
좌측 단의 rail은 페이지 여백 20mm 쪽이라 무관하다.

### C17. §1이 놓친 철거·주의 2건

- **`.section-head`의 `padding-left:1.6em` / `margin-left:-1.6em`([globals.css:707-708](app/globals.css#L707-L708))은
  토큰화하지 말 것.** 이건 chevron **히트 영역 폭**이지 rail 좌표가 아니다. 새 rail x(-1.8em)와
  숫자가 비슷한 것은 우연이고, 묶으면 나중에 한쪽만 조정할 때 다른 쪽이 끌려간다. "연결 금지" 주석 필수.
- **`.case-head`의 hover 배경 시작점이 3em → 0으로 바뀐다.** `padding-left`가 사라지므로 여닫이 줄
  hover가 본문 전폭을 덮는다. 의도된 변화인지 Stage 1에서 판정(chevron은 지금도 hover 상자 밖이라 무변화).

### §0-B. Phase 59 잔여 부채 진단(v1 R1~R8) 재확인

전수 대조 결과 **R1~R8은 전부 사실**이다. 근거만 보강한다:

- **R1** 좌표 체계 6개소 확인 — globals 567·573·579·581-583·664-666·684-690, PrintStyles 170-173·207-211.
- **R2·R4** 용어 과적재 — 확인.
- **R3** has-key 조건부 → 레거시 `**Case n.**`이 `KEY_STRONG_RE`에 걸려 톤이 켜진다: 확인
  ([keyTone.ts:21](lib/keyTone.ts#L21)은 타입·행 필터가 없다. `extractKeySentences`만 레거시를 거른다).
- **R5** [solutionOutline.ts:111](lib/solutionOutline.ts#L111) `!isCaseBlock(b.type)` vs
  [EditorView.tsx:737](components/editor/EditorView.tsx#L737) `isHeading ? null :` — 확인.
- **R6** phasedocs Phase 59의 §11-10·§11-11 참조 — 확인(본문 없음).
- **R7** 문구 3곳 — 확인. C10의 disabled 툴팁을 **네 번째**로 추가할 것.
- **R8** FolderView 잘림 — 확인. 단 원인 요소가 다르다(C3).

---

## 1. Case 블록 레이아웃 체계 수정 (구상 1)

### 1-1. 기조 (v1 유지)

rail·dot·chevron을 **본문 영역 왼쪽 바깥(거터)** 으로 내보내고, rail 때문에 신설한 2단
들여쓰기 체계를 전면 철거한다. 경우·하위 경우 본문의 좌단 = **일반 텍스트와 동일한 0**.
경우 안의 display 수식·리스트·① 밭은 **최상위 규칙을 그대로 승계**하므로 override가 전부 사라진다.

### 1-2. 좌표 (v2 확정 — C5 반영)

x = 0 이 본문 좌단.

```css
:root {
  --case-rail-x:    -1.8em;   /* rail·dot 중심선 */
  --case-chevron-x: -0.7em;   /* 요약 보기 chevron 중심 — 제목 줄 현행 중심과 동일 */
}
```

| 대상 | 좌표 | 산출 근거 |
|---|---|---|
| rail · dot (경우·하위 공통) | **-1.8em** | dot 우단 -1.54em → chevron 좌단 -1.2em과 여유 0.34em |
| 경우 줄 chevron | **중심 -0.7em** (폭 1em → 좌단 -1.2em) | 제목 줄과 자동 정렬 |
| 요약 보기 **제목 줄** chevron | **현행 그대로 (무변경)** | 현행 중심이 이미 -0.7em (`-1.2em + 1em/2`) |
| 경우·하위 경우 본문/제목행 | **0** | `padding-left` 삭제 |
| 개재 블록(case-gap) | **0** | `.case-gap-body` 철거 |
| 경우 안 수식·리스트·① 밭 | 최상위 규칙 승계 | override 전량 삭제 |
| 인쇄 rail | **-1.2em** (=12pt≈4.23mm) | 단 간격 10mm, dot 포함 침범 5.01mm (C16) |

**필요 거터 폭 = 2.06em(dot 좌단), 실사용 2.2em** → 33px@15 · 24px@11 · 53px@24.

**chevron em화 (필수)** — C5의 근본 원인 제거:

```css
.outline-chevron svg { width: 0.8em; height: 0.8em; }   /* size={12} 고정 px 무력화 */
.case-head .outline-chevron {
  width: 1em;                                    /* left를 '좌단'이 아니라 '중심'으로 다루기 위해 */
  left: calc(var(--case-chevron-x) - 0.5em);
  /* top: 0.9em · translateY(-50%)는 현행 유지 */
}
```

하위 경우의 시각 구분은 여전히 **dot 크기(0.52/0.3em) + 라벨(C1/C1a)** 뿐이다 → **Q1**.

### 1-3. CSS 변경 (globals.css 561-759 · PrintStyles.css 153-211)

**유지**: rail 조각·위 브리징·종단 기하(1.5em 규칙 3종 / 인쇄 14pt), 불투명 `--case-rail`,
dot 상태 문법(D19: 채움/테두리 + `--case-dot-fill`), `--case-ring`, `case-cont`, 라벨·제목행 굵기,
케이스 톤 가드(§3-3에 따라 `.has-key`만 제거), `.case-gap`의 rail 관통,
`.case-block::before`의 `margin-left:-0.5px` 헤어라인 보정, **G7(상하 padding 금지)**.

**치환**: 모든 `left: 1em` → `left: var(--case-rail-x)` (인쇄는 `0.7em` → `-1.2em`).

**삭제**(부록 B에 총목록):

```
globals.css   .case-block{padding-left:3em}(570) · .case-sub{6em}(573)
              .case-gap-body 3규칙 (579-583)
              .case-block .preview-content > ul/ol{margin-left:3em} (664-665)
              .case-block .preview-content p:has(.marker-circled){…!important} (666)
              .outline-keys 절 전체 (681-690)          ← §3-2로 소비처가 사라진다
PrintStyles   .case-block{padding-left:2em}(169) · .case-sub{4em}(170)
              .case-gap-body 3규칙 (172-174)
              .case-block > ul/ol{margin-left:2em} · > p:has(.marker-circled){…!important} (207-211)
lib/caseBlock caseGapClassName → 상수 'case-gap' 반환 (GAP_MEDIA_TYPES 소멸)
```

### 1-4. 여백 확보 (사이트별 — C3·C4·C13 반영)

| 사이트 | 현행 | 조치 |
|---|---|---|
| **ProblemView** (TabBody) | 라벨 열 `7 * contentFontSize` + `LABEL_GAP = 28` (px 고정) | **`LABEL_GAP`을 비례화: `2.8 * contentFontSize`** (42px@15) — 확정(Q6). 라벨 열 폭이 이미 `7 * contentFontSize`라 정합적이다. ⚠ **v1의 고정 56px은 24px 글꼴에서 2.33em이라 dot이 라벨에 거의 닿고, 11px에서는 5.09em으로 과하게 벌어진다** |
| **EditorView 미리보기** | `marginLeft: 24` + `padding:'20px 32px'` + `width: calc(35em + 64px)` | `marginLeft: 24` **유지** · `padding: '20px 32px 20px 3.5em'` · `width: calc(38.5em + 32px)`. → 띠→본문 = 24px + 3.5em(52.5px@15) ≈ **80px = 56(83c8f47) + 거터 24px**. 좌측만 키워 폭 증가를 +24px로 억제하고 **우측 패딩 32px·측정폭 35em을 둘 다 보존**한다 |
| **공유 (1단·2단 공용)** | ContentCard `padding:'32px 36px'` · `maxWidth: calc(35em + 72px)` | 좌측만 **40px**로(36px도 잘리진 않으나 여유 3px) · `maxWidth: calc(35em + 76px)`. **2단 별도 조치 없음(C13)** |
| **FolderView 카드** | 카드 `18px 22px`+hidden, 내부 div hidden·패딩 0 | **rail·dot을 그리지 않는다 — 확정(Q5)**. `.problem-card .case-block::before, .problem-card .case-gap::before, .problem-card .case-block::after { content: none }`. 근거: **카드뷰에 실제 풀이가 보일 일이 사실상 없다(덕수 판정 2026-08-20)** · 잘리는 지점이 내부 div라 패딩으로는 못 푼다(C3) · 잘린 rail보다 없는 rail이 낫다 · 라벨(`C1.`)은 텍스트라 그대로 남는다. ⚠ 내부 div에 패딩을 주는 안은 **경우 블록이 없는 절대다수 카드까지 2.2em 밀어** 근거와 반대 방향이라 기각 |
| **인쇄** | `padding-left: 2em` | §1-2 · C16 |

⚠ **TabBody 문제 탭 주의**: 문제 탭 본문만 클레이 카드다(`padding:'20px 24px'`+`marginLeft:-24`,
[TabBody.tsx:215-222](components/problem/TabBody.tsx#L215-L222)). 카드 좌단 = 본문 좌단이므로
경우 블록이 문제 탭에 있으면 **rail이 카드 배경 밖에** 그려진다. 요약 보기는 `scoped`(풀이)
전용이라 접힘 dot은 생기지 않아 `--case-dot-fill` 불일치는 없다 — 미관 문제만 Stage 1에서 판정.

### 1-5. 회귀 확인 (v1 유지 + 보강)

- **F1 형제 인접성**: 래퍼 규약(D15′) 무변경. 5사이트에서 `.case-block + .case-block` 매칭 재확인.
- **margin-left 금지**(§11-6): 새 좌표는 전부 `left`(절대배치)와 `padding`으로만.
- **브리지 1.5em / 인쇄 14pt**: 블록 마진(1.1em/11pt)을 안 건드리므로 **유효**하다 — 다만 Stage 1에서
  이음매 0.0px를 재확인할 것(padding 제거가 부모-자식 마진 collapse에 영향을 주지 않는지, G7의 역방향).
- `.outline-keys` 소멸에 따라 OutlineSections의 `firstCase`/`lastCase` gap 부착 로직도 함께 삭제.

---

## 2. 명칭 변경 (구상 2)

| 항목 | 현행 | 변경 | 범위 |
|---|---|---|---|
| callout 블록 | '강조문' | **'들여쓰기'** | UI 라벨만. **타입 id `callout` · 클래스 `.callout-block` · DB 불변** |
| box 블록 | '빈 글상자' | **'글상자'** | 동일 |

- 코드 좌표: [EditorView.tsx:86](components/editor/EditorView.tsx#L86) · [:93](components/editor/EditorView.tsx#L93).
  `BLOCK_TYPE_LABELS` 하나가 드롭다운·상단바·전체접기 바에 공급된다.
- 취지 반영: `.callout-block` CSS 주석([globals.css:546-548](app/globals.css#L546-L548) ·
  [PrintStyles.css:143](components/print/PrintStyles.css#L143)) 및 keyTone·solutionOutline 주석의
  "강조문" 표기를 "들여쓰기(구 강조문)"로 → **'강조'라는 낱말을 레이아웃 장치에서 퇴출**하는 것이 실익(R2).
- ⚠ `'(가), (나) 상자'` · `'ㄱ, ㄴ 상자'`는 그대로 — '글상자'와 계열감이 유지된다.

---

## 3. 강조와 '요약에 넣기'의 구조적·개념적 구별 (구상 3)

| 장치 | 역할 | 요약 보기와의 관계 |
|---|---|---|
| 들여쓰기 블록 (구 강조문) | **위치** | 무관 (스위치로만) |
| 강조 `**…**` (구 핵심문장) | **색·굵기** | **무관** (발췌 삭제) |
| 코칭 블록 (§4) | **신호** (전략·주의) | 무관 (스위치로만) |
| '요약에 넣기' 스위치 + 자동 항목 | **요약 구성** | 블록 단위로만 |

### 3-1. 버튼 이름

[UnifiedToolbar.tsx:798](components/editor/UnifiedToolbar.tsx#L798)
`'핵심문장 (**로 강조)'` → **`'강조 (**…**)'`**. 거부 툴팁(`'감쌀 수 없는 선택입니다 …'`)은 유지.
내부 식별자(`KeySentenceIcon`·`keyToggle*`)는 그대로 두되 주석에 "강조 토글(구 핵심문장)"로 병기.

### 3-2. 요약 보기에서 `**` 발췌 삭제

- `lib/solutionOutline.ts`: C9의 목록 전량 삭제. 행 단위 스캔 루프는 **레거시 `**Case n.**` 승격
  전용**으로 축소 유지(D2′는 계속 유효).
- `lib/keyTone.ts`: `KEY_STRONG_RE_GLOBAL` · `KEY_STRONG_RE` · `solutionHasKey` 삭제,
  `toneClass`는 §3-3 + C7에 따라 축소. `isToneScoped`는 5사이트 공용이므로 유지.
- `components/problem/OutlineSections.tsx`: C9의 목록 삭제. `item.kind`가 `'case' | 'block'`
  이항이 되므로 삼항 사슬을 이항으로 단순화.
- `app/globals.css`: `.outline-keys` 절(681-690) 삭제.
- **문구**: `OutlineToggle` 툴팁 3종(34-38) — disabled 포함(C10) — 과 EditorView 스위치 툴팁(750)을
  **'제목 · 경우 · 선택한 블록'** 기준으로 개정.
- **귀결**: 요약에 남는 것 = 제목 · 경우/하위 경우 제목행 · showInSummary 블록.
  접힌 경우는 **제목행만** 남는다(현행 "제목행 + 발췌"에서 축소).
- 사용 가이드의 "핵심문장 마커는 문장 전체 단위로 감쌀 것" 규칙 폐기(R4 해소) — 이제 `**`는
  조각이어도 자유롭다.

### 3-3. 톤 다운을 기본 설정으로

**has-key 조건 자체를 제거**한다. 풀이·추가 탭(`isToneScoped` 유지)은 마커 유무와 무관하게
항상 dim이고 `**` 구간만 primary + 600으로 앞에 낸다.

```css
/* .has-key 소멸 — 7개 규칙에서 클래스 하나씩 제거 (globals.css 284-316, 668-673) */
.solution-tone                          { color: var(--tone-dim); }
.solution-tone.solution-tone .katex     { color: var(--tone-dim); }   /* ← C6: (0,3,0)로 승격 필수 */
.solution-tone strong,
.solution-tone strong .katex            { color: var(--text-primary); }
.solution-tone strong                   { font-weight: var(--weight-semibold); }
/* h1~h3 가드 · h1~h3 .katex 복귀 · .case-label 가드 · 제목행 가드 = .has-key만 제거 (전부 안전, C6) */
```

- `PrintStyles.css:48-50`도 `.has-key`만 제거 — **특이도 전량 안전**(C6). 인쇄는 지금처럼
  100% 톤 복원 + `**`만 700 (Phase 58 D6 불변).
- **주석 갱신 필수**: globals 286-288·312·670과 PrintStyles 45의 특이도 수치가 전부 stale해진다.
- **회귀(의도된 외관 변화) — 수용 확정(Q7)**: C2의 표 — `**` 없던 풀이의 **수식이 크게 물러난다**.
  Phase 58의 "마커 없는 문항은 픽셀 무변화(opt-in)" 원칙을 **의도적으로 폐기**하는 것이므로
  문서에 명기한다. 낙차가 실사용에서 과하면 `--tone-dim`을 `#5D5647`(현행 본문색)로 되돌려
  "글자 무변화 + 수식만 하강"으로 완화할 수 있다 — **토큰 한 줄이라 되돌리기 비용이 0**이다.
- R3(레거시 `**Case n.**`이 톤을 오발동시키던 문제)은 조건이 사라져 **함께 소멸**한다.
- v2 검증 항목 "모든 선택 시 has-key 컨테이너 불변"은 대상이 소멸 → 삭제.

### 3-4. '요약에 넣기' → 블록 단위로 단순화

- **자동 포함**: 제목 블록 · 경우 제목행 · 하위 경우 제목행. `buildOutline`의 heading·case 처리
  그대로 → 코드 변경 없음.
- **추가 포함**: `showInSummary` 스위치를 켠 블록(현행 유지).
- **R5 해소**: [EditorView.tsx:737](components/editor/EditorView.tsx#L737)의 노출 조건을
  `isHeading` → `isHeading || isCaseBlock(block.type)`. 경우 블록에 남아 있던 `showInSummary: true`는
  제목 블록 전례와 같이 "읽히지 않는 값"이라 그대로 둔다(마이그레이션 0).
- **이어짓기 손실은 수용 + 우회로 문서화** (C11).

---

## 4. 코칭 블록 도입 (구상 4)

GitHub alert의 시각 문법을 **블록 타입**으로 가져온다. 블록 = 하나의 편집 단위라는 모델이
이미 있으므로 `> [!IMPORTANT]` 인라인 문법은 지원하지 않는다(타입이 의미를 나른다. raw_text는 본문만).

### 4-1. 데이터 모델

**additive 타입 2종**: `coach_important` · `coach_caution`.

- 단일 타입 + variant 필드도 검토했으나, 블록 기계장치가 전부 타입 키라 **타입 2개 추가의
  신규 배선이 0**이다(C15의 실측 표). case/subcase(Phase 59)·list/callout(Phase 57)과 같은 패턴.
  항목 추가(구상 4-2-4)는 타입 하나 더 치면 끝난다.
- `types/problem.ts:160` union에 2종. **Firestore 규칙 0 · 마이그레이션 0 · 서버 0**.
- 라벨: `'코칭 (Important)'` · `'코칭 (Caution)'` → **Q2**. 프리셋 `''`. TEXT_BASED·SPLITTABLE 포함,
  **BORDERED_TYPES에는 넣지 않는다**(자체 스타일). `SCANNED_TYPES`에도 추가(일관성, 실효 없음).

### 4-2. 렌더 · CSS

5사이트 공통, **callout 분기 바로 앞**(= 5사이트의 유일한 공통 앵커, CLAUDE.md F1)에 삽입.
`.coach-block` + `.coach-important` / `.coach-caution`.

```
구조     [바 0.25em][안쪽 패딩 1em][제목 줄 = 아이콘 + 라벨]
                                   [본문]
좌단     상자 바깥 좌단 = 본문 0. 안쪽 패딩은 들여쓰기가 아니다 — 글상자 3종과 같은 규약 (C14)
상하     K1 (1.1em / 인쇄 11pt)
제목 줄  아이콘 + 영문 라벨. 색·600 굵기, 본문 위 한 줄
아이콘   components/ui/Icons.tsx 신설 2종 — 그 파일 규격 준수: viewBox "0 0 24 24",
         strokeWidth 1.8, fill="none", stroke={color} (기본 currentColor), size prop
         Important = 말풍선+느낌표(octicon report 계열) · Caution = 팔각+느낌표(octicon stop 계열)
         ⚠ lucide·octicons 의존성을 추가하지 않는다 — 경로 직접 작성
색 토큰  --coach-important: #6639ba;   --coach-caution: #a40e26;
```

**색 근거** (부록 A · **구속 조건은 `#E8DFCE`** — C1):
GitHub light 기본값(`#8250df` 3.81 / `#cf222e` 4.05)은 텍스트 4.5:1에 **미달**한다. 라벨 어절이
텍스트이므로 같은 팔레트의 700 계열(`#6639ba` **5.55** / `#a40e26` **5.95**)로 치환한다.
바·아이콘(비텍스트 3:1)도 같은 토큰 하나로 통일 → 토큰 2개로 끝.

- **톤**: 본문은 `.solution-tone`의 dim을 그대로 받는다(코칭은 신호를 테두리·색으로 이미 갖는다).
  본문 안 `**`는 평소처럼 앞으로. 라벨·바·아이콘은 **톤 불변**(dot·rail과 같은 "구조 신호는 톤 불변" 원칙).
  ⚠ 코칭 색 vs dim 본문(`#675F52`) 대비는 1.17~1.25:1로 **낮다** — 라벨을 색만으로 구분하려 하지 말고
  **아이콘 + 600 굵기**를 반드시 함께 쓸 것 (부록 A 하단).
- **인쇄**: 흑백 기준 → 바 `#000` 0.3mm + 라벨 700. 컬러 인쇄를 원하면 `--coach-*` 교체 1줄
  (`--case-dot: #000` 전례). `break-inside`는 걸지 않는다(코칭은 길 수 있다 — 경우 블록과 같은 판단).
  제목 줄만 `break-after: avoid`.
- **경우 사이 개재 시**: `.case-gap`으로 rail 관통. 바(0em)와 rail(-1.8em)은 §1·C14로 겹치지 않는다.
- **요약 보기**: 자동 포함 없음. `showInSummary` 스위치로만 → 코드 추가 0.

---

## 5. 파일 좌표 일람 (`fdeac85` 기준 · 정정판)

```
# §1 레이아웃
app/globals.css:561-759          case + 요약 보기 절 재작성 (좌표 토큰화 · 들여쓰기 철거 · outline-keys 삭제)
app/globals.css::root(≈166)      --case-rail-x · --case-chevron-x 신설
app/globals.css:707-708          ⚠ .section-head 1.6em은 히트 영역 — 토큰화 금지 (C17)
app/globals.css:728-733          .case-head .outline-chevron → width:1em + left:calc(...)
app/globals.css:753-759          .outline-chevron svg 크기 em화 (C5)
components/print/PrintStyles.css:153-211   인쇄 case 절 재작성 (동일 원리 · rail -1.2em)
lib/caseBlock.ts:155-165         caseGapClassName 단순화 (GAP_MEDIA_TYPES 삭제)
components/problem/TabBody.tsx:29,165      LABEL_GAP → 2.8 * contentFontSize (비례화)
components/editor/EditorView.tsx:3345-3350 미리보기 폭·패딩 (marginLeft 24 유지)
components/share/PublicViewerShell.tsx:128-136  ContentCard 좌측 40px · maxWidth +76px   ← v1 파일 오류 정정
app/globals.css (case 절 말미)             .problem-card 스코프 3줄 — 카드에서 rail·dot 미표시 (Q5)
  └ **FolderView.tsx는 무변경** — `className="problem-card"`가 이미 있다(:503).
    v1의 "카드 패딩 + 좌표 override"는 대상이 틀렸다(C3)
components/problem/OutlineSections.tsx:114-131  firstCase/lastCase · keys 분기 삭제

# §2 명칭
components/editor/EditorView.tsx:86,93     BLOCK_TYPE_LABELS

# §3 강조·요약·톤
components/editor/UnifiedToolbar.tsx:798   버튼 title
lib/solutionOutline.ts:13,23,35,68-85,142-165   keys 계열 삭제 · 스캔 루프 축소 (C9)
lib/keyTone.ts:21,30,40-42,59-62           RE 2종·solutionHasKey 삭제 · toneClass 축소 (C7)
  └ 호출부 4곳: TabBody:226 · ProblemTabContent:114 · EditorView:3352 · PrintableContent:69
app/globals.css:284-316, 668-673           .has-key 소멸 + .katex 특이도 승격 (C6)
components/print/PrintStyles.css:44-50     .has-key 제거 + 주석 특이도 갱신
components/editor/EditorView.tsx:737,750   스위치 노출 조건 + 툴팁
components/ui/OutlineToggle.tsx:34-38      툴팁 3종 (disabled 포함 — C10)
tests/caseBlock.test.mjs:11,144-154,182,191,213,239   **필수 개정** (C8)

# §4 코칭
types/problem.ts:160                       union에 coach_important · coach_caution
components/editor/EditorView.tsx:82-136    LABELS · TYPES · PRESETS · TEXT_BASED · SPLITTABLE (4곳, BORDERED 제외)
components/ui/Icons.tsx                    아이콘 2종 (viewBox 24 · strokeWidth 1.8 규격)
app/globals.css                            .coach-block 절 + --coach-* 토큰 2개
components/print/PrintStyles.css           .print-body .coach-block
렌더 5사이트 (callout 분기 **바로 앞**)      EditorView:3438 · TabBody:141 · FolderView:310 ·
                                           ProblemTabContent:84 · PrintableContent:103
lib/solutionOutline.ts:55-57               SCANNED_TYPES에 2종

# 문서 (Stage 5)
docs/phasedocs/Phase59 요약 보기·경우 블록.md      R6 정정(§11-10·11-11 참조) + 59a 확정본 절
docs/phasedocs/사용 가이드 — 강조와 톤.md          §2·§3 전면 개정   ← v1 파일명 오류 정정
CLAUDE.md · docs/roadmap.md                        블록 타입 2종 · 명칭 · 톤 기본값 · 좌표 토큰
                                                   + **#EDE6DA → #E8DFCE 표기 정정 (C1)**
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0** — Phase 59와 같이 순수 클라이언트 작업.

---

## 6. Stage 계획과 검증

### Stage 1 · 레이아웃 철거·거터 이주 (§1) — 파급이 가장 크므로 먼저

- 5사이트 × {경우 3 + 하위 2, 이어짓기, 개재 이미지·목록·글상자} 스케치 대조
- **좌표 실측**: rail·dot·chevron의 x. **글꼴 11 / 15 / 24px 세 조건 전부** (C5의 겹침이 11px에서만
  났다 — 한 크기만 보면 못 잡는다)
- 4경계 레일 연속성 / 브리지 이음매 0.0px
- **클리핑 경로**: 공유 ContentCard · 인쇄 multicol(**Q4**). FolderView 카드는 Q5로 rail·dot이
  아예 없어야 한다 — **잘린 채 남아 있지 않은지**를 확인한다(`.problem-card` 스코프가 안 먹으면
  잘린 조각이 보인다). 다른 4사이트에는 예외가 새지 않았는지 함께 확인
- 여백 판정: ProblemView 라벨→rail→본문 / EditorView 채널 / 공유 카드 (구상 1-2-4 "답답하지 않게")
- **Q1 판정 카드**: 들여쓰기 없이 하위 경우가 dot 크기 + 라벨만으로 구별되는가
- 회귀: 최상위 수식 3em·리스트·① 좌표 무변화 / `.case-head` hover 전폭화 판정(C17) /
  F1 형제 인접성 / Phase 56 스크롤(getBoundingClientRect 기반이라 무영향 예상)

### Stage 2 · 명칭 (§2)

드롭다운 · 상단바 · 전체접기 바 3곳에서 라벨 확인. 문서 갱신과 묶는다.

### Stage 3 · 톤 기본화 + 요약 단순화 (§3)

- **`**` 없는 풀이**: 본문 소폭·**수식 대폭** dim (C2의 표와 일치하는가) / 문제 탭 불변 / 인쇄 100% 복원
- **`**` 있는 풀이**: 픽셀 대조 → has-key 시절과 **완전 동일**해야 한다
- **DevTools computed 확인**: `.katex`의 최종 color가 `.tone-baseline .katex`가 아니라
  `.solution-tone.solution-tone .katex`에서 오는가 (C6의 유일한 위험 지점)
- 요약 보기: 발췌 소멸 / 접힌 경우 = 제목행만 / 게이트가 닫히는 문항이 늘어나고 툴팁이 그것을 설명하는가
- 레거시 `**Case n.**` 문항: 톤·요약 양쪽 현행과 동일 (R3 소멸의 부작용 없음)
- **`npm run test:case` 개정 후 전량 통과** (C8 — 개정 자체가 산출물)

### Stage 4 · 코칭 블록 (§4)

- 추가·저장·재로드·undo·⌘B 분할(뒤 블록 text) / 5사이트 렌더 / 흑백 인쇄
- 명암비 확인 (부록 A) / **dim 본문 위에서 라벨이 아이콘+굵기로 읽히는가** (색 대비 1.2:1뿐)
- 경우 사이 개재 시 rail 관통 + 바와 간섭 없음 (C14)
- `exportMd` 산출물에 `<!-- block: coach_important -->`가 정상 기록되는가

### Stage 5 · 통합·문서

- roadmap · CLAUDE.md (블록 타입 2종 · 명칭 · 톤 기본값 · 좌표 토큰 · **#E8DFCE 정정**)
- 사용 가이드 전면 개정: "강조의 두 축" → **"위치(들여쓰기) · 색(강조) · 신호(코칭) · 요약(스위치)" 4분법**
  + 이어짓기 우회로(C11)
- R6 문서 정정 · Phase 59 확정본에 "레이아웃 §4·§11-1~11-7은 59a로 대체" 표기

---

## 7. 결정 사항 (미결 0)

Q1~Q4는 v1에서 기본안 채택, **Q5~Q7은 2026-08-20 덕수 확정**. 전건 결정되어 착수 가능하다.
폴백은 폐기가 아니라 **Stage 실물에서 문제가 드러났을 때의 지정 경로**다.

| # | 확정 | 근거 | 폴백 (Stage에서 문제 발견 시) |
|---|---|---|---|
| **Q1** | 하위 경우 신호는 dot 크기(0.52/0.3em) + 라벨(C1/C1a) — 들여쓰기 없음 | 구상 1-2-2 (들여쓰기 전면 철거) | (a) 하위 dot을 rail 오른쪽 별도 열로 (b) 하위 라벨 자간·색 차등 |
| **Q2** | 코칭 라벨 어절은 영문 `Important` / `Caution` | GitHub alert 시각 문법을 그대로 가져온다(구상 4-2-2) | 한글 전환 시 라벨 상수 1곳 교체 |
| **Q3** | EditorView 미리보기 `paddingLeft: 3.5em` · `width: calc(38.5em + 32px)` · `marginLeft: 24` 유지 | 83c8f47의 채널 56px + 거터 24px (C4) | Stage 1 육안 판정으로 3.0~4.0em 조정 |
| **Q4** | 인쇄 rail은 음수 좌표(-1.2em) | 단 간격 10mm에 침범 5.01mm, 4.99mm 잔여 (C16) | multicol에서 잘리면 인쇄만 "본문 1.2em 들여쓰고 rail 0" |
| **Q5** | **FolderView 카드는 rail·dot을 그리지 않는다** | **카드뷰에 실제 풀이가 보일 일이 사실상 없다(덕수)** + 잘림 지점이 내부 div라 패딩으로 못 푼다(C3) | 카드에서도 rail이 필요해지면 내부 div `paddingLeft: 2.2em` + 카드 좌우 패딩 축소 (24px 글꼴에서 재잘림 주의) |
| **Q6** | **`LABEL_GAP`을 `2.8 * contentFontSize`로 비례화** | 라벨 열 폭이 이미 `7 * contentFontSize`. 고정 px은 G8 계열 단위 혼합 재발 (C5) | 고정 px 회귀 시 48px — 11~20px 구간에서만 안전 |
| **Q7** | **톤 기본화로 `**` 없던 풀이의 수식이 눈에 띄게 물러나는 것을 수용** | 구상 3-1-4-1의 명시적 결정. Phase 58 opt-in 원칙의 의도적 폐기 (C2) | `--tone-dim`을 `#5D5647`로 되돌려 "글자 무변화 + 수식만 하강" — **토큰 1줄, 되돌리기 비용 0** |

⚠ **Q5는 렌더 사이트 5곳 중 FolderView 하나만의 예외다.** 나머지 4곳(EditorView 미리보기 ·
ProblemView · 공유 뷰어 · 인쇄)은 rail을 정상 표시한다 — 예외를 확대 적용하지 말 것.

---

## 부록 A. 명암비 (재계산 · 배경 `#E8DFCE` 기준)

산식 `((c+0.055)/1.055)^2.4`. 텍스트 4.5:1 · 비텍스트 3:1.

| 전경 | 클레이 `#F4EFE7` | **카드 `#E8DFCE`** | 공유 `#FEFDFB` | 백지 |
|---|---|---|---|---|
| GitHub Important `#8250df` | 4.41 | **3.81 ✗** | 4.96 | 5.05 |
| **채택 `#6639ba`** | 6.42 | **5.55 ✓** | 7.22 | 7.34 |
| GitHub Caution `#cf222e` | 4.68 | **4.05 ✗** | 5.27 | 5.36 |
| **채택 `#a40e26`** | 6.87 | **5.95 ✓** | 7.74 | 7.87 |
| `--tone-dim #675F52` (참고) | 5.50 | **4.76 ✓** | 6.19 | 6.30 |
| `--case-dot #BC5F3F` (참고) | 3.79 | **3.28 ✓** (여유 0.28) | 4.26 | 4.33 |

**코칭 색 vs dim 본문(`#675F52`)**: Important 1.17 · Caution 1.25 — **인접 대비가 거의 없다.**
라벨은 반드시 아이콘 + 600 굵기와 함께 쓸 것(§4-2).

## 부록 B. 이 문서가 삭제를 명시한 것

케이스 들여쓰기 3/6/9em 전부 · `.case-gap-body` · 케이스 내부 ul/① override(`!important` 2건 포함) ·
`.outline-keys` · `extractKeySentences`·`joinKeys`·`kind:'keys'`·`OutlineItem.keys` ·
`solutionHasKey`·`KEY_STRONG_RE`·`KEY_STRONG_RE_GLOBAL` · `.has-key` 클래스 ·
`pending`/`group`/`flush` 스캔 보조 · case 계열의 '요약에 넣기' 스위치 ·
`caseGapClassName`의 타입 분기(`GAP_MEDIA_TYPES`) · OutlineSections의 `firstCase`/`lastCase`.

**삭제가 곧 이 Phase의 산출물이다** — Phase 59가 옳은 의도로 쌓은 표현 계층을,
데이터 계약을 건드리지 않고 걷어낸다.

## 부록 C. 별건 발견 (이 Phase 밖 · prelaunch 버그 목록 후보)

1. **FolderView 카드 페이드 색 불일치** — [FolderView.tsx:590](components/problem/FolderView.tsx#L590)의
   그라데이션이 `rgba(237,230,218,0)`(=`#EDE6DA`)로 하드코딩돼 있는데 카드 배경은 `#E8DFCE`다
   (커밋 `78a780f`이 토큰만 바꾸고 하드코딩 값을 못 따라갔다). 주석이 명시한 "회색 끼임 방지"
   취지가 현재 깨져 있다. → `rgba(232,223,206,0)`.
2. **`globals.css:282` 주석 stale** — `--tone-dim`은 이미 138행에 정의돼 있다(C2).
3. **CLAUDE.md·Phase 58·59 문서의 `#EDE6DA` 전량 stale** (C1) — Stage 5에서 일괄 정정.
4. **`BORDERED_TYPES` 사본 4개** — CLAUDE.md의 "블록 타입 상수 6종은 전부 EditorView 상단"과
   실제가 어긋난다(TabBody:28 · FolderView:28 · ProblemTabContent:14 · PrintableContent:44).
   이번 Phase에서 손댈 필요는 없으나 규약 문구를 사실에 맞출 것.
