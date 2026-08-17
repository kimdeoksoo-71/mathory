# Phase 59 — Structure at a Glance: 풀이 접기·펼치기 · '경우(Case)' 블록 **v1**

작성일: 2026-08-17 · 작성: web Claude (Fable) — 덕수 구상안(2026-08-17) 검토 · 후속 v2(CLI 실코드 대조) 전제

> **확정 기록 (2026-08-17)** — 미결 Q1~Q4 전건을 덕수가 **기본안(권장안)대로 확정**했다: Q1 '경우'/'하위 경우' · Q2 `C-1.` 표기 · Q3 클릭 토글은 outline 모드 전용 · Q4 전문 섹션 펼침 손잡이 둠. **본 문서에 미결 항목 없음** — 이대로 v2(CLI) 착수 기준이 된다.

> **검증 한계 명시** — 이 세션은 레포를 체크아웃하지 못한다. 코드 사실관계는 (a) 프로젝트에 동기화된 소스 스냅샷, (b) Phase 57 v3 부록 A(`8da5c42` 실측), (c) Phase 58 v2·v3 실측 기록에 근거했다. **파일:행 좌표·현행 값은 전부 v2(CLI)의 착수 전 실측(T0) 대상**이며, 이 문서는 방향·설계·결정 후보를 확정하는 v1이다.
>
> **선행 의존** — 접힘 화면의 "핵심문장"은 Phase 58의 `**` key 마커를 전제한다. **Phase 58 배포 완료 후 착수**할 것(§9 T0에 확인 항목).

---

## 0. 구상안 검토 — 수용·쟁점·제안

구상안의 두 축(접기/펼치기, case 분기 표현 개편)은 모두 수용한다. 방향 자체가 옳다: 긴 풀이의 문제는 "다 읽기 전에는 구조가 안 보인다"는 것이고, 접힘 화면 = 제목 + 핵심문장 + 케이스 제목행은 정확히 **풀이의 뼈대(skeleton)** 다. Phase 58이 만든 두 자산(제목 블록 위계, key 마커)이 여기서 회수된다.

구상안 항목별 대응:

| 구상 | 판정 | 반영 위치 |
|---|---|---|
| 1-1 ProblemView·공유뷰에서 구현 | 수용 — EditorView·FolderView·인쇄는 제외(근거 §2.1) | D4 |
| 1-2 접기 = 제목·핵심문장·Case 제목만 | 수용 — 표시 방식은 "발췌 렌더"로 제안(쟁점 ①) | D2 · §3 |
| 1-3 전체 접기/펼치기 토글, '풀이' 라벨 아래 | 수용 | D6 · §2.3 |
| 1-4 단락 접기/펼치기(전체접기 상태에서, 제목 hover·클릭) | 수용 — 상태 모델로 정식화 | D3·D13 · §4 |
| 2-3-1 Case 블록 신설 + 한글 이름 강구 | 수용 — 이름 후보 비교 후 **'경우' 추천**(쟁점 ③) | D7·D8 · §5 |
| 2-3-2 강조문처럼 왼쪽 여백 | 수용 — callout과 동일 기준값 재사용 | D11 · §6 |
| 2-3-3 기호 간결화 C-1, C-2, C-2-a | 수용 — 단 **자동 번호**로 제안(쟁점 ②) | D9 · §5.3 |
| 2-3-4 선분·점으로 시인성 | 수용 — rail + dot, 스케치 재현 | D11 · §6 |
| 2-3-5 하위케이스 들여쓰기 + 디자인 강구 | 수용 — 들여쓰기 + 가는 inner rail + 작은 dot 제안 | D12 · §6.3 |
| 2-3-6 전체접기 시 케이스 제목행·핵심문장만 | 수용 | §3.2 |
| 2-3-7 케이스 제목행 hover·클릭 토글 | 수용 — outline 모드에서만(쟁점 ④) | D13 · §4 |

### 쟁점 4건 (v1 판단 + 근거)

