# Phase 55 — 문항 버전 관리 시스템 (자체 VCS) · v4 (확정)

> Claude Code CLI 세션용 구현 핸드오프 문서 (v4 — phasedocs 등록 확정판).
> v2(계획) → v3(웹 Claude가 라이브 레포 `b229714` 전수 대조 교정) → **v4(CLI 재검증 3건 반영)**.
> v3 대비 v4 변경: ⓐ **F7 완화책을 올바른 계층으로 이동**(`getProblemWithBlocks`가 실패-탭을 밖으로 노출 — 계약 변경 명시),
> ⓑ **`step_label` 버전 모델에서 제외**(현행 `handleSave`가 저장하지 않는 legacy 필드 — 검증 완료),
> ⓒ **블록 분할/복제 시 `block_key` 재발급 규칙 추가**(같은 키 중복 방지).
> v3의 핵심 진단(F1~F8)은 CLI 재검증에서 전부 실제 코드와 일치 확인됨.
> v4.1(덕수 결정): **D1 재확정 — 문항 제목·정답을 버전 콘텐츠에 포함**(난이도·태그 등 카탈로그성 메타는 계속 제외).
> GitHub 연동은 **Phase 56+** 별도.

---

## 0. 착수 전 확인

- 본 문서의 file:line 인용은 **commit `b229714`** 기준. CLI는 착수 시 최신 클론에서 라인 재확인.
- `docs/roadmap.md`는 Phase 53에서 끝나 있고 **Phase 54(sub-case 렌더링, 코드 반영 완료) 항목이 누락**되어 있다. 착수 시 로드맵에 Phase 54 항목을 먼저 채운 뒤 본 Phase를 55로 기재한다.
- 열린 결정 D2~D5는 v2 기본안 확정. **D1은 덕수 재검토로 "제목·정답 포함"으로 변경**(§1 메타 행) — 나머지 메타(난이도·태그·출처·과목·분류·폴더)는 제외 유지.

---

## 1. 확정된 핵심 결정 (구현 시 반드시 준수)

| # | 결정 | 내용 |
|---|------|------|
| 저장 방식 | **스냅샷 + 해시 dedup** | 델타 아님. 무변경 중복은 콘텐츠 해시로 차단 |
| 단위 | **문항 전체** | 모든 탭을 한 버전으로. 복원 시 탭 간 일관성 |
| 직렬화 | **블록 구조 전부 보존** | `block_key`+`order`+`type`+`raw_text`+`title`+이미지/SVG/GGB 상태 전부 (step_label은 제외 — §2-F9) |
| 메타 (D1) | **탭 구성 + 문항 제목·정답 포함** | 제목·정답은 내용성 편집이라 버전 콘텐츠(`VersionContent.meta`)에 포함·해시. 탭 구성(id·label)도 포함. **난이도·태그·출처·과목·분류·폴더는 제외**(카탈로그성 — 이력 노이즈 방지) |
| 문서 분리 | **메타/본문 분리** | 목록은 메타만, 본문은 비교·복원 때만 지연 로딩 |
| diff | **`block_key` 매칭 + 수정 블록 내부 텍스트 diff** | 이동/추가/삭제/수정 구분. ⚠️ doc id 아님 — doc id는 저장마다 재발급됨(§2-F1) |
| 자동 스냅샷 | **시간 타이머 없음** | 명시 트리거 + 제어된 이탈만 |
| 계층1 저장 타깃 (D2) | **localStorage 즉시 + Firestore는 명시 저장/제어된 이탈 때만** | delete-all→re-add 구조라 상시 debounce는 비용·위험 과대 |
| payload 크기 (D3) | **모니터만** | SVG/이미지는 Storage URL만 raw_text에 저장됨(`lib/storage.ts:119`) — 1MB 도달 사실상 불가 |
| pruning (D4) | **문항당 하드 상한 50만** | prune 후보가 `editor_exit`뿐이라 보존곡선 불요 |
| `editor_exit` 신뢰 (D5) | **제어된 이탈에서만 await** | 순수 언마운트/`beforeunload`는 계층1에 위임 |
| 복원 | **비파괴 + `problem.tabs` 동기화** | 복원 직전 보존 + 복원 결과 새 스냅샷 + 탭 메타·고아 블록 정리(§6.4) |
| 패널 | **EditorView 우측 드로어** | in-memory 작업본 동일 소스 참조 |
| 해시 기준 | **저장될 형태(persisted form)** | in-memory가 아니라 `toPersistedBlock()` 통과 후 해시(§2-F3) |

**불변 원칙 (raw is truth):** 스냅샷에 굳히는 값은 절대 변형하지 않는다. canonicalize는 키·배열 순서만 결정적으로 만든다. 단, 해시·스냅샷의 입력은 "저장될 형태"다 — 저장 경로가 이미 수행하는 정형화(`normalizeDisplayMathSpacing`+trim)를 스냅샷도 동일하게 거친다.

---

## 2. 레포 검증으로 확정된 사실관계

> F1~F8은 v3에서 웹 Claude가 진단, CLI가 `b229714`에서 재검증 완료(전부 일치). F9는 v4 신규.

