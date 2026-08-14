# Phase 55a — 블록 Undo/Redo (실행취소·재실행) · 확정본

> 이력: v1(Claude Code 초안) → v2(웹 Claude 라이브 대조 `c921b71`) → v3(Claude Code CLI 재검증 + C9) → v4(웹 Claude 최종 검토, F1·F2) → **확정본(Claude Code가 F1·F2 CLI 재확인, phasedocs 등록).**
> **Phase 번호: 55a** — 자체 VCS(Phase 55)의 직접 확장. `collectCurrentContent`/`applyVersionContent`/`block_key` 재사용. ("Phase 56"은 "수식 세로 정렬" 스케치가 선점 → 충돌 회피.)
> **모든 결정 확정 · 착수 가능.** 규칙·서버 변경 없음(순수 클라이언트). 부록 A 라인 번호는 `c921b71` 실측(CLI 재확인).

---

## 확정된 결정

| # | 결정 | 내용 |
|---|------|------|
| D1 | Undo 구조 | **A안**(구조 전용 스택). 텍스트는 CodeMirror per-block undo 유지 |
| D2 | Cmd/Ctrl+Z 중재 | **포커스 가드** + `e.code`(C5) + 가드 범위 확장(C6). Ctrl+Y redo alias는 선택 |
| D3 | 되돌림 대상 | 구조 핸들러 10곳 + 미디어/그래프 삽입. 이미지 드래그성 필드(폭·뷰·높이)는 제외(후속) |
| D4 | 메타(제목·정답) | **제외** — C6 가드로 브라우저 기본 undo 유지 |
| D5 | 히스토리 수명 | **세션 인메모리**(새로고침 소멸) + 문항 전환 시 리셋(C9) |
| R1 | C2 한계 수용 | **수용(덕수)** — 끼어든 타이핑 되돌림(redo로 회수)·CM 히스토리 초기화 감수, A안 진행. 선택적 리마운트 최적화는 후속 |
| R2 | 블록 제목 | **제외** — CM 밖 input, C6 가드가 브라우저 undo 보장 |

### 착수 전 확정된 버그 수정 (구현에 필수)

- **C1**: `applyVersionContent`는 비제어 MarkdownEditor 때문에 그대로 재사용 불가 → **세대 id**로 매 apply마다 전면 리마운트(§2.1).
- **F1**: apply 시 **activeBlockId를 항상 유효값으로 재설정**(같은 탭 내 apply에선 보정 effect가 재실행 안 됨 → stale id 잔류 → 블록 추가 위치 등 오류)(§2.1).
- **C1+F1은 이미 배포된 Phase 55 restore/draft의 잠재 버그**(연속 복원 시 화면 미갱신·활성블록 오류)도 함께 고침 → Stage 1 회귀 검증 필수.
- **C4**: `collectCurrentContent`는 탭 로드 실패 시 throw → capture를 try/catch로 감쌈(§3.4).
- **C9**: 문항 전환 시 히스토리 리셋(§3.6).

---

## 0. 문제 정의 (레포 검증 완료)

- **블록 안 텍스트**: CodeMirror 자체 history로 Ctrl+Z 작동(history는 `basicSetup` 유래 — A-1).
- **블록 조작**(생성·삭제·이동·분할·타입변경·탭조작): 전부 `setCurrentBlocks`/`setAllBlocks`로 처리 → CM 히스토리 우회 → **Undo 불가**(A-2).

목표: 블록 조작까지 되돌리기/다시하기.

---

## 1. 핵심 판단 — "VCS 스냅샷"은 Undo 엔진이 아니다

VCS 스냅샷은 저장 시점에만 생기고 dedup되며(문항당 상한 50) 복원이 무겁다 → Ctrl+Z 입도에 안 맞음. **진짜 엔진 = 세션 인메모리 히스토리 스택.** Phase 55 부품 재사용:

| 필요 | 재사용 | 상태 |
|---|---|---|
| 캡처(push) | `collectCurrentContent()` — `lib/version/adapter.ts:20` | 그대로(throw 가드 C4) |
| 복원(undo apply) | `applyVersionContent()` — `EditorView.tsx:2536` | **개조 필수 C1+F1** |
| 구조 판정·연속성 | `block_key`(nanoid) | 그대로 |

---

## 2. 설계 — A안 (구조 전용 Undo)

### 2.1 🔴 C1+F1 — `applyVersionContent` 개조 (착수 선행)