**① "핵심문장만 남긴다"의 구현 단위.** key 마커는 문단 안 인라인 구간(`**…**`)이다. 선택지는 세 가지: (A) key가 포함된 **블록 전체**를 남긴다 — 구현 최소지만 "핵심문장만"이 아니라 취지 훼손. (B) key가 포함된 **문단(p)만** 남긴다 — CSS `:has(strong)`로 가능하지만 문단 안 비(非)key 텍스트가 그대로 남는다(텍스트 노드는 CSS로 못 감춘다). (C) raw_text에서 `**…**` 구간을 **발췌해 접힘 전용으로 렌더** — "제목 + 핵심문장"이라는 구상 문면에 정확히 부합. **v1은 C안(발췌 렌더)을 기본안으로 한다**(§3.2). 발췌 구간에 수식이 섞여도 기존 마크다운·KaTeX 파이프라인을 그대로 통과시키므로 추가 렌더러가 필요 없다.

**② C-1, C-2 기호는 자동 번호여야 한다.** 사용자가 직접 타이핑하면 케이스 삽입·삭제·순서 변경 때마다 번호를 손으로 고쳐야 하고, 하위케이스 문자(a, b)까지 걸리면 오타가 구조 오류로 보인다. 블록 순서에서 **렌더 시 자동 계산**하면 편집 내성이 생기고 raw_text에는 번호가 아예 없어 데이터도 깨끗하다. 편집창에는 조건만 쓴다: 첫 줄 `$a>1$인 경우` → 렌더 `● C-1. $a>1$인 경우`.

**③ 한글 이름.** 후보 비교:

| 후보 | 장점 | 단점 |
|---|---|---|
| **경우** (추천) | 수학 관용("경우를 나누면", "경우 1")과 정확히 일치 · 짧다 · 하위는 '하위 경우'로 자연 확장 | 일상어라 블록명으로서 특이성 낮음 |
| 경우 나누기 | 행위를 정확히 서술 | 길다 — 드롭다운·칩에서 부담 |
| 갈래 | 고유어, 분기 이미지 선명 | 수학 텍스트 관용에 없음 — 학습 비용 |
| 분기 | 간결 | 프로그래밍·행정 냄새, 수학 어감 아님 |

**확정(Q1·Q2): 라벨 '경우' / '하위 경우'**, 타입 키는 `case` / `subcase`. 렌더 기호는 구상 확정대로 `C-n` 유지(한글 라벨과 화면 기호는 별개 층위 — "C"는 Case의 머리글자로 시인성·간결성 목적).

**④ 클릭 토글의 발동 조건.** 구상 1-4-1("전체접기 상태에서 동작")을 케이스 제목행에도 일관 적용한다. 전체 펼침(현행과 동일한 화면)에서 제목·케이스행이 클릭에 반응하면 (a) 기존 독서 동작에 새 인터랙션이 침입하고 (b) 텍스트 선택·복사와 충돌한다. **접힘(outline) 모드에서만 클릭 가능** — 전체 펼치기로 복귀하면 화면은 현행과 픽셀 단위 동일(변화 0 원칙). **확정(Q3).**

---

## 1. 결정표

| # | 결정 | v1 기본안 |
|---|---|---|
| D1 | 접힘 단위 | **제목 기준 섹션 모델** — heading 블록이 섹션 경계, 첫 제목 앞은 전문(前文) 섹션 |
| D2 | 핵심문장 표시 | **C안 발췌 렌더** (`**…**` 구간만 접힘 전용 렌더) |
| D3 | 상태 모델 | `mode: 'full' \| 'outline'` + `openSections` + `openCases` — **비영속**(세션 UI 상태, 저장 안 함) |
| D4 | 적용 범위 | **ProblemView + ProblemTabContent(공유뷰)만.** EditorView·FolderView·인쇄 제외 |
| D5 | 기본 상태 | **full(전체 펼침)** — 기존 문항 열람 화면 변화 0 |
| D6 | 토글 버튼 | ProblemView '풀이' 라벨 아래 1개(토글) · 공유뷰는 풀이 탭 콘텐츠 상단 동일 버튼 |
| D7 | Case 데이터 모델 | **additive 타입 2종 `case`/`subcase`** (depth 필드 없음 — 스키마 불변, 마이그레이션 0) |
| D8 | 한글 라벨 | **'경우' / '하위 경우'** (§0 쟁점 ③) |
| D9 | 제목행 규약 | **블록 첫 줄 = 제목행(조건)**, 둘째 줄부터 내용. 번호 `C-n`/`C-n-a`는 **렌더 시 자동** |
| D10 | 번호 리셋 범위 | **섹션 단위** — heading을 만나면 n 리셋. 섹션 안에서는 케이스 사이에 다른 블록이 끼어도 이어서 센다 |
| D11 | 시각 표현 | **rail(세로 선분) + dot(제목행 점)**, 왼쪽 여백은 callout-block 기준값 재사용, 인접 case 블록은 rail 마진 브리징 |
| D12 | 하위케이스 | 추가 들여쓰기 1단 + **가는·흐린 inner rail + 작은 dot** + `C-n-a` |
| D13 | 클릭 토글 스코프 | **outline 모드에서만** 제목·케이스행 클릭 가능 (§0 쟁점 ④) |
| D14 | 빈 스켈레톤 가드 | 제목·key·케이스가 하나도 없는 풀이는 **접기 버튼 비활성**(툴팁: "제목·핵심문장·경우 블록이 없습니다") |