**F1. 블록 doc id는 저장마다 재발급된다.** `handleSave`는 탭 전체를 delete-all → re-add(`EditorView.tsx:2152~2199`), `saveBlock`은 `addDoc` 자동 id(`lib/firestore.ts:329`), **`updateBlock` 호출처는 레포 전체 0곳**(재검증 완료). → doc id를 diff·복원 키로 쓸 수 없다. 본 Phase는 `block_key` 필드를 신설한다(§4.1).

**F2. 기존 와일드카드 규칙이 versions 메타를 선점한다.** `firestore.rules`의 `match /{subcollection}/{docId}`(problems 하위, `firestore.rules:94`)가 `versions/{vid}`(2세그먼트)에 매치된다. read 조건(`129~135`)은 `isBlocksSubcol()=false`라 탭 게이트 없이 `parentIsPublic()`(auth 검사 없음)만으로 허용 → **공개 문항의 버전 메타가 비로그인 익명에게 노출**. write(`135`)도 `parentOwner()` 전면 허용 → `hasOnly(['name','pinned'])` 불변성은 OR 병합에 묻혀 강제 불가. → 와일드카드에 명시 제외 필요(§5).

**F3. 현행 규칙에서 payload 쓰기는 default deny다.** `payload/data`는 4세그먼트라 어떤 매치에도 걸리지 않는다(재귀 와일드카드 없음). → `createSnapshot` 트랜잭션이 payload 쓰기에서 거부돼 **전체가 원자적으로 실패**한다. **규칙 배포가 스냅샷 코드보다 선행해야 한다** → Stage 1(§8).

**F4. 저장 시 raw_text가 변형된다.** `handleSave`가 `normalizeDisplayMathSpacing()`+앞뒤 빈줄 trim(`EditorView.tsx:2169~2173`), `title: b.title || ''` 강제, image/svg/ggb 필드 조건부 기록(`2176~2198`)을 수행 → in-memory ≠ 저장본. 재현: 세션1에서 뒤 빈줄 포함 입력 후 이탈(스냅샷=untrimmed 해시 H1) → 세션2에서 열고 그냥 이탈(로드본=trimmed 해시 H2≠H1) → **무편집 유령 버전**. `imageGray`도 토글이 `true`를 명시 세팅(`1559`)하는데 저장은 `===false`만 기록(`2184`) → 동치인데 해시 상이. → `toPersistedBlock()` 공유 + canonBlock 동치 정규화(§4.2).

**F5. authorUid 백필은 불요.** `app/admin/migrate`에 백필 존재·실행 완료, 현행 규칙이 authorUid 없는 문항 read를 차단 → **EditorView에서 열 수 있는 문항엔 authorUid가 반드시 있다.** `createSnapshot` 진입 가드 한 줄만 둔다.

**F6. 탭 구성은 payload에 담기지만 복원 절차가 미비했다.** `VersionTab.key/title`로 데이터는 캡처·해시된다. 갭은 복원 시 `problem.tabs`(TabMeta[]) 동기화와 사라진 탭의 `_blocks` 정리 누락 → §6.4에 명시.

**F7. 부분 로드 위험 — 완화책은 로드 계층에 있어야 한다.** `getProblemWithBlocks`의 탭별 catch는 permission-denied만이 아니라 **모든 에러**를 빈 배열로 삼킨다(`lib/firestore.ts:206~213`, 재검증 완료). 그 결과 **adapter 시점엔 "정상적으로 빈 탭"과 "로드 실패 탭"을 구분할 수 없다.** 따라서 완화책을 `collectCurrentContent`에 둘 수 없고, **`getProblemWithBlocks`가 실패-탭을 밖으로 노출하도록 계약을 바꿔야 한다**(§4.3). 오너가 연 문항엔 permission-denied가 날 일이 없으므로(오너는 전 탭 열람), **로드 에러가 하나라도 있으면 진짜 실패**로 간주해 스냅샷을 막는다.

**F8. 기타 확정.** `computeContentHash`(`lib/copyright.ts:15`)는 필드셋이 달라(**order·type·raw_text·title·imageWidth만, svg/ggb/step_label 미포함** — 재검증 완료) 본 Phase 해시와 별개 — **통합 금지**, 원본인증은 계속 기존 함수 사용. `nanoid ^5.1.11` 설치됨, `diff` 미설치(`npm i diff` 필요), `hooks/` 기존재(`useAuth.ts` 등). 탭 순서 변경 UI는 현재 없음(추가 `2068`·삭제 `2092`·이름변경 `2116`) → canonicalize의 key 정렬은 현재 무해. *(각주: 장차 탭 reorder 도입 시 순서 변경이 스냅샷을 만들지 않음 — 그때 재검토.)*