**진단(레포 실측·CLI 재확인):**
- `MarkdownEditor`는 **비제어**: CM 초기화 `deps:[]` 1회(`MarkdownEditor.tsx:892`), `initialValue`는 마운트 시만, prop→doc 동기화 없음.
- 블록 렌더 key = `block.id`(**`EditorView.tsx:2974` 편집창 · `3046` 미리보기** — CLI 재확인값). `applyVersionContent`는 id를 항상 `v-${block_key}` 고정(2541).
- → 두 번째 apply(redo 등)는 id 동일 → 리마운트 없음 → **CM 화면 미갱신**. "추가→↶→↷"에서 재현.
- **F1**: activeBlockId 보정 effect는 deps `[activeTab]`(2149-2158)라 **같은 탭 내 apply에선 재실행 안 됨** → 세대 id로 모든 id가 바뀌면 activeBlockId가 사라진 id를 가리킨 채 잔류 → `handleAddBlock` 삽입 위치 계산(2532)이 못 찾아 **끝에 삽입**되는 등 오류.

**개조 (최종):**

```ts
// EditorView.tsx — applyVersionContent 시그니처 확장
const applyGenRef = useRef(0);   // 세대 카운터

const applyVersionContent = (
  content: VersionContent,
  ui?: { activeTab?: string; activeBlockKey?: string },  // undo/redo가 UI 복원
) => {
  const gen = ++applyGenRef.current;
  const { tabs: vTabs, blocksByTab, title, answer } = versionContentToLocal(content);
  const map: Record<string, LocalBlock[]> = {};
  for (const t of vTabs) {
    map[t.id] = (blocksByTab[t.id] || []).map((b) => ({
      ...b, id: `v${gen}-${b.block_key}`,               // 세대 포함 → 항상 리마운트 (C1)
      collapsed: false, title: b.title || '',
    })) as LocalBlock[];
  }
  setTabs(vTabs);
  setAllBlocks(map);
  setEditTitle(title);
  setEditAnswer(answer);
  const nextTab = ui?.activeTab && vTabs.some((t) => t.id === ui.activeTab)
    ? ui.activeTab : (vTabs[0]?.id || 'question');
  setActiveTab(nextTab);
  // F1: activeBlockId를 항상 유효값으로. 같은 탭 apply에선 [activeTab] effect가 안 돌아 stale 잔류.
  const found = ui?.activeBlockKey
    ? (map[nextTab] || []).find((b) => b.block_key === ui.activeBlockKey)
    : undefined;
  setActiveBlockId(found?.id ?? map[nextTab]?.[0]?.id ?? null);
  setDirty(true);
};
```

- **세대 id** `v${gen}-${block_key}`: 매 apply 전면 리마운트 → CM 항상 새 doc. (비용: CM 히스토리 초기화·커서 소실 — C2로 수용. `editorRefs`는 block.id 키라 새 id를 따라감.)
- **F1 재설정**: `ui.activeBlockKey` 매칭 우선, 실패·미지정 시 첫 블록 폴백. 항상 유효 id.
- **하위호환**: 기존 호출부(드래프트 복구·VCS 복원)는 인자 없이 호출 → 탭 불변 + activeBlockId는 첫 블록으로 재설정(기존 stale 버그 해소).
- **회귀**: 드래프트 복구·restore(연속 2회 포함)를 Stage 1 검증에.

### 2.2 🟠 C2 — A안의 본질적 한계 (R1 수용)

capture가 `VersionContent` **전체**라: ① push 이후 끼어든 타이핑도 구조 undo 시 되돌아감(redo 회수), ② 세대 id 리마운트로 구조 undo 한 번에 **모든 블록 CM 히스토리 초기화**. → **수용**(§R1). 완화책(변경 블록만 리마운트로 미변경 블록 CM 보존)은 초판 전면 리마운트 이후 후속.

---

## 3. A안 메커니즘

### 3.1 히스토리 스택 (신규 `hooks/useBlockHistory.ts`)

```ts
interface HistoryEntry {
  content: VersionContent;       // collectCurrentContent() 결과 (정형화 통과본 — §5)
  activeTab: string;
  activeBlockKey: string | null; // id는 세대마다 바뀌므로 block_key로 저장
}
interface HistoryState { past: HistoryEntry[]; future: HistoryEntry[]; }

// capture(): 라이브 상태 → HistoryEntry. 실패(VersionLoadError) 시 null (C4)
// pushUndo(): const cur = capture(); if (!cur) return; past.push(cur); future = [];
// undo():     const cur = capture(); if (!cur || !past.length) return; future.push(cur); apply(past.pop())
// redo():     대칭
// reset():    past=[]; future=[]   ← C9: 문항 전환 시
// canUndo/canRedo = past/future.length > 0
// past 상한 100 (초과 시 shift) — 엔트리당 수 KB
```