---

## 2. P1 — 섹션 모델 · 전체 접기/펼치기

### 2.1 적용 범위 (D4)

- **ProblemView** — 구상 명시. 토글 버튼의 홈.
- **ProblemTabContent(공유뷰)** — 구상 명시. "다른 사람이 읽는 화면"이야말로 structure at a glance의 주 수혜자.
- **EditorView 미리보기 제외** — 편집 중에는 전체가 보여야 블록 조작과 어긋나지 않는다. 접힘 미리보기는 후속 후보.
- **FolderView 제외** — 목록 밀도의 뷰라 별도 판단 필요. 후속 후보.
- **PrintableContent 제외** — 인쇄는 항상 전체. 접힘 상태가 인쇄에 새어들지 않아야 한다(렌더러가 분리되어 있어 자연 충족 — v2 확인만).

### 2.2 섹션 모델 (D1)

```ts
// lib/solutionOutline.ts (신규 — ProblemView·ProblemTabContent 공유)
export interface SolutionSection {
  id: string;              // 안정 키: 섹션 첫 블록의 block id
  heading: Block | null;   // null = 전문(첫 제목 앞) 섹션
  blocks: Block[];         // heading 제외 본문 블록들
}
export function buildSections(blocks: Block[]): SolutionSection[];

// 접힘 화면용 발췌 — Phase 58 KEY_STRONG_RE 재사용 (lib/keyTone.ts에서 export)
export function extractKeySentences(raw: string): string[];   // `**…**` 전역 매치, 마커 포함 반환
```

- 경계는 **heading 블록**("해당 제목 ~ 다음 제목 사이" — 구상 1-4-3과 동일 정의). 마지막 섹션은 끝까지.
- `extractKeySentences`는 마커를 **포함해** 반환한다 — 접힘 화면에서도 기존 파이프라인(strong → 톤·굵기 규칙)을 그대로 태우기 위함. 수식이 섞인 key(`**$x=1$일 때 최소**`)도 추가 처리 없음.
- memo: blocks 참조 동일성 기준 useMemo(열람 뷰라 재계산 빈도 자체가 낮다).

### 2.3 토글 버튼 (D6)

- 위치: ProblemView **'풀이' 라벨 바로 아래**(구상 1-3). 공유뷰는 풀이 탭 콘텐츠 최상단.
- 형태: 텍스트+아이콘 토글 1개 — `⌃⌃ 전체 접기` ↔ `⌄⌄ 전체 펼치기`(lucide `chevrons-up`/`chevrons-down` — Phase 55c 아이콘 정비 관례 준수, v2에서 기존 아이콘 세트와 정합 확인).
- 동작: `전체 접기` → `mode='outline'`, openSections·openCases 초기화(전부 닫힘). `전체 펼치기` → `mode='full'`(현행 화면과 동일).
- D14 가드: 섹션 heading 0개 **그리고** key 0개 **그리고** case 블록 0개면 버튼 disabled.

### 2.4 상태 (D3)

```ts
const [mode, setMode] = useState<'full' | 'outline'>('full');          // D5
const [openSections, setOpenSections] = useState<Set<string>>(new Set());
const [openCases, setOpenCases] = useState<Set<string>>(new Set());    // blockId
```

비영속 확정 — URL 파라미터·localStorage 동기화는 범위 밖(후속 후보로 로드맵 메모만).

---

## 3. P2 — 접힘(outline) 화면 구성

### 3.1 섹션 렌더 규칙

outline 모드에서 각 섹션은:

```
[제목행]  ← heading 블록 렌더 + 우측 chevron. 클릭 타깃은 행 전체 (§4)
  섹션이 열려 있으면 → 본문 블록 전부 정상 렌더 (full 모드와 동일 경로)
  섹션이 닫혀 있으면 → 스켈레톤:
    · text 계열 블록  → extractKeySentences 결과를 줄 단위 렌더 (없으면 통째 숨김)
    · case/subcase   → 제목행(rail·dot 포함)만 + 블록 내부 key 발췌 (§6.4)
    · 그 외(이미지·선택지·상자 등) → 숨김
```

- 전문 섹션(heading 없음): 스켈레톤 항목(key·케이스행)이 있으면 그것만 표시, 없으면 통째 숨김. 개별 펼침 손잡이가 없는 문제는 §4.3에서 처리.
- 스켈레톤의 key 발췌는 **섹션당 하나의 합성 텍스트로 묶어**(줄바꿈 2개 연결) 기존 `<EditorPreview borderless>` 경로로 렌더 — 신규 렌더러 0. 발췌 줄 간 여백은 리스트 항목 수준으로 조이는 전용 클래스 1개(`.outline-keys`)만 추가.
- **톤 상호작용**: 접힘 화면은 사실상 key만 보이는 화면이므로 has-key dim이 의미가 없다. `.outline-keys`에는 `solution-tone.has-key` dim을 적용하지 않고 key 본연의 톤(primary)으로 렌더 — CSS 한 줄(`무효화 규칙`)로 처리, v2에서 Phase 58 최종 CSS와 정합 확인.

### 3.2 "핵심문장만"의 정확한 의미 (D2 확정 서술)

접힘 화면에 남는 것은 **① 제목 블록 ② `**…**` 발췌 구간 ③ 케이스·하위케이스 제목행** — 이 셋뿐이다. key 마커가 문장 중간 일부만 감싼 경우 발췌도 그 일부만 보인다. 이는 버그가 아니라 **마커 사용 지침의 문제**로 정리한다(가이드: "핵심문장 마커는 문장 전체 단위로"). Phase 58 가이드 문구에 한 줄 추가(§9 Stage 6).

### 3.3 인쇄·저장 불간섭

outline은 순수 뷰 상태다. 인쇄(별도 렌더러)·저장 데이터·공유 스냅샷 어디에도 기록되지 않는다. 공유뷰에서 접은 채 인쇄를 호출하는 경로가 있는지 v2 확인(있다면 인쇄 전 full 강제).

---

## 4. P3 — 단락(섹션)·케이스 개별 토글

### 4.1 인터랙션 (구상 1-4, 2-3-7)

- outline 모드에서 **제목행 hover**: 배경 살짝(기존 hover 토큰 재사용) + chevron 방향 표시. **클릭**: 해당 섹션 open/close 토글(`openSections`).
- 케이스 제목행도 동일: 클릭 시 해당 케이스 블록의 본문(제목행 아래 내용)만 open/close(`openCases`). 하위케이스도 독립 토글.
- full 모드에서는 어느 행도 클릭에 반응하지 않는다(D13).

### 4.2 모바일·접근성

- 구상의 동기가 "웹·모바일 읽기의 장점"이므로 **hover 없는 환경을 1급으로**: chevron은 hover 시에만이 아니라 **outline 모드에서 상시 표시**. 탭 = 클릭.
- 제목행은 `role="button"` + `aria-expanded` + 키보드(Enter/Space) 지원. 클릭 타깃 최소 높이 확보(모바일 터치 기준 — 제목행 자체가 커버).

### 4.3 전문(前文) 섹션의 손잡이

heading이 없는 전문 섹션은 클릭할 제목행이 없다. **확정(Q4)**: 스켈레톤 항목이 있으면 그 위에 **얇은 펼침 행**(`… 앞부분 펼치기`)을 하나 둔다. 스켈레톤 항목조차 없으면 통째 숨김이므로 손잡이도 없음 — 전체 펼치기로만 복귀. (v2가 실측에서 과설계로 판단하면 "전문 섹션은 항상 펼침"으로 단순화 재제안 가능 — 단 기본은 확정안.)

---

## 5. P4 — '경우' 블록 (case / subcase)

### 5.1 타입·상수 (Phase 57 §3.1 패턴 그대로)