**F11. versions read/LIST 규칙도 문항 authorUid로 검사해야 한다 (Stage 4 런타임 발견).** 드로어 타임라인은 `versions` 컬렉션 LIST 쿼리(`orderBy('seq','desc')`)다. read 규칙이 `resource.data.author_uid == uid`면, **Firestore 규칙은 필터가 아니라** where 절 없는 LIST를 "권한 없는 문서를 반환할 수 있는 쿼리"로 보고 **거부**한다(오너인데도). → versions read/update/delete/payload 소유 검사를 모두 부모 **문항** authorUid(`verOwner()`)로 통일. author_uid 필드는 create 정합 검사용으로만 유지. `test:rules` #58~60(LIST) 추가. *(F10과 같은 계열 — 단건 read 테스트가 LIST·트랜잭션 경로를 못 잡는다. get() 없이 비정규화하려던 최적화는 포기.)*

**F10. payload 규칙은 버전 doc이 아니라 문항 authorUid로 검사해야 한다 (Stage 2 런타임 발견).** `createSnapshot`은 `versions/{id}`와 `versions/{id}/payload/data`를 **한 트랜잭션에서 동시 생성**하는데, payload create 규칙이 부모 `versions/{id}`를 `get()`하면 규칙 엔진이 **같은 트랜잭션의 미커밋 버전 doc을 보지 못해** create가 거부되고 스냅샷 전체가 롤백된다(프로덕션에서 versions 미생성으로 발현). → payload 규칙의 소유 검사를 부모 **문항** authorUid로 변경(§5-(2)). 에뮬레이터 재현 테스트 `test:rules` #56 추가. *(교훈: read/update만 시드 검사하면 트랜잭션 create 경로를 놓친다.)*

**F9. `step_label`은 현행 저장 경로에서 유지되지 않는다 (v4 신규).** `handleSave`의 saveData에 `step_label`이 **없다**(재검증: `EditorView.tsx` saveData 0건). `step_label`은 `duplicateProblem`의 복사(`lib/firestore.ts:519`)와 일부 legacy seed 경로(`app/problems/new`, `app/problems/[id]/edit`)에만 잔존하고, 현행 에디터는 유지하지 않는다. → **persisted form 기준으로 이미 드롭되는 필드**이므로 버전 모델(`VersionBlock`·canonBlock·직렬화)에서도 **제외**한다. 정말 보존하려면 `handleSave`부터 `step_label` 저장을 추가해야 하며(스코프 확대) 별도 과제로 남긴다.

---

## 3. 데이터 모델

### 3.1 경로

```
problems/{problemId}                                      # 라이브 (기존)
problems/{problemId}/versions/{versionId}                 # 버전 메타 (목록용)
problems/{problemId}/versions/{versionId}/payload/data    # 버전 본문 (비교·복원용)
```

### 3.2 라이브 문항 추가 필드 (`problems/{id}`)

```ts
// 소유자는 기존 authorUid 재사용 — 신규 필드·백필 없음 (F5)
version_seq: number;
last_version_id: string | null;
last_version_hash: string | null;
last_version_tab_hashes: Record<string, string>;
last_editor_uid?: string;                        // 협업 대비
```

마이그레이션(최초 1회): `version_seq=0`·`last_version_*=null` 백필만. (authorUid 백필 없음 — F5)

### 3.3 라이브 `Block`에 추가 필드

```ts
// types/problem.ts Block에 추가
block_key?: string;   // nanoid. 블록의 영속 정체성 — diff 매칭·복원 재조정 키.
                      // doc id와 무관하게 delete-all→re-add를 살아남는다 (F1).
```

- **발급 시점**: 블록 생성 시 `nanoid()` 즉시 부여. 레거시 블록은 **로드 시 없으면 즉석 발급(lazy backfill, `toLocal` `EditorView.tsx:1079`)** — 다음 저장 때 함께 커밋됨.
- **⚠️ 분할/복제 시 새 키 발급 (v4)**: `handleSplitBlock`(`EditorView.tsx:1563`)·`handleSplitMathLines`(`1397`) 등 **블록을 새로 만드는 모든 경로는 새 블록에 새 `nanoid()`를 발급**해야 한다. 원본 키를 복사하면 한 탭에 같은 키 2개가 생겨 diff 매칭·복원 재조정이 깨진다. (원본은 키 유지, 파생 블록만 신규.)
- **저장 경로**: `handleSave`의 saveData에 `block_key` 포함(1줄). delete-all→re-add 구조는 **건드리지 않는다** — 키가 필드로 살아남으므로 v2의 "deleteAllTabBlocks 금지" 조항은 폐기.

### 3.4 버전 인터페이스