### 3.2 push 타이밍 — C3: "검증 통과 후, mutate 직전"

no-op 경로(confirm 취소·제자리 드롭·updater 내부 가드)에서 첫 줄 push는 빈 엔트리로 스택 오염 → "검증 후 mutate 직전" 규칙.

| 핸들러 | no-op 경로 (실측) | 조치 |
|---|---|---|
| `handleDeleteTab` (2224) | `tabIdx<2`(2226), **confirm 취소**(2229) | confirm 통과 후 push |
| `handleDeleteBlock` (1506) | `prev.length<=1` 가드가 **updater 내부**(1508) | `currentBlocks.length<=1` 사전 검사 후 push |
| `handleDragEnd` (1882) | `!over`, 제자리·묶음 내부 드롭, 인덱스 실패 — updater 내부 | 이동 여부 **사전 계산** → 실제 이동만 push |
| `handleSplitBlock` (1562) | 타입·ref early return 3곳(1563-1568) | 가드 통과 후 `ref.setContent(before)` 직전 push |
| `handleAddBlock` (1517) | 없음 | mutate 직전 push |
| `handleBlockTypeChange` (1441) | 동일 타입 재선택 | `b.type !== type` 확인 후 push |
| `handleAddTab` (2185) | 없음 | mutate 직전 push |
| `commitTabLabel` (2253) | 빈 문자열·변경 없음 | `trim() && label!==기존` 확인 후 push |
| `handleBlockMediaUpload` (1607, async) | 업로드 실패(throw) | **await 성공 이후** push |
| `handleInsertGraphBlock` (1642, async) | 업로드 실패(throw) | **await 성공 이후** push |

- `handleBlockChange`(1415, 텍스트) — push 제외(CM 담당). `handleBlockTitleChange`(1500) — R2 제외. 필드 핸들러(1542·1549·1556·1678·1687·1694·1703) — D3 제외.

### 3.3 재-push 무한루프 없음

`undo()`/`redo()`의 `applyVersionContent`는 구조 핸들러를 경유하지 않아 `pushUndo` 재호출 없음 → suppress 플래그 불필요.

### 3.4 🟡 C4 — capture throw 가드

```ts
function capture(): HistoryEntry | null {
  try {
    return { content: collectCurrentContent({ tabs, blocksByTab: allBlocks,
      title: editTitle, answer: editAnswer, tabLoadErrors: tabLoadErrorsRef.current }),
      activeTab, activeBlockKey: keyOf(activeBlockId) };
  } catch { return null; }   // 로드 실패 탭 → push/undo 스킵, 조작은 정상
}
```

### 3.5 Cmd/Ctrl+Z 중재 — C5 + C6

```ts
// C5: e.code (Korean IME + 단축키 규칙. 기존 Ctrl+Shift+L도 e.code).
if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') {
  const el = document.activeElement as HTMLElement | null;
  const inTextEditing = !!el && (                       // C6: CM + 모든 입력 필드
    el.closest('.cm-editor') !== null ||                // 블록 CM·토론창 LatexInputEditor
    el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || // 제목·정답·탭이름·찾기/바꾸기
    el.isContentEditable
  );
  if (inTextEditing) return;                            // CM/브라우저 기본 undo에 위임 (D4)
  e.preventDefault();
  e.shiftKey ? redo() : undo();
}
// (선택) Ctrl+Y redo alias: e.code === 'KeyY'
```

- **Row 2 툴바 맨 왼쪽 ↶ ↷ 버튼**: 포커스 무관 항상 동작, `canUndo`/`canRedo`로 dim. `UnifiedToolbar` **밖**, row 컨테이너(2770)의 첫 자식 → `showToolbar` 무관 항상 표시.
- 이중 실행 없음: CM 포커스 시 CM historyKeymap 처리 + 위 가드 return → 앱 undo 미발화.
- 한계: 블록에 커서 둔 채 Cmd+Z는 텍스트 undo 우선. "방금 지운 블록 복구"는 ↶ 버튼 또는 포커스 밖 Cmd+Z.

### 3.6 🟠 C9 — 문항 전환 시 히스토리 리셋

`EditorView`는 문항 전환 시 리마운트되지 않고 load effect(`[problemId]`)만 재실행(A-9) → undo 스택이 이전 문항 상태를 새 문항에 apply하는 오염. → **load effect(1063~)에서 문항 로드 직후 `history.reset()`**(드래프트 복구·해시 캐시 초기화와 같은 지점).

---

## 4. B안 (미채택, 기록용)