```
types/problem.ts        → union에 'case' | 'subcase' 추가
EditorView.tsx          → BLOCK_TYPE_LABELS: case '경우', subcase '하위 경우'
                        → BLOCK_TYPES 노출 순서: … 'callout' 다음에 'case','subcase' 제안
                        → BLOCK_PRESETS: 둘 다 '' (callout과 동일 — 빈 프리셋)
                        → TEXT_BASED_TYPES · SPLITTABLE_TYPES에 둘 다 추가
```

- **D7 근거** — depth 필드안(2안)은 Block 스키마 변경·직렬화 경로 전수 확인이 필요하다. 타입 2종안(1안)은 Phase 57에서 두 번 검증된 additive 패턴 그대로: **Firestore 규칙 0 · 마이그레이션 0 · pushUndo 자동 커버**(Phase 57 A-14). 렌더 5곳 분기 1개(case 계열)로 묶어 처리.
- SPLITTABLE인 이유: 케이스 안 내용이 길어지면 ⌘B 분할로 "케이스 밖 일반 블록"과 오가는 편집이 필요하다(callout과 동일 논리).

### 5.2 raw_text 규약 (D9)

```
첫 줄        → 제목행(조건). 예: $a>1$인 경우
둘째 줄부터   → 케이스 내용 (마크다운·수식·key 마커 전부 기존 문법)
```

- 첫 줄이 빈 블록: 제목행 자리에 placeholder 렌더(편집 미리보기) / 열람 뷰에서는 번호만(`C-1.`).
- 번호는 raw_text에 **넣지 않는다** — 자동 생성(§5.3). 기존 문항에서 손으로 쓴 "경우 1)" 류는 그대로 text 블록 — 영향 0, 원하면 수동 전환.

### 5.3 자동 번호 (D9·D10)

```ts
// lib/caseNumbering.ts (신규 — 렌더 5곳 중 case를 그리는 곳에서 공유)
// blocks 순회: heading → n 리셋(D10) / case → n++, sub=0, 라벨 `C-${n}`
//              subcase → sub++, 라벨 `C-${n}-${String.fromCharCode(96+sub)}`  // a, b, c…
export function buildCaseLabels(blocks: Block[]): Map<string, string>;
```

- 섹션 안에서 케이스 사이에 일반 블록(설명 문단)이 끼어도 번호는 이어진다(D10) — "케이스 사이 부연"이 번호를 깨지 않는다.
- **엣지**: 선행 case 없는 subcase(문서 첫 블록이 subcase 등)는 n=1로 승격 계산해 `C-1-a`로 렌더하고, 편집 미리보기에서만 흐린 경고(제목행 옆 ⚠ 툴팁: "상위 '경우' 블록이 없습니다"). 데이터는 건드리지 않는다.
- 두 자릿수(C-10 이상)·하위 27개 이상(z 초과)은 실사용 없다고 보고 자연 확장(aa)만 코드로 허용, 검증 제외.

### 5.4 렌더 (5곳)

Phase 57 A-2의 분기 순서(`image → svg → ggb → BORDERED → choices → 기본`)에서 BORDERED와 같은 층위에 **case 계열 분기** 추가. 출력 구조(클래스로 통일 — 인라인 style 사이트에서도):

```html
<div class="case-block">            <!-- subcase는 + " case-sub" -->
  <div class="case-title">          <!-- dot + 라벨 + 첫 줄 렌더 -->
    <span class="case-label">C-2.</span> …제목행 마크다운 렌더…
  </div>
  <div class="case-body">…둘째 줄 이후 렌더…</div>
</div>
```

- 열람 2뷰(ProblemView·공유뷰)에서는 outline 모드일 때 `case-body`가 openCases에 따라 접힌다. EditorView 미리보기·FolderView·인쇄는 **항상 전체 렌더**(토글 없음, 시각 표현만 동일).
- 인쇄(PrintableContent + PrintStyles): rail·dot·들여쓰기 동일 적용, 전부 `currentColor` — 흑백 인쇄 자연 대응. `break-inside: avoid`는 **걸지 않는다**(케이스는 길 수 있다 — callout과 반대 판단). 대신 `.case-title { break-after: avoid }`로 제목행 고아만 방지.

---

## 6. P5 — 시각 디자인 (rail · dot) — 스케치 재현

### 6.1 원리