```ts
import type { SvgInitialView, GgbInitialCoords } from '@/types/problem';

// 메타 — content_hash·seq·created_*·trigger·parent_id·restored_from 불변. name·pinned만 사후 수정.
interface ProblemVersion {
  id: string;
  seq: number;
  problem_id: string;
  author_uid: string;          // 부모 authorUid 비정규화 → 규칙에서 get() 없이 검사
  created_at: Timestamp;
  created_by: Participant;
  contributors: Participant[]; // 지금은 [created_by]
  trigger: VersionTrigger;
  name: string | null;
  pinned: boolean;
  content_hash: string;        // ⚠️ 저작권 contentHash(computeContentHash)와 별개 (F8)
  tab_hashes: Record<string, string>;
  parent_id: string | null;
  restored_from: string | null;
  changed_tabs: string[];
  byte_size: number;           // canonical JSON 길이 — Firestore 실문서 크기와 다름(모니터 지표)
}

interface Participant { uid: string; display_name: string; }

type VersionTrigger = 'manual_save' | 'editor_exit' | 'named' | 'restore';

interface VersionPayload { content: VersionContent; content_hash: string; }

interface VersionContent {
  meta: VersionMeta;           // 문항 제목·정답 (D1) — content_hash에만 포함(탭별 해시 제외)
  tabs: VersionTab[];          // 탭 구성(key·title) 포함 — 구조적 콘텐츠 (F6)
}

interface VersionMeta {
  title: string;               // problem.title (저장 형태 = 트림 없음, handleSave와 동일)
  answer: string;              // problem.answer ?? '' (동치 정규화)
  // 난이도·태그·출처·과목·분류·폴더 제외 (카탈로그성, D1)
}

interface VersionTab {
  key: string;                 // TabMeta.id ('question'|'solution'|'extra_N')
  title: string;               // TabMeta.label — 해시 포함(탭 이름 변경도 내용)
  last_editor_uid?: string;    // 해시 제외
  blocks: VersionBlock[];
}

interface VersionBlock {
  block_key: string;           // §3.3 — 매칭·재조정 키. 해시 제외
  order: number;
  type: BlockType;             // 11종 — types/problem.ts Block['type']과 일치 유지
  raw_text: string;            // "저장될 형태" (toPersistedBlock 통과본)
  title?: string;
  imageWidth?: number;
  imageTreatment?: 'frame';
  imageGray?: boolean;
  svg_initial_view?: SvgInitialView | null;
  svg_height?: number;
  ggb_initial_coords?: GgbInitialCoords | null;
  ggb_height?: number;
  // step_label 제외 — 현행 저장 경로가 유지하지 않음 (F9)
}

type BlockType =
  | 'text' | 'heading' | 'math_block' | 'bullet'
  | 'gana' | 'roman' | 'box' | 'choices' | 'image' | 'svg' | 'ggb';

type SnapshotResult =
  | { status: 'created'; version: ProblemVersion }
  | { status: 'unchanged' }
  | { status: 'named_existing'; versionId: string }
  | { status: 'error'; error: unknown };
```

---

## 4. 정형화·정규화·해시 (F1·F4 해소 계층)

### 4.1 `toPersistedBlock` — 저장 경로와 스냅샷의 단일 정형화 (신규 `lib/blocks/normalize.ts`)

`handleSave`의 인라인 정형화(`EditorView.tsx:2169~2198`)를 **함수로 추출**하고, `handleSave`와 `collectCurrentContent()` 양쪽이 이것만 쓴다. 이후 저장 정형화 규칙이 바뀌어도 해시가 자동 동행한다.

```ts
import { nanoid } from 'nanoid';
import { normalizeDisplayMathSpacing } from '@/lib/preprocess';

/** in-memory LocalBlock → 저장될 형태. handleSave 기존 로직과 결과가 정확히 일치해야 함. */
export function toPersistedBlock(b: LocalBlock, index: number): PersistedBlockData {
  const trimmed = normalizeDisplayMathSpacing(b.raw_text)
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '');
  const out: PersistedBlockData = {
    block_key: b.block_key || nanoid(),          // lazy backfill (F1)
    order: index,
    type: b.type,
    raw_text: trimmed,
    title: b.title || '',
  };
  if (b.type === 'image' && b.imageWidth) out.imageWidth = b.imageWidth;
  if (b.type === 'image' && b.imageTreatment) out.imageTreatment = b.imageTreatment;
  if (b.type === 'image' && b.imageGray === false) out.imageGray = false;
  if (b.type === 'svg' && b.svg_initial_view) out.svg_initial_view = b.svg_initial_view;
  if (b.type === 'svg' && b.svg_height) out.svg_height = b.svg_height;
  if (b.type === 'ggb' && b.ggb_initial_coords) out.ggb_initial_coords = b.ggb_initial_coords;
  if (b.type === 'ggb' && b.ggb_height) out.ggb_height = b.ggb_height;
  return out;
  // step_label은 현행 handleSave와 동일하게 포함하지 않는다 (F9).
}
```

리팩터링 검증: 기존 `handleSave`를 `toPersistedBlock` 호출로 치환한 뒤, 임의 문항 저장 전/후 Firestore 문서가 리팩터링 이전과 **필드 단위 동일**한지 확인.

### 4.2 canonicalize — 동치 정규화 포함 (신규 `lib/version/canonicalize.ts`)