텍스트+구조 한 스택. CM `history` 제거 + 앱 전체 상태 디바운스 스냅샷. 에디터 코어 리팩터·리스크 커서 R1 수용으로 미채택. C2 한계가 실사용에서 자주 거슬리면 그때 승격.

---

## 5. 엣지 케이스 / 상호작용

- **dirty/draft**: `applyVersionContent`가 `setDirty(true)`(2549) → 드래프트 effect 기록. 일관.
- **VCS 스냅샷과 독립**: undo로 되돌린 뒤 저장하면 그 상태가 스냅샷됨.
- **⚠️ 문항 전환 = 히스토리 리셋 (C9)**: §3.6.
- **⚠️ 탭 전환 = 자동저장** (`switchTab`→`handleSave(true)`, 2410): 저장 리로드가 로컬 id를 서버 id로 교체하나 히스토리는 content(block_key) 기반이라 생존. 검증 시나리오 필수.
- **⚠️ capture는 정형화 통과본**: `toPersistedBlock`(normalize.ts:28)이 빈 줄 트림·`$$` 공백 정규화 → 복원본이 원문과 공백에서 다를 수 있음(저장본과 동일 형태라 무해, 인지만).
- **collapsed 소실**: `applyVersionContent`가 `collapsed:false` 강제 → undo 후 전체 펼침. `collapseMode` 켜져 있으면 `setCollapseMode(false)` 동기화(Stage 4).
- **탭 조작 undo**: 탭 삭제 undo → 탭·블록 복구. 저장 후라도 delete-all→re-add로 일관.
- **`origBlockIds`/저장 재조정**: undo는 in-memory만 → 저장 시 delete-all→re-add(2310-2331)가 처리. block_key 유지 → VCS diff 연속성.
- **미디어 업로드 undo**: 블록 상태만 되돌아가고 Storage 파일 잔존(고아) — 허용.
- **커서/스크롤**: 전면 리마운트로 커서 소실 — C2 한계로 수용.

---

## 6. 파일/모듈

```
# 신규
hooks/useBlockHistory.ts            # HistoryEntry past/future + push/undo/redo/reset/canUndo/canRedo (§3.1)

# 수정
components/ui/Icons.tsx             # IconUndo·IconRedo(굽은 화살표 ↶↷) 신규 — 현재 없음(확인)
components/editor/EditorView.tsx    # ① applyVersionContent 개조: 세대 id + ui 파라미터 + activeBlockId 항상 재설정 (C1+F1)
                                    # ② 구조 핸들러 10곳 "검증 후 mutate 직전" push (C3, §3.2)
                                    # ③ window keydown에 Cmd/Ctrl+Z·Shift+Z — e.code + 확장 가드 (C5·C6)
                                    # ④ Row 2 row 컨테이너(2770) 첫 자식으로 ↶↷ 버튼
                                    # ⑤ load effect(1063~)에서 history.reset() — 문항 전환 (C9)
```

- 규칙·Firestore 변경 없음 — 순수 클라이언트. 배포 순서 제약 없음.

---

## 7. 구현 순서

**Stage 1 · applyVersionContent 개조 + 히스토리 훅 + Row 2 버튼 + 문항 리셋(C9)**
- C1+F1 개조(세대 id + ui + activeBlockId 항상 재설정, 하위호환) 먼저. `useBlockHistory`(reset 포함) + capture(C4)/apply 연결. Row 2 ↶↷ 버튼. load effect에 `history.reset()`.
- 검증: ① 블록 추가→↶ 복구→↷ 재실행 **→ 다시 ↶**(세대 id 핵심) ② canUndo/canRedo dim ③ **같은 탭에서 undo 진행 후 블록 추가가 활성 블록 다음에 정확히 삽입**(F1) ④ **회귀**: 드래프트 복구·VCS 복원(**연속 2회 포함**) 정상 ⑤ **문항 A 조작 후 B로 전환 → B에서 ↶ 눌러도 A 상태 안 튀어나옴**(C9).

**Stage 2 · 구조 핸들러 push 배선 (10곳)**
- §3.2대로 — updater 내부 가드 추출 리팩터 포함. `handleBlockChange` 미배선 확인.
- 검증: 생성/삭제/이동(단일·묶음)/분할/타입변경/탭 추가·삭제·이름변경/미디어/AI그래프 각각 ↶↷. **no-op 확인**(confirm 취소·제자리 드롭·동일 타입 재선택 후 ↶가 빈 엔트리 아닌 실제 이전 조작을 되돌림). 타이핑은 스택 안 늘어남.