스케치의 문법: **세로 선분(rail)이 형제 케이스들을 관통**하고, 각 케이스 제목행 위치에 **점(dot)** 이 찍힌다. 하위케이스는 한 단 들여쓴 위치에 **자기들끼리의 inner rail**을 갖는다. 구현은 블록 단위 CSS로 하되, 인접 case 블록 사이 마진을 rail이 관통하도록 브리징한다 — 별도 그룹 래퍼 없이 5곳 렌더 구조를 유지하는 것이 목적.

### 6.2 CSS 목업 (값은 전부 v2 실측 튜닝 대상)

```css
/* 화면 (globals.css) */
.case-block {
  position: relative;
  margin: 1.5em 0;                  /* K1 통일 기준 (Phase 57) */
  padding-left: 3em;                /* callout-block과 동일 값·동일 em 기준 */
}
.case-block::before {               /* rail */
  content: '';
  position: absolute;
  left: 1em; top: 0.7em; bottom: 0; /* top: 첫 dot 중심부터 */
  width: 2px;
  background: currentColor; opacity: 0.35;   /* 후보 — 명암 실측 */
}
/* 같은 깊이끼리만 브리징: K1 마진 관통 */
.case-block:not(.case-sub) + .case-block:not(.case-sub)::before { top: -1.5em; }
/* 마지막 케이스의 rail 종점(스케치: 마지막 dot에서 끝)은 실측 확정 — :not(:has(+ .case-block)) 후보 */
.case-title { position: relative; font-weight: var(--weight-semibold); }
.case-title::before {               /* dot */
  content: '';
  position: absolute;
  left: -2em;                        /* rail x좌표에 정렬 */
  top: 0.7em; transform: translateY(-50%);
  width: 0.5em; height: 0.5em; border-radius: 50%;
  background: currentColor;
}
.case-label { margin-right: 0.4em; font-variant-numeric: tabular-nums; }
.case-block .katex-display { padding-left: 0; }      /* 이중 들여쓰기 방지 — callout 선례 */

/* 하위케이스 (D12) */
.case-block.case-sub { margin-left: 3em; }           /* 들여쓰기 1단 추가 */
.case-block.case-sub::before { width: 1.5px; opacity: 0.25; }   /* 가는·흐린 inner rail */
.case-block.case-sub .case-title::before { width: 0.4em; height: 0.4em; }  /* 작은 dot */
.case-block.case-sub + .case-block.case-sub::before { top: -1.5em; }       /* inner rail은 sub끼리만 브리징 */
/* 부모 rail 관통 — 스케치에서 주 rail은 하위케이스 구간을 지나 다음 형제(C-3)까지 이어진다.
   subcase 블록은 rail을 두 개 그린다: ::before(자기 inner rail) + ::after(부모 rail 통과 구간) */
.case-block.case-sub::after {
  content: '';
  position: absolute;
  left: -2em;                        /* margin-left 3em 밖의 부모 rail x(1em)에 해당 — 실측 정렬 */
  top: -1.5em; bottom: -1.5em;       /* 위아래 마진까지 관통 */
  width: 2px; background: currentColor; opacity: 0.35;
}
```

- **브리징 정밀 규칙**: `case + case-sub`(부모→첫 하위) 사이는 **부모 rail이 관통**(subcase의 `::after`가 담당)하고 inner rail(`::before`)은 첫 subcase의 dot에서 시작한다. `case-sub + case`(하위 끝→다음 형제) 사이는 inner rail이 끊기고 부모 rail만 잇는다. 마지막 형제가 subcase로 끝나는 경우 `::after`의 `bottom: -1.5em`이 rail을 아래로 초과 연장하는 문제가 있다(다음 형제 존재 여부로 분기 필요 — `:has(+ .case-block)` 후보). 이 경계 케이스들이 CSS 결합자만으로 스케치와 동일하게 나오는지가 **v2 최대 검증 포인트** — 안 되면 폴백: 렌더 사이트에서 연속 case run을 `<div class="case-group">`로 감싸고 rail을 그룹에 그린다(5곳 공통 헬퍼로 — 구조 변경은 커지지만 rail 문제는 소멸한다). 폴백 채택 시 자동 번호 계산(§5.3)과 그룹핑을 한 헬퍼로 통합하면 이중 순회도 없앨 수 있다.
- 마지막 케이스의 rail 종점(스케치: C-3 dot에서 끝)은 "내용이 없는 마지막 케이스" 케이스까지 포함해 실측으로 확정.
- 인쇄(PrintStyles.css): 동일 구조, `padding-left: 2em`(fleqn 기준 — callout 선례), rail 1px·dot 치수 pt 재보정, `.print-body` 접두 필수(A-13).