```ts
// '내용' 필드만, 표현 차이를 동치로 정규화해 결정적으로 뽑는다.
// block_key·last_editor_uid·collapsed·timestamp는 제외 — 정체성/시간은 내용이 아님.
function canonBlock(b: VersionBlock) {
  const o: Record<string, unknown> = { order: b.order, type: b.type, raw_text: b.raw_text };
  if (b.title != null && b.title !== '') o.title = b.title;      // ''/부재 동치 (F4)
  if (b.imageWidth != null) o.imageWidth = b.imageWidth;
  if (b.imageTreatment != null) o.imageTreatment = b.imageTreatment;
  if (b.imageGray === false) o.imageGray = false;                // true/부재 동치 (F4)
  if (b.svg_initial_view != null) {
    const v = b.svg_initial_view;
    o.svg_initial_view = { scale: v.scale, positionX: v.positionX, positionY: v.positionY };
  }
  if (b.svg_height != null) o.svg_height = b.svg_height;
  if (b.ggb_initial_coords != null) {
    const c = b.ggb_initial_coords;
    o.ggb_initial_coords = { xMin: c.xMin, xMax: c.xMax, yMin: c.yMin, yMax: c.yMax };
  }
  if (b.ggb_height != null) o.ggb_height = b.ggb_height;
  return o;
  // step_label 제외 (F9)
}

// 제목·정답은 저장 경로가 트림하지 않으므로(persisted form) 여기서도 트림하지 않는다.
// answer의 ''/undefined만 동치 정규화.
function canonMeta(m: VersionMeta) {
  return { title: m.title || '', answer: m.answer || '' };
}

function canonicalize(content: VersionContent): string {
  const meta = canonMeta(content.meta);
  const tabs = [...content.tabs]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((t) => ({
      key: t.key,
      title: t.title,
      blocks: [...t.blocks].sort((a, b) => a.order - b.order).map(canonBlock),
    }));
  return JSON.stringify({ meta, tabs });
  // meta는 전체 해시(content_hash)에만 포함 — canonicalizeTab(탭별 해시)에는 없음.
  // → 제목·정답만 바뀌면 스냅샷은 생기되 changed_tabs는 빈 배열(§6.3 diff가 meta를 별도 표시).
}

function canonicalizeTab(t: VersionTab): string {
  const blocks = [...t.blocks].sort((a, b) => a.order - b.order).map(canonBlock);
  return JSON.stringify({ key: t.key, title: t.title, blocks });
}
```

`sha256`·`hashPerTab`·`diffTabKeys`는 v2와 동일 (`lib/version/hash.ts`). SHA-256은 Web Crypto.

### 4.3 로드 완료 가드 + `collectCurrentContent` (F7)

**(a) `getProblemWithBlocks` 계약 확장 (`lib/firestore.ts`, 하위호환).** 탭별 catch가 실패를 삼키므로, 어떤 탭이 에러였는지 **밖으로 노출**한다. 반환 타입에 선택 필드를 추가한다:

```ts
// ProblemWithBlocks에 추가 (선택 필드 → 기존 호출부 무영향)
tabLoadErrors?: Record<string, string>;   // tabId → error.code|message. 성공 탭은 미포함
```

catch 블록에서 `tabBlocks[tab.id] = []`에 더해 `tabLoadErrors[tab.id] = err?.code || err?.message`를 기록한다. **기존 호출부(copyright·preview·duplicate 등)는 이 필드를 읽지 않으므로 회귀 없음** — Stage 2에서 회귀 확인.

**(b) `collectCurrentContent` (신규 `lib/version/adapter.ts`).**
- EditorView in-memory(`allBlocks`·`tabs`)를 받아 **탭별로 `toPersistedBlock`을 통과시켜** `VersionContent.tabs` 구성. **`meta`는 `editTitle`·`editAnswer` 상태에서 수집**(handleSave가 `updateProblem`으로 problem 문서에 쓰는 것과 동일 소스 — `EditorView.tsx:2133·2139`, D1). 해시·스냅샷의 입력은 항상 저장될 형태(§1 해시 기준).
- **로드 완료 가드**: EditorView 로드 시 `tabLoadErrors`를 상태로 보관. 비어있지 않으면(오너 문항엔 permission-denied가 없으므로 = 진짜 실패) `collectCurrentContent`가 throw → 스냅샷·저장 전 사용자 안내("일부 탭 로드 실패 — 새로고침 후 시도"). 저장 버튼·`editor_exit` 스냅샷 모두 이 가드 뒤에서만 실행.
- `applyContent(next)`: 스냅샷 → in-memory 작업본 (복원 시, §6.4 규칙 준수).

---

## 5. Firestore 보안 규칙 — **추가분만** (F2·F3, Stage 1)

> ⚠️ **기존 `match /problems/{problemId}` 블록의 현행 내용(visibility·member·admin·tab_comments·탭 게이트)은 한 글자도 수정하지 않는다.** 공유·Bazaar가 운영 중이다. 아래 3개 변경만 수행한다.

**(1) 기존 와일드카드에 versions 제외 추가** — `match /{subcollection}/{docId}` 내부:

```
        function isVersionsCol() {
          return subcollection == 'versions';
        }
        // 기존 read 조건 앞에 && !isVersionsCol() 추가:
        allow read: if !isCommentsCol() && !isVersionsCol() && ( ...기존 그대로... );
        // 기존 write 조건에도 동일 추가:
        allow write: if !isCommentsCol() && !isVersionsCol() && parentOwner();
```