**Stage 3 · 단축키 배선 (C5·C6)**
- window keydown에 `e.code === 'KeyZ'`(±Shift) + 확장 가드.
- 검증: ① 블록 밖 Cmd+Z=구조 undo ② 블록 안=텍스트 undo(CM), 이중 실행 없음 ③ 제목/정답/탭이름/찾기바꾸기 입력 중=브라우저 undo(앱 미개입) ④ **한글 입력 모드**에서 Cmd+Z/Cmd+Shift+Z 정상.

**Stage 4 · 엣지 다듬기**
- activeTab/activeBlockKey 복원, past 상한 100, collapseMode 동기화.
- 검증: **탭 전환(자동저장) 후 undo**(§5), 탭 삭제 undo→저장→VCS diff 연속성, 로드 실패 탭에서 조작이 안 죽는지(C4).

---

## 부록 A. 현재 코드 사실관계 (`c921b71` 실측 — CLI + 웹 Claude 상호 확인)

**A-1. 스택.** Next.js 14, per-block CodeMirror. CM history·historyKeymap은 `basicSetup`(MarkdownEditor.tsx:629)에서 활성. `autocompletion({defaultKeymap:true})`(613-617)은 자동완성 키맵으로 history와 무관.

**A-2. 블록 조작은 CM 히스토리 우회.** `setCurrentBlocks`/`setAllBlocks` 경유. CM은 텍스트만 관리.

**A-2'. [핵심] MarkdownEditor는 비제어.** CM 생성 `deps:[]` 1회(892), `initialValue`는 마운트 시만, prop→doc 동기화 없음. 블록 렌더 key `block.id`(**2974 편집창 · 3046 미리보기** — CLI 재확인). → C1 근거.

**A-3. 구조 핸들러 실명·라인.** `handleAddBlock`(1517)·`handleDeleteBlock`(1506)·`handleSplitBlock`(1562)·`handleDragEnd`(1882)·`handleBlockTypeChange`(1441)·`handleAddTab`(2185)·`handleDeleteTab`(2224, confirm)·`commitTabLabel`(2253)·`handleBlockMediaUpload`(1607, async)·`handleInsertGraphBlock`(1642, async). 제외 후보(R2): `handleBlockTitleChange`(1500). 텍스트성(push 제외): `handleBlockChange`(1415)·`handleSplitMathLines`. 필드 핸들러(1542·1549·1556·1678·1687·1694·1703) — 제외.

**A-4. 기존 window keydown.** 2160-2182: Ctrl+F/B/J(`e.key`)·Ctrl+Shift+L(`e.code`). Ctrl+Z 앱 미사용 → 추가. 신규는 `e.code`(C5).

**A-5. Phase 55 부품.**
- `collectCurrentContent`(adapter.ts:20) — `tabLoadErrors` 시 throw(29-31 → C4), 출력은 `toPersistedBlock` 정형화 통과본(→ §5).
- `applyVersionContent`(EditorView.tsx:2536) — id `v-${block_key}` 고정(2541)·`setActiveTab(vTabs[0])`(2548)·`collapsed:false`(2541)·activeBlockId 미재설정(F1). **개조 필요(C1+F1)**.
- `Block.block_key`(nanoid) — 영속 식별자, undo 복원 후 유지.

**A-6. dirty 추적 + F1 근거.** dirty effect(`skipDirtyRef`). `applyVersionContent`가 `setDirty(true)` 직접(2549). **activeBlockId 보정 effect(2149-2158)는 deps `[activeTab]`** → 같은 탭 내 apply에선 재실행 안 됨 → F1의 근거. `handleAddBlock` 삽입 위치가 activeBlockId 의존(2532).

**A-7. 탭 전환 자동저장.** `switchTab`(2410) → `handleSave(true)` → delete-all→re-add(2310-2331). 히스토리는 content 기반 생존.

**A-8. Icons.** IconUndo/IconRedo 부재(확인) → 신규. Row 2: row 컨테이너(2770) 안 `UnifiedToolbar`(2779) + 탭 목록 → 버튼은 컨테이너 첫 자식.

**A-9. [C9] 문항 전환.** `EditorView`는 `AppShell.tsx:779`에서 `key` 미지정, `problemId` prop + load effect `[problemId]`(1097)로 재로드 → 리마운트 없음. → undo 스택 수동 리셋 필요(§3.6). (편집창→탭→다른 문항처럼 `view.type`이 바뀌는 경로는 리마운트되어 안전하고, reset은 어느 경로든 무해.)

## 부록 B. 로드맵 메모
GitHub 연동(별도 Phase)은 이 Phase 이후로. Undo/Redo는 규칙·서버 변경 없어 순수 클라이언트로 독립 배포 가능.