### 6.3 강조문(callout)과의 구별

callout(핵심문장 강조, 들여쓰기만)과 case(rail+dot+라벨)는 왼쪽 여백 기준값을 공유하되 장식이 다르다 — 나란히 나와도 들여쓰기 리듬이 유지되면서 역할 구별이 시각적으로 성립하는지 Stage 2에서 실전 문항으로 확인.

### 6.4 outline 모드에서의 케이스 (구상 2-3-6·7)

- 접힌 케이스: `case-title`(rail·dot 유지) + 케이스 내용 중 key 발췌(`.outline-keys`, 제목행 아래 들여쓰기 유지)만.
- rail은 접힘 상태에서도 형제 케이스 dot들을 잇는다 — 제목행만 남아도 구조 선분은 보이는 것이 "at a glance"의 핵심.
- 펼친 케이스는 full 모드와 동일 렌더.

---

## 7. 엣지 케이스

- **제목·key·케이스가 전무한 풀이**: D14 가드로 접기 진입 자체를 차단(빈 화면 방지).
- **key 마커가 케이스 제목행(첫 줄)에 있는 경우**: 제목행은 항상 표시되므로 발췌 중복 표시하지 않는다 — extractKeySentences는 case 계열 블록의 **둘째 줄 이후만** 대상으로.
- **outline 중 데이터 변경 없음**: 열람 전용 2뷰라 편집과의 상태 충돌 없음. (EditorView 제외 결정의 부수 이득.)
- **openSections의 키 안정성**: 섹션 id를 순번이 아닌 블록 id로 — 재로드·리렌더에 안정.
- **케이스 안 display 수식·리스트·원문자**: 기존 규칙이 `case-body` 안에서도 그대로 — K1 여백·이중 들여쓰기 방지 override만 확인(§6.2).
- **케이스 안 `\tag{n}`**: float:right 기준선이 `padding-left`가 있는 컨테이너 우단 — callout과 동일 상황이므로 Phase 57 §4 선례 재사용, x좌표 일치 실측만.
- **Undo/Redo**: additive 타입 — pushUndo 기존 배선 자동 커버(A-14). outline 상태는 undo 대상 아님(뷰 상태).
- **공유뷰 스냅샷**: 새 타입이 스냅샷 renderer(SnapshotView — A-2 "타입 분기 없음")를 지나는 경로가 있는지 v2 확인 — 있다면 기본 낙하 렌더로 최소 무해 확인.
- **다크모드/톤**: rail·dot 전부 currentColor 파생 — Phase 58 톤 시스템과 자동 동행. has-key dim 상태에서 rail이 과하게 흐려지면 opacity 재보정(v2 육안).

---

## 8. 파일/모듈 (예정 — 좌표는 전부 v2 T0 실측)

```
# P3·P5 '경우' 블록 (열람·편집·인쇄 공통)
types/problem.ts                       → 'case' | 'subcase'
components/editor/EditorView.tsx       → 상수 5곳 + 렌더 분기
components/problem/ProblemView.tsx     → 렌더 분기 + P1·P2 접기 전체
components/problem/FolderView.tsx      → 렌더 분기 (접기 없음)
components/share/ProblemTabContent.tsx → 렌더 분기 + 접기 (ProblemView와 공유 컴포넌트로)
components/print/PrintableContent.tsx  → 렌더 분기 (접기 없음)
lib/caseNumbering.ts                   → 신규 (자동 번호)
app/globals.css / PrintStyles.css      → .case-block 일식

# P1·P2 접기/펼치기
lib/solutionOutline.ts                 → 신규 (buildSections · extractKeySentences)
lib/keyTone.ts                         → KEY_STRONG_RE export 추가 (Phase 58 산출물 재사용)
components/problem/…                   → 토글 버튼 · outline 렌더 (ProblemView/공유뷰 공유 컴포넌트 신설 검토)
app/globals.css                        → .outline-keys · hover · chevron · 톤 무효화 1줄
```