> ⚠️ 이 제외가 없으면, versions 전용 매치를 추가해도 **와일드카드 매치가 OR로 함께 적용**되어 F2 노출이 살아있다(Firestore는 형제 match를 OR 병합). 반드시 (1)과 (2)를 함께.

**(2) versions 전용 매치 신설** (problems 매치 내부, 와일드카드 아래):

```
      match /versions/{versionId} {
        // ⚠️ 소유 검사는 부모 "문항" authorUid로 한다(F10·F11). resource.data.author_uid를 쓰면
        //    where 절 없는 LIST 쿼리가 규칙상 거부되고(F11), payload 트랜잭션 create도 막힌다(F10).
        function verOwner() {
          return request.auth != null
            && get(/databases/$(database)/documents/problems/$(problemId)).data.authorUid == request.auth.uid;
        }
        allow read:   if verOwner();
        allow create: if verOwner()
                      && request.resource.data.author_uid == request.auth.uid;   // 데이터 정합
        allow update: if verOwner()
                      && request.resource.data.diff(resource.data).affectedKeys()
                           .hasOnly(['name', 'pinned']);
        allow delete: if verOwner();

        match /payload/{doc} {
          allow read, create, delete: if verOwner();
          allow update: if false;    // 본문 불변
        }
      }
```

**(3) `tests/firestore.rules.test.mjs` 케이스 추가** (`npm run test:rules`):
- 공개(public) 문항의 `versions/{vid}`를 제3자·익명이 **read 불가** (F2 회귀 방지)
- 오너의 versions create/read 가능, `name`·`pinned` 외 필드 update **거부**
- `payload/data` 오너 create/read 가능·update 거부, 제3자 전부 거부
- 기존 케이스 전부 녹색 유지(블록·댓글·공유 회귀 없음)

**배포 순서: 이 규칙이 라이브에 배포된 뒤에만 Stage 2(스냅샷) 검증 가능 (F3).**

---

## 6. 스냅샷 생성·읽기·diff·복원

### 6.1 `createSnapshot` (`lib/version/snapshot.ts`)

v2 §3.2 코드 그대로 유지하되 3곳 수정:

```ts
// (a) 진입 가드 (F5 — 백필 대신)
const live = (await tx.get(liveRef)).data()!;
if (!live.authorUid) return { status: 'error', error: new Error('authorUid 없음 — 관리자 마이그레이션 필요') };

// (b) content는 collectCurrentContent() 결과 = toPersistedBlock 통과본 (F4)
// (c) 조기 반환·dedup·named_existing·2-write(메타+payload)·라이브 포인터 갱신·
//     트랜잭션 성공 후 setCachedLastHash — v2와 동일
```

트리거 배선(v2 §3.3 동일): `manual_save`(저장 버튼 — **블록 커밋과 같은 흐름에서, 커밋 완료 후** 호출) / `named` / `editor_exit`(제어된 이탈만 await, D5) / `restore`. 시간 타이머·dirty 게이트 없음.

엣지(v2 §3.4 유지 + 추가): 정형화 공유(F4) 덕에 "열고 그냥 이탈" 유령 버전이 생기지 않는다 — Stage 2 검증 항목에 포함.

### 6.2 읽기 (`lib/version/read.ts`)

v2 §5.2 그대로: `versionsPage`(메타만, `orderBy('seq','desc')`, 30개 페이지네이션), `loadContent`(payload 지연 로딩), 클라이언트 필터. `resolveLivingParent`(pruned parent 폴백) 포함.

### 6.3 diff — `block_key` 매칭 (`lib/version/diff.ts`, `VersionDiff.tsx`)

v2 §5.3 구조 유지, 키만 교체:

1. **블록 매칭 (`block_key` 기준)**: 양쪽 존재·order 다름 → **이동** / after만 → **추가** / before만 → **삭제** / 양쪽 존재·`canonBlock` 다름 → **수정**.
2. 수정 블록 내부: `raw_text`를 jsdiff(`diffLines` → 변경 줄 내 `diffWords`).
3. `changed_tabs`로 바뀐 탭만 펼침. 통합 뷰 기본 + 좌우 토글. `tabToText`는 폴백/복사용 유지(블록 구분자는 `type`만 사용 — step_label 제외, F9).
4. **메타 diff (D1)**: `changed_tabs`와 별개로, 두 버전의 `content.meta`(제목·정답)를 항상 비교해 바뀌었으면 diff 상단에 표시. 제목·정답만 바뀐 스냅샷은 changed_tabs가 비어도 이 영역으로 드러난다.

레거시 주의: lazy backfill 이전에 만들어진 스냅샷은 존재하지 않으므로(버전 기능 자체가 신규) block_key 부재 케이스는 발생하지 않는다. 단, 방어적으로 **key 부재 블록은 '추가/삭제'로 폴백**.

### 6.4 복원 — 비파괴 + 탭 동기화 (F6) (`lib/version/restore.ts`)

v2 §5.4의 1)직전 보존 → 2)대상 로드·작업본 교체 → 3)`restore` 스냅샷 골격 유지. **2)의 규칙을 다음으로 교체·보강:**

- `applyContent`는 in-memory 교체만 한다(라이브 쓰기는 기존 저장 경로가 수행). 이때 **`block_key`를 스냅샷 값 그대로 유지** — 복원 후에도 키 연속성이 이어져 이후 diff가 정확하다. (v2의 "update/add/delete 재조정" 조항은 delete-all→re-add 유지 결정(§3.3)에 따라 폐기 — 키가 필드로 살아남으므로 불필요.)
- **`scope==='all'`이면 `tabs`(TabMeta[]) 상태도 스냅샷의 `VersionContent.tabs`(key→id, title→label)로 교체**한다. 대상 버전에 없는 라이브 탭은 tabs에서 빠지고, 기존 `handleSave`의 "삭제된 탭 블록 정리" 루프(`EditorView.tsx:2146~2150`)가 해당 `_blocks`를 자연 정리한다 — 별도 삭제 코드 불요.
- **메타 복원 (D1)**: `scope==='all'`일 때 스냅샷 `meta`로 `setEditTitle`·`setEditAnswer` 상태도 교체 → 이후 저장 경로(`updateProblem`)가 problem 문서에 되쓴다.
- `scope==={tabKey}`(탭 복원)는 그 탭 블록만 교체, `tabs`·`meta`는 불변.
- 복원 확인 모달(`RestoreConfirm.tsx`): 적용 전 "현재 ↔ 대상" diff 표시(메타 diff 포함). 동일 시 dedup이 막고 안내.

---

## 7. 계층1 자동저장 UX · 드로어 · 보존

**계층1 (v2 §4 확정, D2):** localStorage `mathory:draft:{problemId}` 즉시 기록 / Firestore 커밋은 명시 저장·제어된 이탈만 / 오프라인 persistence / `SaveStatus.tsx` 상태 머신("저장됨"=Firestore 확정) / 크래시 복구 배너([복구]/[버림]) / 기존 `dirty` state 재사용.

**드로어 (v2 §5.1):** `VersionDrawer.tsx` 우측 패널. 좌측 타임라인(순번·트리거 아이콘·이름·상대시각·작성자·변경 탭 칩·핀) + 우측 diff. 기본 비교쌍 = 선택 버전 ↔ parent. "현재 작업본과 비교" = `collectCurrentContent()` 즉석 해시.

> **개정 (2026-08-18, 기타 개선 3)** — **agent 패널과 같은 규약으로 통일했다.**
> - **덮지 않고 밀어낸다**: `position: fixed` 오버레이 → EditorView 루트 기준 `absolute`. 미는 쪽은 EditorView의 `rightPanelWidth`/`rightPanelOpen`이 담당하며, 댓글·agent 패널과 **같은 경로**를 탄다(Row1·Row2·Row3의 `paddingRight`). 폭은 `VERSION_DRAWER_WIDTH`(460)를 export해 미는 쪽과 공유한다. 둘 다 열리면 넓은 쪽 기준.
> - **디자인**: 바탕 `--bg-panel-agent`, `borderLeft`·그림자·슬라이드 transform 제거. 1행 = 제목+닫기(높이 57), 2행 = 이름 저장(높이 41, `SessionTabBar`와 같은 규격).
> - ⚠ **`zIndex` 1200 → 110**: `absolute`가 되면서 드로어가 **스태킹 컨텍스트를 만든다** → 그 안에서 열리는 `RestoreConfirm`(`fixed`·`zIndex 1400`)의 1400은 드로어 내부에서만 유효하다. 모달이 드로어 밖 요소를 덮으려면 **드로어 자신이** EditorView 안 최대치(리사이즈 핸들 100)보다 위에 있어야 한다. 복원 확인 모달이 무언가에 가리면 이 값을 먼저 의심할 것.

**보존 (v2 §6, D4):** 보호 = `manual_save`·`named`·`restore`·`pinned`. prune 후보 = `editor_exit`만. **하드 상한 50개**, 초과 시 오래된 후보부터. `createSnapshot` 성공 직후 인라인 `pruneProblemVersions`. **cascade: 메타 삭제 시 `payload/data` 반드시 동반 삭제.** `deleteProblem`(`lib/firestore.ts:100`) 확장: versions 전체+payload 정리. pruned parent는 재링크 없이 `resolveLivingParent` 폴백.

---

## 8. 파일/모듈 및 구현 순서

```
# 신규
types/version.ts                    lib/version/{canonicalize,hash,snapshot,read,diff,restore,prune,adapter}.ts
lib/blocks/normalize.ts             # toPersistedBlock (★ Stage 0)
hooks/useAutosave.ts  hooks/useVersionHistory.ts
components/version/{VersionDrawer,VersionTimeline,VersionDiff,RestoreConfirm}.tsx
components/editor/SaveStatus.tsx

# 수정
types/problem.ts                    # Block.block_key 추가 / ProblemWithBlocks.tabLoadErrors 추가(F7)
components/editor/EditorView.tsx    # toPersistedBlock 치환·block_key lazy backfill·분할/복제 새 키(F9→§3.3)·tabLoadErrors 보관·meta(제목·정답) 수집/복원(D1)·드로어·editor_exit (str_replace 최소수정, 기존 props 보존)
lib/firestore.ts                    # getProblemWithBlocks에 tabLoadErrors 노출(F7)·deleteProblem 확장·version_seq 백필
firestore.rules  tests/firestore.rules.test.mjs
docs/roadmap.md                     # Phase 54 누락분 + Phase 55
```