**Firestore 규칙 0 · 서버 0 · 마이그레이션 0** — 순수 클라이언트. P3~P5(경우 블록)와 P1~P2(접기)는 상호 독립 배포 가능하나, outline 스켈레톤이 케이스 제목행을 포함하므로 **경우 블록 먼저**가 자연 순서.

---

## 9. 구현 순서 (Stage)

**Stage 0 · T0 (CLI)** — 좌표·전제 실측: Phase 58 배포 상태(key 마커·톤 CSS 최종형) / 5곳 렌더 분기 현행 / ProblemView '풀이' 라벨 구조 / 공유뷰 콘텐츠 컨테이너·`.problem-content-toned` 여부(Phase 58 D14 반영 결과) / SnapshotView 경로 / hover 토큰·아이콘 세트. 이 문서의 목업 값·셀렉터 전면 재검증.

**Stage 1 · P3 '경우' 블록** — 타입·상수·5곳 분기·자동 번호.
검증: 케이스 3개 + 하위 2개 문항에서 C-1~C-3·C-2-a·C-2-b 자동 부여 / 케이스 삽입·삭제·순서 변경 시 번호 재계산 / 선행 없는 subcase 경고 / 저장→재로드 / undo 왕복 / ⌘B 분할.

**Stage 2 · P5 시각** — rail·dot·들여쓰기 화면+인쇄.
검증: 스케치와 나란히 육안 대조(브리징 2경계 포함) / 마지막 케이스 rail 종점 / callout과 나란히 리듬 / 케이스 안 수식·리스트·`\tag` / 인쇄 흑백 / 다크·has-key 톤에서 rail 명암.

**Stage 3 · P1 전체 접기/펼치기 (ProblemView)** — 섹션 모델 + 토글 버튼 + 스켈레톤.
검증: 접기 → 제목·key 발췌·케이스행만 / 펼치기 → 현행과 픽셀 동일 / D14 가드 / 전문 섹션 / key 없는 섹션 통째 숨김 / outline에서 key가 primary 톤.

**Stage 4 · P2 개별 토글** — 섹션·케이스 hover·클릭, 접근성.
검증: 섹션 토글 / 케이스·하위케이스 독립 토글 / full 모드 무반응(D13) / 모바일 탭·chevron 상시 표시 / 키보드·aria-expanded.

**Stage 5 · 공유뷰** — 공유 컴포넌트 적용.
검증: 앱 열람뷰 ↔ 공유뷰 동작 동일 / 스냅샷·인쇄 불간섭 / 구형 공유 문서(케이스 없음) 무변화.

**Stage 6 · 통합** — 접기 × 케이스 × Phase 57·58 기능 공존 실전 문항 검증. roadmap.md 갱신 + Phase 58 가이드에 "key 마커는 문장 전체 단위"(§3.2) 한 줄 추가 + CLAUDE.md 블록 타입 표 갱신.

---

## 10. 확인 사항 — **전건 확정 (2026-08-17 덕수)**

| # | 질문 | **확정** |
|---|---|---|
| Q1 | 블록 한글 이름 | **'경우' / '하위 경우'** (타입 키 `case`/`subcase`) |
| Q2 | 화면 번호 표기 | **`C-1.`** (자동 번호, §5.3) |
| Q3 | full(전체 펼침) 모드에서 케이스 제목행 클릭 토글 | **불허** — outline 모드 전용 (D13) |
| Q4 | 전문(前文) 섹션의 개별 펼침 손잡이 | **둔다** — "… 앞부분 펼치기" 행 (§4.3) |

**미결 항목 없음.** 본 문서를 기준으로 CLI가 v2(실코드 대조·좌표 확정)를 작성한다.

---

## 부록. 로드맵 메모

- 의존: **Phase 58 배포 → Stage 0**, **Stage 1(케이스) → Stage 3(접기)**. P3~P5와 P1~P2는 그 외 상호 독립.
- 후속 후보: EditorView 미리보기 접기 / FolderView 적용 / 접힘 상태 URL 공유 / 펼침 애니메이션(max-height 트랜지션) / callout B안(`>> ` 행 마커, Phase 57 D2′)과 케이스 제목행 문법의 통합 검토.
- Phase 번호 **59** (phasedocs 55·55a·55b·55c·56·57·58 다음).