의존성: `npm i diff` (nanoid는 설치돼 있음).

**Stage 0 · 정체성·정형화 토대 (버전 코드 없이 독립 배포 가능)**
- `Block.block_key` + 생성 시 nanoid + 로드 시 lazy backfill(`toLocal`) + `handleSave` saveData 포함.
- **분할/복제 경로(`handleSplitBlock`·`handleSplitMathLines`)에서 파생 블록에 새 `nanoid()` 발급** (F9→§3.3).
- `toPersistedBlock` 추출·치환.
- 검증: 리팩터링 전후 저장 결과 필드 단위 동일. 저장→재로드 후 모든 블록에 block_key 존재, **재저장해도 block_key 불변**(doc id는 바뀌어도). **블록 분할 후 두 블록의 block_key가 서로 다름.** 기존 편집·저장·복제·삭제 회귀 없음.

**Stage 1 · 보안 규칙 (스냅샷 코드보다 선행 필수 — F3)**
- §5의 (1)(2)(3). 에뮬레이터 `test:rules` 전체 녹색 → 덕수가 라이브 배포.
- 검증: 신규 케이스 4종 + 기존 케이스 회귀 없음. **배포 완료 확인 후 Stage 2 진행.**

**Stage 2 · 스냅샷 생성**
- `types/version.ts`·canonicalize·hash·adapter(로드 가드+`getProblemWithBlocks` tabLoadErrors 노출 포함)·`createSnapshot`·해시 캐시·`version_seq` 백필. `manual_save` 배선.
- 검증: 저장→v1. 무변경 재저장→`unchanged`(쓰기 0). **열고 그냥 이탈 반복→유령 버전 0개(F4 해소 확인).** **제목·정답 변경→스냅샷 생성(changed_tabs 빈 배열·meta diff, D1). 난이도·태그·폴더만 변경→미생성.** 이미지 흑백/SVG 뷰만 변경→생성. imageGray 토글 on→off→on 원복→`unchanged`. payload 분리 저장. **`getProblemWithBlocks` 계약 확장이 기존 호출부(copyright·preview·duplicate) 회귀 없음.** 탭 로드 실패 주입 시 스냅샷 차단·안내(F7).

**Stage 3 · 계층1 자동저장** — §7 계층1. 검증: 타이핑 무지연, 새로고침 복구 배너, 상태표시.

**Stage 4 · 읽기+드로어** — read·`VersionDrawer`·`VersionTimeline`·`editor_exit`(제어된 이탈). 검증: 목록 메타만 로딩, 행 선택 시 payload 지연 로딩, 이탈 스냅샷.

**Stage 5 · diff+복원**
- `VersionDiff`(block_key 매칭)·`restoreVersion`(탭 동기화)·`RestoreConfirm`.
- 검증: **블록 순서만 변경→"이동" 표시**(삭제+추가 아님). **저장을 여러 번 거친 뒤에도 이동 인식 유지**(doc id 재발급 무관 — F1 해소 확인). 탭이 있던 버전으로 복원→탭 재등장, 탭이 없던 버전으로 전체 복원→라이브 탭·블록 정리(F6). **제목·정답이 다른 버전으로 전체 복원→제목·정답도 되돌아감(D1).** 복원 2-스냅샷(직전 보존+restore). 복원 후 block_key 연속.

**Stage 6 · 보존** — prune·cascade·`deleteProblem` 확장·`resolveLivingParent`. 검증: 상한 초과 시 `editor_exit`부터 payload 포함 삭제, 보호 트리거·핀 생존, 문항 삭제 시 versions 전체 정리.

---

## 9. 후속 Phase 자리 (v2 §10 유지 + 교정)

- GitHub 연동(56+): 서버 API·별도 콘텐츠 레포·`named` 한정·토큰 서버 env만.
- `contributors[]` 협업 누적 / 나머지 메타(난이도·태그·출처 등) 버전관리 승격 검토 / 전역 예약 pruning.
- 원본인증 연계: **두 해시는 별개** — 블록체인은 기존 `computeContentHash` 유지, 버전은 `content_hash`. 연계 시 매핑만 추가(F8).
- `step_label` 보존이 필요해지면 `handleSave` 저장부터 추가 후 버전 모델에 재편입(F9).
- 탭 reorder 도입 시: canonicalize 정렬 정책 재검토(F8 각주).

## 부록 — git workflow (변동 없음)
Claude Code가 커밋만 수행하고 push 명령을 제공한다. 덕수가 VSCode에서 직접 push → Vercel 자동 배포.
