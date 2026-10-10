# Phase 69 iPad 필기 보조 입력(`/ink`) 구현 계획서 v4 착수판

- 작성: CLI Claude · 2026-10-10 — **HEAD `9976d3d`** 재실측(v1~v3와 같은 HEAD) + 확정 디자인 샘플 「Mathory Ink Pad」 v4 원본 HTML 대조(`claude.ai/artifact/36uWUqC7BeH1Sz8mhHFiVS` — 그리기 코드가 v3 §5-5의 원천)
- 계보: v1 web → v2 CLI 교차검토(E1~E17 · G1~G20) → v3 web 재검증(H1~H7 · F1~F12) → **v4 CLI 착수판**(v3 점검 K1~K12 · **핀치 줌 추가**(P23 (a) → (b), 덕수 2026-10-10)) → 구현
- **덕수 확정(2026-10-10)**
  - 필기 패드 디자인 = 샘플 v4 기본값(크기·디자인 적절 — 실기기 확인). 필기감은 차차 개선
  - **P23 (b) 두 손가락 확대·이동을 넣는다** — "첨자를 쓸 때 습관적으로 핀치 줌을 한다. 없으면 답답할 것"(다른 사용자도 같을 것으로 예상)
  - "바로 구현" — v3의 ★ 남은 판정(P11 · P17 · P19 · P24)은 **권장안으로 착수**한다(아래 §9). 실물에서 뒤집히면 그때 고친다
- 원 구상(v3 그대로): (1) 데스크톱 + 키보드·트랙패드가 기본, iPad+Pencil 상시 비치 (2) 떠오르면 펜으로 (3) 5줄 짧은 수식, 줄마다 희미한 보조선, 수식만 (4) 완료 → 이미지로 전송 (5) 즉시 LaTeX로 편집창에 (6) **받은 이미지는 문제의 첨부로 보관 — 열어 보고 삭제 가능**. 작동 방식: iPad 먼저 → 데스크톱 3단 확인(좌 원본 · 중 렌더 · 우 LaTeX 편집) → 확인 시 커서에 삽입 → 데스크톱 준비 안 됐으면 iPad 로드 직후 안내
- 번호: **69**

> 읽는 순서: v3와 달라진 것은 **부록 B(K1~K12)**, 줌의 부담 점검은 **부록 C**, 착수 판정은 **§9**.

---

## 0. 요약

| 묶음 | 내용 |
|---|---|
| **A. iPad 필기 페이지 `/ink`** | AppShell 밖 독립 라우트 · Google 팝업 로그인(claim 없음) · 확정 디자인(상단 바 + 5줄 · 보조선 2개 · 예시 수식) · Pencil = 쓰기 · **두 손가락 = 확대(1~3배)·이동**(손바닥 무시 규칙) · 완료 = PNG·획 JSON 업로드 + `/api/ocr` 병렬 → `users/{uid}/ink_jobs/{jobId}`(`ready`) |
| **B. 데스크톱 수신·확인** | `EditorView`가 마운트하는 `InkInbox`가 `ready` job 구독 → 하단 도킹 비모달 3단 카드(좌 원본 · 중 KaTeX · 우 `LatexInputEditor`) → 확인 = 활성 블록 커서(선택이면 대체)에 `insertPlainText` → `inserted` · 취소 = 확인창 → 문서·파일 삭제 |
| **C. 준비 상태 안내** | `EditorView`가 `users/{uid}/ink_state/presence`에 `{canInsert, reason, label}` heartbeat → `/ink` 상단 바 상태 칸 |
| **D. 첨부 보관** | `inserted` job = 그 문항의 필기 첨부. Row 2 **필기 첨부** 버튼 → 목록 · 크게 보기 · 삭제 |

**서버 라우트 신설 0** · `/api/ocr` additive **opt-in 1갈래**(K10 — `withLatex: true`일 때만 `latex_styled` 요청, 기존 두 소비자의 요청 바이트 불변) · Firestore 규칙 +2 match · Storage 규칙 +1 match · 문항 스키마 0 · raw_text 규약 0 · 전처리 0 · 렌더 5사이트 0 · 폰 0 · 단일 세션 코드 0 · **의존성 0** · ICONS 62 → **63**(`scribble`).
신규 12(라우트 1 · 컴포넌트 4 · 순수 lib 4(**`view` 신설** — 줌) · firestore lib 1 · 테스트 1 · 임시 라우트는 별도) · 수정 11.

클릭 수(필기 제외): iPad **완료** 1 + 데스크톱 **확인** 1 = **2회**(핀치는 클릭이 아니다). 예상 지연 2~4초(S3 실물에서 잰다).

---

## 1. 선행 확인 — 실측 (HEAD `9976d3d`)

v3 §1의 A1~A9 · B1~B9 · C1~C8 · D1~D9 · E1~E8은 **v4에서 다시 확인해 모두 성립**한다(줄 번호 포함). 아래는 그 요지와 v4 추가분(＋)이다.

### 1-A. 단일 세션·로그인

- claim·watch는 **AppShell 한 곳**(`AppShell.tsx:173-195`) · kick은 `signOut`(`lib/session.ts:86`) · `lib/firebase.ts:18-21` 주석은 낡았다
- AppShell 밖 팝업 로그인 전례 5곳(공개 라우트 3 · 폰 셸 2 — iOS Safari 실기기 검수 통과)
- `authDomain` = `*.firebaseapp.com` + Vercel → 리디렉트는 Safari에서 깨지는 구성, 팝업은 Firebase 해결책 Option 2(H2) → **팝업만**
- iPad Safari에서 루트를 열면 데스크톱이 튕긴다(A7) · 같은 Safari의 다른 탭 `signOut`이 `/ink`도 로그아웃시키는지는 실물 확인(A9·H3)

### 1-B. OCR 경로

- `/api/ocr`(`app/api/ocr/route.ts`) `formats:['text']`(`:43`) · 응답 `{ text, confidence }`(`:72`) · 무인증 · 소비자 둘(`EditorView.tsx:2566-2576` · `CommentEditor.tsx:115-125`)은 `data.text`만 읽는다
- `lib/ocr.ts`는 `proofread`·`invisibles` import → `/ink` 번들 금지
- Mathpix(H1, 공식 문서 재확인): **`latex_styled` = "returned only in cases that the whole image can be reduced to a single equation"** · **base64 이미지 2MB · JSON 본문 5MB** · `is_handwritten` 필드 · `latex_styled`·`text` 모두 Mathpix 사용자 정의 매크로(`\longdiv`·`\Perp` 등)를 담을 수 있다(＋ — 기존 OCR 경로와 같은 노출이라 69의 새 위험은 아니다)

### 1-C. 삽입·커서·단축키

- `insertPlainText`(`MarkdownEditor.tsx:358-369`) — 선택 대체 · undo 1스텝 · 블록 밖 클릭으로 `activeBlockId`가 null이 되지 않는다
- 접힌 블록은 CM 미마운트(`EditorView.tsx:1001`) · `TEXT_BASED_TYPES`는 지역 상수(`:179`)
- window keydown(`:2829-2909`)의 ⌘F·⌘B·⌘J·⌘⇧L은 포커스를 보지 않는다 · ＋ 블록에 작용하는 **전역 keydown은 이 핸들러 하나뿐**(나머지 전역 keydown 14곳은 각자 모달·뷰어의 Escape 등 — grep 전수)
- `probeInsertionRegion`(`lib/mathRegions.ts:176-179`) · 인접 `$` 공백 규약(M7 D1·D4)
- ＋ 제목 `editTitle`(`:1107`) · 탭 `tabs: TabMeta[]`(`:1063`)

### 1-D. 화면 재료

- `LatexInputEditor` — CM 툴팁 기본 배치(fixed) → transform 조상 금지 · `initialValue`는 **마운트 때만** 읽는다(＋ K-구현: 카드는 `key={job.id}`로 재마운트)
- `Z_DIALOG 10500` · `Z_TOOLTIP 10400` · 블록 CM 툴팁 호스트 10200 · 큰 모달 선례 z **9000**(`SheetImportModal.tsx:194` · `BatchVerifyDialog.tsx:30`)
- `confirmDialog(options: ConfirmOptions)` — **객체 인자**(`{ title?, message, danger?, confirmLabel?, cancelLabel? }` · `lib/dialogs.ts:16-23·106`) ← K1
- Row 2 아이콘 함수는 `UnifiedToolbar.tsx:46-135`(`PhIcon d={PH.x} size={ICON_SIZE}`) · 항목 `rightItems :681~` · 툴바 배지 선례 없음
- 워드마크 두 벌(작은 19/400/`--wordmark-small`/그림자 = `Wordmark size={19} color="var(--wordmark-small, #944728)" shadow`, `Sidebar.tsx:880`)
- 기존 아이콘 `IconUndo :88`(18) · `IconTrash :93`(14 — `size` prop으로 18) · `IconCheck :96` · `IconUserCircle :77` — `phIcon` 팩토리는 `size` prop을 받는다(`Icons.tsx:38-42`)
- 루트 레이아웃이 KaTeX 0.16.28 CSS(CDN)를 싣는다 → `KaTeX_Main`·`KaTeX_Math`·`KaTeX_Size2` `@font-face`가 `/ink`에서도 선언돼 있다 · 캔버스 텍스트는 글꼴 로드를 트리거하지 않는다
- 토큰: `--bg-functional #FCFAF6` · `--bg-content #F4EFE7` · `--border-content #D2C8B8` · `--text-primary #2D2A23` · `--text-muted` · `--mathory-red` · `--mathory-red-dark #BC5F3F` · `--wordmark-small #944728` · `--accent-success #5f6b3c`(올리브 — 팔레트 밖 유일 예외 "성공")
- ＋ **샘플은 앱 토큰과 몇 값이 다르다**(샘플 `--text-primary #2B2622` · `--border-content #D9D0C2` · 획 `#1F1B17` · 상태 점 `#7E8F4A`) — 앱은 **앱 토큰**을 쓴다(색 팔레트 규약). 캔버스는 `var()`를 못 받으므로 마운트 때 `getComputedStyle`로 읽는다

### 1-E. 저장·규칙

- Storage 규칙 `problems/`만 열림 · create/update와 delete 분리(61e) · `lib/storage.ts`는 DOMPurify를 끈다 → `/ink`는 `firebase/storage` 직접
- `users/{uid}` 아래 본인 전용 서브컬렉션 한 줄 규칙 3개(`firestore.rules:25-43`) · `problems/{id}/{sub}` 와일드카드는 공개·멤버 read → 필기는 `users/` 밑
- `test:rules`는 Firestore 에뮬레이터만 · 앱은 에뮬레이터 미연결 · 단일 조건 쿼리는 자동 인덱스
- ＋ dev 서버 미가동(포트 3000 LISTEN 없음 — 2026-10-10 착수 시점)

---

## 2. 결정

### A. `/ink` 페이지

| # | 결정 |
|---|---|
| D1 | **라우트** `app/ink/page.tsx`(서버 컴포넌트 — `metadata { title:'Mathory Ink', robots:{ index:false } }` · `viewport { width:'device-width', initialScale:1, maximumScale:1, viewportFit:'cover' }`) → 클라 `components/ink/InkPad.tsx`. ResponsiveShell·MiniShell·AppShell 없음. 루트 레이아웃 공유(DialogHost · KaTeX CSS · globals.css) |
| D2 | **로그인**: `onAuthStateChanged` 직접(`useAuth` 금지). 비로그인이면 쓰기 면 대신 가운데 버튼 → `signInWithPopup`. 리디렉트 폴백 없음. 실패 시 사유. ⚠ `claimSession`·`releaseSession` 호출 금지 |
| D3 | **운용 = Safari 탭 고정**. 자동 잠금 끔·충전 거치 권장. ⚠ iPad Safari에서 루트(`mathory.app/`)를 열지 않는다 |
| D4 | **화면 = 확정 샘플**(§5-4·§5-5). ① **상단 바 48px** — 배경 `--bg-content` · 아래 0.5px `--border-content` · 왼쪽 `Wordmark` 작은 사양 + 12px `--text-muted` "Ink" · **상태 칸**(D8) · 오른쪽 버튼 [**확대 %**(확대 중에만 — D5′)][되돌리기][모두 지우기][계정][**완료**(`--mathory-red-dark` 채움, 흰 글자)]. 버튼은 높이 36 · radius 8 · 아이콘 18 + 13px 라벨(샘플 `.ib`) ② **쓰기 면** — 배경 `--bg-functional` · 높이 = 뷰포트 − 48을 **5줄** 등분 · 줄마다 **보조선 2개**(줄 높이 **34%·68%**) · 점선(대시 1.5 / 간격 5, 둥근 끝) · 색 `--mathory-red-dark` **28%** · 좌우 16px 안쪽 · **줄 사이 구분선** 검정 7% 실선 · 보조선·구분선·예시는 **격자 캔버스**(포인터 무반응) → 내보내기 PNG에 안 들어간다 ③ **예시 수식** — 마지막 줄 오른쪽 끝에 `\int_{a}^{b}\frac{4}{3}x^{2} dx`를 KaTeX 글꼴로 `--text-primary` 20% ④ **가운데 안내**(획이 0일 때만) "Apple Pencil로 쓰세요 / **두 손가락으로 확대·이동 · 손바닥은 무시됩니다**"(K12 — 샘플 문구 개정) ⑤ 회전·리사이즈 시 획 좌표는 그대로, **확대는 1배로 되돌리고** 격자·예시·획을 다시 그린다 ⑥ 페이지 루트는 `position:fixed; inset:0`(body 스타일을 건드리지 않는다 — globals.css는 앱 전역) |
| D5 | **펜 입력**: `pointerType === 'pen'`만 획(`?input=mouse`면 mouse도 — 노출 안 함). `pointerdown` → `setPointerCapture` · `buttons & 1`인 동안만(Pencil 호버 배제) · `getCoalescedEvents`가 있으면 그것(기능 탐지, x·y만) · `pointerup`·`pointercancel`·`lostpointercapture`에서 종료. 좌표는 **`toPaper(view, …)`**(D5′)로 종이 좌표. 획 굵기 **2.5 종이 단위**(확대하면 화면에서 같이 굵어진다 — 종이처럼) · 필압 무반영 · 획 색 `--text-primary`. 페이지 차단 세트: 루트 `touch-action:none` · `overscroll-behavior:none` · `-webkit-user-select:none` · `-webkit-touch-callout:none` · document `gesturestart/change/end` `preventDefault` · 캔버스 `touchmove {passive:false}` `preventDefault` · `contextmenu` 차단 |
| **D5′** | **두 손가락 확대·이동**(P23 (b) — 순수 `lib/ink/view.ts` + `InkCanvas` 배선). ① **보기 변환** `view = { s, tx, ty }`(화면 = 종이·s + t, 쓰기 면 기준 CSS px), 처음은 항등. 획·격자·예시는 전부 **종이 좌표**에 있고 그릴 때 `ctx.setTransform(dpr·s, 0, 0, dpr·s, dpr·tx, dpr·ty)` 한 번으로 바뀐다 ② **범위** `s ∈ [1, 3]`(`ZOOM_MIN`·`ZOOM_MAX`) · 이동은 종이가 화면을 늘 덮도록 `tx ∈ [W − W·s, 0]` · `ty ∈ [H − H·s, 0]`(`clampView`) ③ **제스처** — touch 포인터 **둘**이 쓰기 면에 있을 때: 시작 시점의 두 점·보기를 잡고, 이동마다 `s = s0 · |a1b1| / |a0b0|`, 처음 두 점의 중점 아래 종이 점이 현재 중점을 따라가게 `t`를 정한 뒤 clamp(`pinchView` — 확대와 두 손가락 이동이 한 식) · rAF로 다시 그림 · **한 손가락은 아무것도 안 한다**(손바닥 안전) ④ **손바닥 규칙**(오작동 방지 — 상수는 실물 조율): ⓐ 펜 획이 진행 중이면 touch 무시 · 제스처 중 펜이 닿으면 제스처 종료(**펜 우선**) ⓑ 두 손가락의 착지 시각 차가 **250ms 이내**일 때만 제스처(`PAIR_WINDOW_MS` — 먼저 닿아 있던 손바닥 + 나중 손가락은 안 된다) ⓒ 펜을 뗀 뒤 **300ms** 안에 닿은 touch는 무시(`PEN_COOLDOWN_MS`) ⓓ 두 점 거리·중점이 **6px** 넘게 움직이기 전에는 보기를 바꾸지 않는다(`SLOP_PX`) ⓔ 셋째 손가락부터는 무시 ⑤ **되돌리기**: 확대 중이면 상단 바에 `{배율}%` 버튼(title "원래 크기로") → 항등. 리사이즈·회전·**전송 성공**에서도 항등으로. 모두 지우기·되돌리기는 보기를 건드리지 않는다 ⑥ **격자 선은 화면 굵기 고정** — 보조선·구분선 `lineWidth = 1/s` · 대시 `[1.5/s, 5/s]`(확대해도 머리카락 선·같은 점 간격). 예시 수식 글자는 종이와 함께 커진다 ⑦ **캔버스 크기는 화면 크기 그대로**(배경 버퍼 = 쓰기 면 × DPR) — 확대를 큰 캔버스로 만들지 않는다(iOS 캔버스 면적 상한 약 1,678만 px: 12.9″ 화면 × DPR 2 ≈ 560만은 안전, ×3배 버퍼면 초과) ⑧ **내보내기·획 JSON·OCR은 무관**(종이 좌표) |
| D6 | **버튼**: 되돌리기(마지막 동작 — 모두 지우기도 되돌린다) · 모두 지우기 · 계정(`IconUserCircle` → 작은 팝오버: 로그인 이메일 + 로그아웃(`signOut`만)) · 완료. 획 0이면 모두 지우기·완료 비활성 · 되돌리기는 스택이 비면 비활성. 지우개·더블탭·영역 선택·설정(⚙) 없음 |
| D7 | **완료**(`lib/inkJobs.sendInkJob`): ① 획 0 → 무동작 ② `jobId = doc(collection(db,'users',uid,'ink_jobs')).id` ③ PNG — 흰 배경 · 획 bounds + 24 + 획 굵기 · **축척 = min(2, 2000 / 긴 변)**(K5 — 샘플 그대로, DPR 무관) · data URL이 **1.9MB를 넘으면 긴 변 1400으로 다시** · 축척은 순수 `exportPlan` ④ **병렬** [PNG 업로드(`image/png`) → `getDownloadURL`] · [획 JSON 업로드(`application/json` 명시)] · [`/api/ocr` `{ src, withLatex: true }`] ⑤ OCR 실패는 `ocrError`로 기록하고 계속 · 업로드 실패는 전체 실패(올라간 파일 best-effort 삭제) ⑥ `setDoc(job, { status:'ready', ocrText, ocrLatex?, confidence?, isHandwritten?, ocrError?, imagePath, imageUrl, strokesPath, createdAt: serverTimestamp() })` ⑦ 성공 → 쓰기 면 비움 + **보기 항등** + 토스트 "전송됨 ✓"(1.8초, 아래 가운데) · 실패 → 획 보존 + 토스트 "전송 실패 — 다시 보내 주세요". 전송 중 완료 비활성·"보내는 중…" ⚠ `/ink`는 `lib/ocr.ts`·`lib/storage.ts` import 금지 |
| D8 | **상태 칸**: `ink_state/presence` `onSnapshot` + **10초 재판정** → `presenceStatus(p, nowMs)`: `ok` → 점 `--accent-success` + "데스크톱 편집창 → {label}" · `blocked` → 점 `--mathory-red` + "데스크톱에서 텍스트 블록을 선택해 주세요"(`collapsed`면 "접힌 블록을 펼쳐 주세요") · `none`·`stale` → 점 `--text-muted` + "데스크톱 편집창이 열려 있지 않습니다 — 보내 두면 열 때 나타납니다"(K2 — 색 팔레트 규약). 넘치면 말줄임. **좁을 때**(상단 바 폭 < 640 — Split View 등) 버튼 라벨·상태 문구를 숨기고 점·아이콘만: `ResizeObserver`로 판정(K3 — `@media` 금지). 쓰기는 막지 않는다. 대기 건수(`ready` 구독)가 1 이상이면 " · 확인 대기 n건" |

### B. 데스크톱 — presence·수신·확인

| # | 결정 |
|---|---|
| D9 | **presence**(`EditorView` effect + `lib/inkJobs.writePresence/clearPresence`): `{ canInsert, reason?, label?, updatedAt: serverTimestamp() }`. `canInsert` = 활성 블록 있음 ∧ `TEXT_BASED_TYPES.has(type)` ∧ `!collapsed` ∧ `editorRefs.current[id]` 마운트 · `reason ∈ 'no-block'|'not-text'|'collapsed'` · `label` = `{editTitle || '제목 없음'} · {탭 라벨} · 블록 {n}`. 쓰는 때: ① 입력 변경(1초 디바운스) ② heartbeat 45초 ③ `visibilitychange` → visible 즉시 ④ 언마운트·`pagehide`에서 `deleteDoc`(best-effort) |
| D10 | **수신**(`components/editor/InkInbox.tsx`): `onSnapshot(query(ink_jobs, where('status','==','ready')))` · orderBy 없음 · 클라 정렬 `createdAt` 오름차순 · 큐 머리 하나만 카드로, "1/N" · `viewing` 상태 없음 · 같은 마운트 재표시는 로컬 `handledIds` |
| D11 | 편집창이 닫혀 있을 때 온 job은 `ready`로 대기 → 다음 편집창 마운트 때. ProblemView·FolderView에서는 받지 않는다 |
| D12 | **확인 카드**(하단 도킹 비모달): `createPortal(…, document.body)` · 루트 `data-ink-card` · `position:fixed; bottom:16px; left:0; right:0; margin:0 auto; width:min(1100px, calc(100vw - 32px)); max-height:45vh` · **transform 금지** · z **10300** · 딤 없음 · `dialogBody`·`dialogHead`·`dialogFoot`. 본문 3단 grid `1fr 1fr 1.2fr`: 좌 원본 PNG(`object-fit:contain`, 클릭 → 새 탭) · 중 `EditorPreview content={편집본} borderless autoHeight` · 우 `LatexInputEditor key={job.id} initialValue={초깃값} onChange onSubmit={확인} fontSize 14 minHeight 120`. 초깃값 = `normalizeAndFix(composeInkText(job))`. OCR 실패면 빈 편집창 + 띠 "인식 실패 — 직접 입력하거나 취소". 하단: 신뢰도 % · 삽입 위치(또는 확인 불가 사유) · 취소 · 확인. **포커스를 가져가지 않는다**(P19). Esc는 아무것도 버리지 않는다 |
| D12′ | **단축키 관통 차단**: `EditorView` window keydown 핸들러 **맨 앞** `if ((e.target as Element | null)?.closest?.('[data-ink-card]')) return;` |
| D13 | **확인**: ① `getTarget()` 재확인(아니면 확인 비활성 + 사유) ② 선택이 비었으면 `ctx = { prev, next }` · `inMath = probeInsertionRegion(doc, pos).region !== null` ③ `text = shapeInkPayload(편집본, ctx)` ④ `insertPlainText(text)` ⑤ `updateDoc(job, { status:'inserted', problemId, tabId, blockId, finalText, insertedAt })` — 실패해도 `handledIds`에 남기고 `alertDialog`. 순서는 삽입 먼저. **취소**: `confirmDialog({ message: '이 필기를 버릴까요? 원본 이미지도 함께 지워집니다.', danger: true, confirmLabel: '버리기' })`(K1) → 문서 + Storage 2파일 삭제(best-effort). 다음 `ready`가 있으면 이어서 |

### C. 첨부 보관

| # | 결정 |
|---|---|
| D14 | **첨부 = `inserted` job**(`problemId`로 연결). Row 2 항목 `inkAttachments`(`blockScoped` 아님, `pasteBlocks` 뒤) · 아이콘 `scribble`(ICONS 63) · 배지 없음 · 툴팁 "필기 첨부". 클릭 → `InkAttachmentsDialog` — **인라인 렌더 · z 9000**(K8 — SheetImport·BatchVerify 선례. 그 안에서 여는 `confirmDialog`(10500)가 DOM 순서와 무관하게 위에 뜬다) · `dialogBody` 폭 720: 열 때 `where('problemId','==',problemId)` 1회 조회 + 클라 필터 `status=='inserted'` · `insertedAt` 내림차순 · 카드 그리드(썸네일 · 시각 · `finalText` 렌더) · 클릭 → 크게(원본 PNG + `finalText` 렌더 + "탭 · 블록 n에 삽입") · 삭제 = `confirmDialog({ message: '…본문에 이미 들어간 LaTeX는 그대로 남습니다.', danger: true, confirmLabel: '삭제' })` → 문서 + Storage 2파일. 0건이면 "이 문항에 보관된 필기가 없습니다" |

### D. 문서·하니스

| # | 결정 |
|---|---|
| D15 | **문서**: `lib/firebase.ts:18-21` 주석 정정 · CLAUDE.md 「핵심 패턴」에 「iPad 필기 입력은 AppShell 밖이다 (Phase 69)」 절(claim·release 금지 · `ink_jobs`가 `users/` 밑인 이유 · presence 판정은 데스크톱 · 45/150초 · 카드 transform 금지·z 10300·`[data-ink-card]` 가드 · `composeInkText`·`shapeInkPayload` · `lib/ink/` 순수 / `lib/inkJobs.ts` firestore · 팝업만 · **줌은 보기 변환 하나·캔버스는 화면 크기·손바닥 규칙 상수** · 캔버스 KaTeX 글꼴은 `document.fonts.load` 뒤) · 「파일 구조」·「DB 구조」 · O2(「파일 구조」의 `EditorView — … 3점 메뉴 PDF` 낡음) 정정 |
| D16 | **하니스**: 순수 `test:ink` + 임시 라우트 `app/dev69`(Firestore 미접촉) + headless Chrome CDP · **`http://localhost`**(`getCoalescedEvents`는 보안 컨텍스트 전용) · 두 손가락은 `Input.dispatchTouchEvent`(touchPoints 2개, 필요하면 `Emulation.setTouchEmulationEnabled`) · 임시 라우트는 dev 종료 뒤 삭제 |

---

## 3. 데이터 모델 (v3 그대로 — 줌은 데이터에 흔적이 없다)

```
Firestore
└── users/{uid}
    ├── ink_state/presence
    │   { canInsert: boolean, reason?: 'no-block'|'not-text'|'collapsed', label?: string, updatedAt: Timestamp }
    └── ink_jobs/{jobId}
        { status: 'ready'|'inserted',
          ocrText: string, ocrLatex?: string, confidence?: number, isHandwritten?: boolean, ocrError?: string,
          imagePath: 'ink/{uid}/{jobId}.png', imageUrl, strokesPath: 'ink/{uid}/{jobId}.json',
          createdAt,
          problemId?, tabId?, blockId?, finalText?, insertedAt? }       ← inserted 때만

Storage
└── ink/{uid}/{jobId}.png      흰 배경 PNG (긴 변 ≤ 2000, data URL ≤ 1.9MB)
    ink/{uid}/{jobId}.json     { v: 1, cssW, cssH, dpr, strokeWidth, strokes: { x: number[][], y: number[][] }, t: number[][] }
```

- 상태 둘 · 취소 = 삭제 · 문항 스키마 0 · 복합 인덱스 0
- 획 좌표는 **종이 좌표**(쓰기 면 CSS px, 확대 1배 기준) — 확대 중에 쓴 획도 같은 좌표계라 JSON·PNG에 보기 변환 흔적이 없다
- `imageUrl`은 토큰 URL — 보호 수준은 `problems/` 이미지와 같다

---

## 4. 보안 규칙 (v3 그대로)

```
// firestore.rules — users/{userId} 안, ask_questions 아래
match /ink_state/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
match /ink_jobs/{jobId} {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

```
// storage.rules — problems 매치 뒤, 기본 차단 앞
match /ink/{uid}/{fileName} {
  allow read: if request.auth != null && request.auth.uid == uid;
  allow create, update: if request.auth != null && request.auth.uid == uid
    && request.resource.size < 5 * 1024 * 1024
    && (request.resource.contentType == 'image/png'
        || request.resource.contentType == 'application/json');
  allow delete: if request.auth != null && request.auth.uid == uid;   // ⚠ create/update와 분리(61e)
}
```

- Firestore `test:rules` +4 → **73** · Storage는 콘솔 Rules Playground 4건 + 실물 취소·첨부 삭제 경로
- ⚠ **규칙 배포는 덕수**(`firebase deploy --only firestore:rules,storage`) — dev 서버도 실프로젝트를 쓰므로 배포 전에는 로컬 실동작도 전부 거부된다

---

## 5. 구현 사양

### 5-1. 신규

| 파일 | 역할 |
|---|---|
| `app/ink/page.tsx` | 서버 컴포넌트 — `metadata` · `viewport` · `<InkPad />` |
| `components/ink/InkPad.tsx` | D2·D3·D6~D8 — 로그인 게이트 · 상단 바(워드마크·상태 칸·확대 %·버튼·계정 팝오버) · 토스트 · 전송 · 좁은 폭 판정(ResizeObserver) |
| `components/ink/InkCanvas.tsx` | D4·D5·D5′ — 격자 캔버스(보조선·구분선·예시) + 획 캔버스 · 펜·touch 포인터 배선 · 보기 변환 · rAF 다시 그리기 · 되돌리기 스택 · `exportPng`. 핸들 `{ undo, clear, resetView, exportPng, getStrokes, isEmpty }` + 콜백 `onChange({ strokes, canUndo, view })` |
| `lib/ink/strokes.ts` (순수 · import 0) | `Stroke` · `strokeBounds` · `exportPlan(bounds, { pad: 24, strokeWidth, maxDim: 2000, maxScale: 2 })` · `toMathpixStrokes` · `GUIDE` 상수(`{ rows: 5, lines: [0.34, 0.68], dash: [1.5, 5], alpha: 0.28, sepAlpha: 0.07, inset: 16 }`) · `exampleLayout(yU, yB, measure)` → 그리기 명령 목록(글자·크기·글꼴·x·y + 분수선) — **글자 폭은 주입받는다**(K6 — `measureText`는 브라우저 전용) |
| `lib/ink/view.ts` (순수 · import 0) — **신설** | `View = { s, tx, ty }` · `IDENTITY` · 상수 `ZOOM_MIN 1` · `ZOOM_MAX 3` · `PAIR_WINDOW_MS 250` · `PEN_COOLDOWN_MS 300` · `SLOP_PX 6` · `toPaper(v, x, y)` · `clampView(v, W, H)` · `pinchView(v0, a0, b0, a1, b1, W, H)` · `beyondSlop(a0, b0, a1, b1)` · `canStartPinch({ downA, downB, penActive, lastPenUpAt })` · `isZoomed(v)` |
| `lib/ink/payload.ts` (순수 · import 0) | `composeInkText({ ocrLatex, ocrText })` · `shapeInkPayload(text, { prev?, next?, inMath })` |
| `lib/ink/presence.ts` (순수 · import 0) | `PRESENCE_HEARTBEAT_MS 45_000` · `PRESENCE_STALE_MS 150_000` · `PRESENCE_RECHECK_MS 10_000` · `presenceStatus(p, nowMs)` |
| `lib/inkJobs.ts` (firestore·storage) | `sendInkJob` · `subscribeReadyJobs` · `markInserted` · `discardJob` · `listAttachments` · `deleteAttachment` · `writePresence` · `clearPresence` · `subscribePresence`. ⚠ `lib/ink/`에 두지 말 것 · `lib/ocr.ts`·`lib/storage.ts` import 금지 |
| `components/editor/InkInbox.tsx` | D10·D12·D13 — props `uid` · `getTarget(): InkTarget | null` |
| `components/editor/InkAttachmentsDialog.tsx` | D14 |
| `tests/ink.test.mjs` | §11-1 |

### 5-2. 수정

| 파일 | 변경 |
|---|---|
| `app/api/ocr/route.ts` | **opt-in**(K10): `body.withLatex === true`일 때만 `formats: ['text', 'latex_styled']`, 응답에 `latex: data.latex_styled` · `isHandwritten: data.is_handwritten`. 아니면 요청·응답 바이트 불변(기존 두 소비자) |
| `EditorView.tsx` | ① presence effect ② `getTarget` ③ `<InkInbox …/>` ④ window keydown 첫 줄 가드(D12′) ⑤ 툴바 prop `onOpenInkAttachments` + `<InkAttachmentsDialog>` |
| `UnifiedToolbar.tsx` | `InkAttachmentsIcon`(`PH.scribble`, `ICON_SIZE`) · prop · `rightItems`에 `inkAttachments`를 `pasteBlocks` 뒤 |
| `scripts/gen-phosphor-paths.mjs` | ICONS에 `scribble: ['scribble', 'regular'],` → `npm run icons:gen` → 63종 |
| `firestore.rules` · `storage.rules` · `tests/firestore.rules.test.mjs` | §4 |
| `lib/firebase.ts` | 주석만 |
| `package.json` | `"test:ink": "tsc lib/ink/strokes.ts lib/ink/view.ts lib/ink/payload.ts lib/ink/presence.ts --outDir .test-build --rootDir . --module commonjs --target es2022 --moduleResolution node --skipLibCheck && node --test tests/ink.test.mjs"` |
| `CLAUDE.md` · `docs/roadmap.md` | D15 |

### 5-3. 텍스트 규칙 (v3 그대로)

**① `composeInkText({ ocrLatex, ocrText })`**: `ocrLatex`(trim)가 있으면 — `\\` 또는 `\begin{`이 있으면 `$$\n{latex}\n$$`, 아니면 `${latex}$` / 없으면 `ocrText` 그대로 / 둘 다 비면 `''`. 데스크톱은 이 결과를 `normalizeAndFix`에 넣어 카드 초깃값으로 쓴다.

**② `shapeInkPayload(text, { prev?, next?, inMath })`**: trim 후 ① 빈 문자열 → `''` ② `inMath` ∧ 수식 하나뿐(인라인 `^\$[^$\n]+\$$` 또는 펜스형 `^\$\$\n[\s\S]*\n\$\$$`) → 구분자를 벗긴 안쪽만 / 수식이 아니거나 둘 이상 → 그대로 + 카드 경고 ③ 밖 · 한 줄 인라인 하나 → 그대로 + `prev`가 `/[\p{L}\p{N}$]/u`이면 앞 공백 1 · `next`가 `$`이면 뒤 공백 1 ④ 그 밖 → `\n…\n`. `prev`·`next`는 선택이 비었을 때만.

### 5-4. 캔버스 치수 (확정 — 참고값)

11인치 iPad 가로 1194×834 CSS px 기준 상단 바 48 → 쓰기 면 786 → 줄 높이 157.2 · 보조선 53.4 / 106.9. 세로 1194 → 줄 높이 229.2. ⚠ Safari 탭 막대가 뷰포트를 줄이므로 실제 값은 이보다 작다 — 계산은 늘 `쓰기 면 실측 높이 / 5`. 배경 버퍼 = 쓰기 면 × `min(3, devicePixelRatio)`(샘플 그대로).

### 5-5. 예시 수식 배치 (샘플 `drawExample` 그대로 — `exampleLayout`)

띠 `bh = yB − yU` · `F = bh / 0.72` · `yM = (yU + yB)/2` · 마지막 줄의 `yU`·`yB`. 글꼴 `italic {s}px KaTeX_Math, "Times New Roman", serif`(변수·`d`) · `{s}px KaTeX_Main, serif`(숫자) · `{s}px KaTeX_Size2, serif`(∫).

| 요소 | 크기 | x(진행 커서 `x` 기준) | 기준선 y |
|---|---|---|---|
| ∫ | `iS = 2.2·bh / 2.222` | `0` · 폭 `iW` | `yM − 1.1·bh + 1.36·iS` |
| b | `sF = 0.62F` | `iW + 0.444·iS` | `yM − 1.1·bh + 0.72·sF` |
| a | `sF` | `iW + 0.02·iS` | `yM + 1.1·bh + 0.02·sF` |
| — | | `x += max(b끝, a끝) + 0.22F` | |
| 4 / 3 | `nF = 0.8F` | 폭 `fw = max(w4, w3) + 0.24F`, 각자 가운데 | 4: `yM − 0.13F` · 3: `yM + 0.13F + 0.68·nF` · 가로줄 `yM`, 굵기 `max(1, 0.03F)` |
| — | | `x += fw + 0.12F` | |
| x | `F` | `x` · `x += w` | `yB` |
| 2 | `sF` | `x + 0.02F` · `x += w2 + 0.08F` | `yU + 0.2·bh` |
| d · x | `F` | 차례로 | `yB` |

시작 x = `max(16, W − 32 − 전체 폭)` · 색 `--text-primary` 20%(텍스트·분수선) · `textBaseline 'alphabetic'`. 그리기 전에 `document.fonts.load('italic 40px KaTeX_Math')` · `('40px KaTeX_Main')` · `('40px KaTeX_Size2', '∫')`를 기다리고 끝나면 다시 그린다.

---

## 6. 흐름

```
iPad /ink                                     Firestore / Storage                       데스크톱 EditorView + InkInbox
────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
(상주) presence 구독 + 10초 재판정 ─────────── users/{uid}/ink_state/presence ◀──── 입력 변경(1s) · 45s · visible
상단 바 상태 칸: ● → 문항 · 탭 · 블록 n
펜으로 필기 · 두 손가락으로 확대·이동(첨자) · [150%] 버튼으로 원래대로
[완료] ┬ PNG 업로드 → getDownloadURL ─────── ink/{uid}/{jobId}.png
       ├ 획 JSON 업로드 ────────────────────── ink/{uid}/{jobId}.json
       └ /api/ocr {withLatex} ── Mathpix /v3/text (text + latex_styled)
       → setDoc ink_jobs/{jobId} status:ready ▶ ──────────────────────────────────────▶ onSnapshot(ready) → 카드(하단 도킹 · 포커스 유지)
"전송됨 ✓" · 쓰기 면 비움 · 보기 1배 (실패면 보존)                                    좌 PNG · 중 렌더 · 우 편집(normalizeAndFix(composeInkText))
"· 확인 대기 n건" ◀─────────────────────────── ready 구독                               [확인] shapeInkPayload → insertPlainText → inserted
                                                                                       [취소] confirm → 문서·파일 삭제
                                                                                       Row 2 [필기 첨부] → inserted 목록 · 크게 · 삭제
```

---

## 7. 위험

| # | 위험 | 대응 |
|---|---|---|
| R1 | standalone(홈 화면 추가) 모드 | Safari 탭 고정 · 범위 밖 |
| R2 | 팝업 차단 | 버튼 클릭 직후 · 폰 셸 실적 · 실패 시 사유 표시 |
| R3 | 백그라운드 탭 회수 → 리로드 | 로그인 유지 · 전송 전 획은 사라짐(수용) |
| R4 | Mathpix 오인식·422 | job은 만든다 → 카드에서 수정 · 원본 · 신뢰도 · 획 JSON(후속 재인식) |
| R5 | `/api/ocr` 무인증 | 기존 소비자와 같은 성질 · 범위 밖 |
| R6 | 카드가 떠 있는 동안 다른 블록 클릭 | 의도(비모달) · 삽입 위치가 실시간으로 따라간다 |
| R7 | kick 직전 두 탭이 같은 job 표시 | 1초 미만 창 · 수용 |
| R8 | 문항 삭제 뒤 첨부 고아 | 현행 `problems/` 이미지와 같은 성질 |
| R9 | 숨김 탭 heartbeat 지연 | 45초 · 150초 · visible 즉시 · 오판은 안내 문구에만 |
| R10 | Pencil 호버 `buttons 0` | `buttons & 1`인 동안만 |
| R11 | 보조선·예시가 PNG에 섞임 | 별도 캔버스 · 하니스가 PNG 픽셀 확인 |
| R12 | presence 쓰기 비용 | 하루 ≈ 1,900 writes · 공개 전 재검토 |
| R13 | 카드 안 ⌘B·⌘J | D12′ 가드 |
| R14 | 카드 등장 시 블록에서 한글 조합 중 | 포커스를 가져가지 않는다 |
| R15 | PNG data URL > 2MB | 1.9MB 가드 · 1400 재내보내기 |
| R16 | 루트를 열어 둔 Safari → `/ink` 연쇄 로그아웃 | 운용 규약 · 실물 1회 확인 |
| R17 | KaTeX 글꼴 지연 | `document.fonts.load` 대기 + 다시 그리기 |
| R18 | ＋ **쓰는 손 손바닥 + 다른 손 손가락이 핀치로 잡힘** | D5′ ⓑ 착지 시각 차 250ms · ⓒ 펜 뗀 뒤 300ms · ⓐ 펜 우선 · ⓓ 6px 문턱. 상수 넷은 `lib/ink/view.ts` 한 곳 — 실물에서 조율(§11-3) |
| R19 | ＋ 확대 중 화면 밖으로 나간 자리에 쓰고 싶다 | 두 손가락 이동(같은 제스처) · `{배율}%` 버튼으로 한 번에 1배 |
| R20 | ＋ 확대가 다시 그리기 비용을 키운다 | 다시 그리기 = 화면 크기 캔버스 2장 지우고 그리기(획 수백·점 수천 · 글자 9개) — rAF당 1회로 묶는다. 캔버스는 화면 크기 그대로(D5′ ⑦) |

---

## 8. 범위 밖

standalone 모드 · 네이티브 앱 · Continuity Sketch · MyScript · `/v3/strokes` 라우트(P17 (a)) · 실시간 획 인식 · 지우개·더블탭·영역 선택 · **필기감 개선**(필압 굵기 · 획 스무딩 · `getPredictedEvents` 예측 그리기 — 덕수 "차차 개선") · 텍스트 차단 · 댓글·agent 입력창 수신 · ProblemView 수신·첨부 열람 · `/api/ocr` 인증 · 필기를 그림 블록으로 · 폰 화면 · 다중 사용자 · RTDB presence · 관성 스크롤·두 손가락 두 번 탭 리셋 · Row 2 "iPad 연결됨"·QR · 첨부 배지 · 패드 설정 화면

**관찰(prelaunch 후보 여부 덕수 판단)**: O1 EditorView 안의 댓글·agent 입력창에서도 ⌘B 등이 활성 블록에 작용할 것으로 읽힌다 — D12′와 같은 가드 한 줄로 닫을 수 있다(실행 확인 안 함) · O2 CLAUDE.md 「파일 구조」 낡은 서술(D15에서 정정)

---

## 9. 덕수 판정 — 착수값

| # | 질문 | 착수값 |
|---|---|---|
| P1 | 번호 | 69 |
| P2 | 로그인 | Safari 탭 + 팝업만 |
| P3 | 변환 위치 | iPad가 즉시 호출 · 원문 저장 · 정규화는 데스크톱 |
| P4 | 입력 | Pencil + 숨은 `?input=mouse` |
| P5 | 도구 | 되돌리기(모두 지우기 포함)·모두 지우기 |
| P6 | 보조선 | **확정** 2개 · 34·68% · 점선 · 28% |
| P7 | 획 JSON | Mathpix strokes 형식으로 저장 |
| P8 | 카드 | 하단 도킹 비모달 |
| P9 | 편집창 닫힘 | `ready` 대기 |
| P10 | 취소 | 확인창 → 문서·파일 삭제 |
| P11 | 삽입 모양 | `latex_styled` 기반(권장 착수 — "바로 구현") |
| P14 | presence | 45초 · 150초 |
| P15 | 신뢰도 | 카드 하단 % |
| P16 | 하니스 | 순수 + 임시 라우트 CDP(localhost) + 실물 |
| P17 | 인식 엔드포인트 | `/v3/text` + 획 JSON(권장 착수) |
| P18 | 첨부 UI | **확정** 69에 포함 |
| P19 | 카드 포커스 | 가져가지 않는다(권장 착수) |
| P20 | 수식 안 커서 | 구분자 벗김 |
| P21 | 삽입 위치 표시 | presence `label` |
| P22 | Storage 규칙 검증 | 콘솔 Playground + 실물 경로 |
| **P23** | 두 손가락 확대 | **확정 (b)** — 1~3배 · 손바닥 규칙 상수 4개는 실물 조율(D5′) |
| P24 | 첨부 아이콘 | `scribble`(권장 착수) |
| **P25** | ＋ `/api/ocr` 변경 방식 | **opt-in `withLatex`**(K10) — v3의 "항상 `latex_styled`"는 기존 두 소비자의 요청까지 바꾼다 |

---

## 10. 작업 순서

| Stage | 내용 | 완료 조건 |
|---|---|---|
| S1 | 규칙 + 규칙 테스트 +4 · 커밋 → **덕수 배포** | `test:rules` 73 |
| S2 | `lib/ink/{strokes,view,payload,presence}.ts` + `tests/ink.test.mjs` + `test:ink` | §11-1 |
| S3 | `/api/ocr` opt-in + `/ink` + `InkPad`·`InkCanvas`(줌 포함) + `lib/inkJobs.sendInkJob` | 하니스 ①~⑥ · 덕수 배포 뒤 데스크톱 `?input=mouse` 두 탭 왕복으로 Storage 2파일 + job |
| S4 | EditorView presence + 상태 칸·재판정·대기 건수 | 편집창 열기·닫기·접기·그림 블록에 따라 상태 칸이 바뀐다 |
| S5 | `InkInbox` + D12′ | 하니스 ⑦~⑫ |
| S6 | `InkAttachmentsDialog` + Row 2 + `scribble` · `icons:gen` | 목록 · 크게 · 삭제 |
| S7 | 문서(D15) · roadmap · phasedocs 확정본 · `npm run build` | `[icons:check] OK — 63종` |
| S8 | 덕수 실물 §11-3 | 손바닥 규칙 상수 조율 포함 |

(하니스는 S3·S5에서 각 단계 직후에 돌린다 — v3의 독립 S7을 앞으로 당겼다)

---

## 11. 검증

### 11-1. 자동 (`test:ink`)

- `composeInkText` · `shapeInkPayload` · `presenceStatus`: v3 §11-1 표본 전부
- `strokeBounds`·`exportPlan`: 최소 사각형 + 24 + 획 굵기 · 축척 = min(2, 2000/긴 변) · `maxDim 1400` 재계획 · 빈 획 → null · `toMathpixStrokes` 순서·길이 보존·소수 1자리(§13 I1)
- `exampleLayout`(가짜 `measure` 주입): 본문 글자 기준선 = `yB` · b·² 기준선 < `yB`이고 b는 `yU` 위쪽 · a 기준선 > `yB` · 분수선 = `yM` · x 좌표 단조 증가(∫ < b < 4 < x < 2 < d < x) · 시작 x ≥ 16
- **`view`**: `toPaper` 항등·역변환 왕복 · `clampView` — s 상하한 · 1배에서 이동 0 · 2배에서 tx ∈ [−W, 0] · `pinchView` — 두 점이 2배로 벌어지면 s 2배 · 중점 아래 종이 점이 중점을 따라간다(오차 < 1e-6) · 3배 상한에서 멈춤 · 1배 아래로 안 줄어듦 · 두 점 평행 이동 = 이동만(확대 중) · `canStartPinch` — 착지 차 249ms 참 / 251ms 거짓 · 펜 진행 중 거짓 · 펜 뗀 뒤 299ms 거짓 / 301ms 참 · `beyondSlop` 5px 거짓 / 7px 참
- 무회귀: `test:rules` 73 · `test:ocr` · `test:mathregions` · tsc

### 11-2. 하니스 (`app/dev69` + headless Chrome CDP — localhost, Firestore 미접촉)

① CDP `pointerType:'pen'` 드래그 → 획 · `dispatchTouchEvent` 한 점 → 획 0·보기 그대로 · `pointerType:'mouse'` → `?input=mouse`일 때만 ② **두 점 touch 벌리기 → 보기 s ≈ 2 · 상단 바에 `200%`** ③ **확대 중 펜 획 → 저장 좌표 = `toPaper` 역변환 값**(같은 종이 위치에 1배로 그린 획과 PNG가 같다) ④ 두 점 착지 차 400ms → 제스처 안 됨 · 펜 획 진행 중 두 점 → 무시 ⑤ `200%` 버튼 → 1배 ⑥ 내보낸 PNG — 보조선·예시 색 픽셀 0 · 흰 배경 · 긴 변 ≤ 2000 · data URL ≤ 1.9MB · 모두 지우기 → 되돌리기 복원 · `document.fonts.check('italic 40px KaTeX_Math')` 참 ⑦ 가짜 job → 카드 하단 · `activeElement`가 블록 CM 그대로 · z 10300 ⑧ 카드 편집창 포커스 후 ⌘B → 분할 안 됨 · ⌘Enter → 확인 ⑨ 확인 → 커서 자리 · ⌘Z 1회 복원 · 선택 대체 ⑩ 커서 `$a + |$` → 구분자 벗김 ⑪ 접힌 블록 → 확인 비활성 + 사유 ⑫ 카드 안 자동완성 툴팁이 편집창 옆에

### 11-3. 실물 (덕수 — iPad Safari + Mac Chrome, 이어서 Windows Chrome)

1. iPad Safari `mathory.app/ink` → 팝업 로그인 → 데스크톱 로그인 유지
2. 화면이 확정 샘플과 같다(상단 바 · 5줄 · 보조선 2개 · 예시 수식)
3. **핀치 줌** — ⓐ 두 손가락 확대·축소·이동이 부드럽다 ⓑ 확대해 첨자를 쓰고 1배로 돌아오면 제자리·제 크기 ⓒ **손바닥을 대고 쓰다가** 다른 손으로 핀치 → 잘 되는지 / 쓰는 중 화면이 멋대로 확대되지 않는지 ⓓ 쓰고 바로 핀치(300ms 규칙이 거슬리는지) ⓔ 한 손가락은 아무것도 안 한다 ⓕ `{배율}%` 버튼 — 조율이 필요하면 상수 넷(250 · 300 · 6 · 3배) 중 무엇을 어떻게
4. 데스크톱 편집창 닫힘·텍스트·그림·접힌 블록 → 상태 칸 점·문구(10초 안)
5. `\frac`·첨자·근호 섞인 식 → 완료 → 카드까지 체감(목표 2~4초) · 인식 품질 · 신뢰도 · 단일 식이 인라인 `$…$`로
6. 확인 → 커서 자리 · 인라인/블록 · ⌘Z 1회
7. 데스크톱에서 한글을 치는 도중 iPad 전송 → 조합이 깨지지 않는다
8. 스크롤·페이지 확대·텍스트 선택·돋보기 없음 · 회전 → 획 유지, 1배로
9. 화면 꺼짐 5분 뒤 → 복귀 · 재로그인 없음
10. 취소 · 첨부 삭제 → 콘솔에서 png·json 삭제 · 첨부 삭제 뒤 본문 LaTeX 그대로
11. 데스크톱 탭을 숨긴 채 10분 → 상태 칸이 바뀌지 않는다
12. A9 1회 · Windows Chrome에서 5~7 반복

---

## 12. 커밋 지침

- Stage별 1커밋 `feat(phase69):` / `fix(phase69):` / `docs(phase69):` · CLI는 커밋까지, **push와 규칙 배포는 덕수**
- 착수 HEAD `9976d3d` · `phosphorPaths.ts`는 생성물(수동 편집 금지) · `app/dev69`는 커밋하지 않는다(dev 종료 뒤 삭제)
- dev 서버가 도는 동안 `npm run build` 금지(CLAUDE.md 작업 규칙 5)

---

## 부록 A. 외부 사실 (v3 H1~H7 유지 + v4 재확인)

| # | 사실 | 근거 |
|---|---|---|
| H1 | `latex_styled` = 이미지 전체가 식 하나일 때만 · base64 2MB · JSON 5MB · `is_handwritten` · 사용자 정의 매크로 가능(v4 재확인 — 문서 원문) | docs.mathpix.com *post-v3-text* · *math-commands* |
| H2 | 리디렉트는 Safari 16.1+ 등에서 해결책 필요 · 팝업은 Option 2 | Firebase *redirect-best-practices* |
| H3 | 탭 간 로그아웃 전파는 문서 명시 없음 → 실물 확인 | Firebase *auth-state-persistence* |
| H4 | `getCoalescedEvents`는 보안 컨텍스트 전용 → 기능 탐지 | MDN |
| H5 | CDP `pointerType:'pen'`·`dispatchTouchEvent`가 페이지에 pen·touch로 도착(headless Chromium 141 실측) | v3 web 실측 |
| H6 | Chrome 숨김 탭 타이머 분당 1회(조건 넷) | Chrome *timer-throttling-in-chrome-88* |
| H7 | 첨부 보관은 원 구상 (6) | 2026-10-10 대화 |
| H8 | ＋ 샘플 원본(`drawExample` · `exportPng` · 입력 배선)이 v3 §5-5·D5·D7과 일치 — 차이는 K5·K6·K12·토큰 값(§1-D) | 샘플 HTML |

## 부록 B. v3 점검 정정 (K1~K12)

| # | v3 | v4 | 근거 |
|---|---|---|---|
| K1 | `confirmDialog('이 필기를 버릴까요?')` 문자열 인자(D13·D14) | `confirmDialog({ message, danger: true, confirmLabel })` 객체 | `lib/dialogs.ts:16-23·106` |
| K2 | 상태 점 "초록 · 주황 · 회색" | `--accent-success`(올리브) · `--mathory-red` · `--text-muted` | CLAUDE.md 색 팔레트 규약(파랑·초록·노랑을 새로 들이지 않는다 · 성공만 올리브 · 경고 = `--mathory-red`) |
| K3 | "폭 600px 이하에서는 점만"(샘플은 `@media (max-width:600px)`) | `ResizeObserver`로 상단 바 폭 < 640일 때 라벨·문구 숨김 | CLAUDE.md "판별용 `@media` 금지" · iPad 폭은 600보다 크지만 Split View에서 좁아진다 |
| K4 | 획 색 `--text-primary`(샘플 `#1F1B17`) · 토큰 값을 샘플에서 옮김 | 앱 토큰을 `getComputedStyle`로 읽어 캔버스에 | 캔버스는 `var()`를 못 받는다 · 샘플 토큰은 앱과 몇 값이 다르다(§1-D) |
| K5 | 내보내기 축척 "DPR 축척" | `min(2, 2000/긴 변)` · bounds에 획 굵기 포함 | 샘플 `exportPng` — 기기 DPR과 무관해야 iPad 기종마다 같은 이미지 |
| K6 | `exampleLayout(yU, yB)`를 "그리기와 분리해 테스트" | `exampleLayout(yU, yB, measure)` — 글자 폭 주입 | 배치가 `measureText` 폭에 의존(샘플) — 순수 모듈은 브라우저 API를 못 쓴다 |
| K7 | §5-5 표의 `2` 다음 간격 "² 끝 + 0.06F" | 진행 `x += w2 + 0.08F`(그리기 시작이 `+0.02F`라 ² 끝 뒤 0.06F와 같다) | 샘플 `:246` — 값은 같고 표기만 진행 커서 기준으로 통일 |
| K8 | `InkAttachmentsDialog` z 미지정(`dialogStyles` 규격 → `dialogOverlay` 10500) | 인라인 렌더 · z 9000 | 그 안의 `confirmDialog`(10500)와 같은 z면 위아래가 DOM 순서에 맡겨진다(포털이면 다이얼로그가 confirm을 덮는다) · SheetImport·BatchVerify 선례 9000 |
| K9 | v3 §5-1 "신규 11"(나열은 10) | 줌 모듈 신설로 실제 12(임시 라우트 제외) | 산술 |
| K10 | `/api/ocr` `formats: ['text','latex_styled']` 항상 | `withLatex: true`일 때만 | 기존 두 소비자의 요청 바이트 불변(61f D10과 같은 원칙) · Mathpix 문서에 형식 추가의 과금·처리 시간 언급이 없다 |
| K11 | `LatexInputEditor initialValue` 큐 다음 job | `key={job.id}`로 재마운트 | `initialValue`는 마운트 때만 읽는다 · `setValue`는 자리 상태(`setSlots`) 함정이 있다 |
| K12 | 가운데 안내 "손가락·손바닥은 무시됩니다" · P23 (a) | "두 손가락으로 확대·이동 · 손바닥은 무시됩니다" · P23 (b) | 덕수 확정 |

v3의 나머지(A1~E8 실측 · D1~D16 · F1~F12)는 재확인으로 성립 — 위 정정만 반영했다.

## 부록 C. 핀치 줌 — 시스템 부담 점검

| 항목 | 결과 |
|---|---|
| 서버·네트워크 | **0** — iPad 화면 안의 보기 변환일 뿐, 요청·Firestore·Storage가 늘지 않는다 |
| 데이터 | **0** — 획은 종이 좌표로 저장(v2 E12 · v3 D5 자리 셋이 이를 위해 남겨 둔 것). PNG·획 JSON·OCR·데스크톱 카드·첨부 무변경 |
| 의존성 | **0** — 포인터 이벤트 + 캔버스 `setTransform` |
| 메모리 | 캔버스 2장을 **화면 크기 그대로**(쓰기 면 × DPR) — 확대를 큰 버퍼로 만들지 않아 iOS 캔버스 면적 상한(약 1,678만 px)과 무관 |
| 그리기 비용 | 제스처 프레임마다 캔버스 2장 다시 그리기 — 5줄 수식 분량(획 수백 · 점 수천)과 격자·글자 9개. rAF당 1회로 묶는다. 펜 입력 중에는 보기가 안 바뀌므로 쓰기 성능은 지금과 같다 |
| 코드 | 순수 `lib/ink/view.ts` 약 100행(테스트 대상) + `InkCanvas` 배선 약 120행 |
| 남는 위험 | 손바닥 오작동(R18) — 규칙 넷 + 펜 우선. **상수 네 개를 실물에서 조율**하는 것이 유일한 숙제 |

결론: 부담 없음 — P23 (b) 착수.


---

## 13. 구현 기록 (2026-10-10 · CLI)

커밋: `9230635` S1 규칙 · `57ebb48` S2 순수 모듈 · `0c4069b` S3 `/ink`·캔버스·`/api/ocr` · `9715f33` S4~S6 데스크톱(presence·카드·가드·첨부·아이콘) · S7 문서·빌드.
검증: `test:rules` **73/73**(JDK 21 — 시스템 java 8이라 `JAVA_HOME=/opt/homebrew/opt/openjdk@21`) · `test:ink` **21** · tsc 무오류 · headless CDP 캔버스 **18/18** · 카드 **22/22** · `/`·`/ink` 콘솔 오류 0 · 프로덕션 빌드.

### 13-1. 계획과 달라진 것

| # | 계획(v4) | 구현 | 이유 |
|---|---|---|---|
| I1 | `toMathpixStrokes` 정수 반올림 | **소수 1자리** | 확대 3배에서 쓴 첨자는 종이 좌표로 1px 안쪽이 의미가 있다 — 정수로 자르면 작은 글자의 획이 뭉개진다. JSON 크기 차이는 무시할 만하다 |
| I2 | (없음) | `InkCanvasHandle.getView()` | 하니스가 확대 상태를 읽는 자리(진단용 — 앱은 쓰지 않는다) |
| I3 | `InkInbox` 내부 카드 | **`InkCard` export + `actions` 주입**(기본 = 실제 `markInserted`·`discardJob`) | 하니스가 Firestore 없이 카드를 띄우는 자리. 앱 경로 무변화 |
| I4 | (없음) | `presenceMessage`·`presenceLabel`·`PRESENCE_DEBOUNCE_MS`를 `lib/ink/presence`에 | 상태 칸 문구·라벨을 순수 함수로 — 테스트 대상 |
| I5 | 완료 버튼 눌림 색(샘플 `#A8532F`) | `--wordmark-small`(#944728) | 색은 토큰으로(팔레트 규약) — 가장 가까운 기존 토큰 |
| I6 | 버튼 `:active`·`:hover` | `globals.css` `.ink-pad .ink-btn` 스코프 · `:hover`는 `@media (hover: hover)` 안 | 인라인 스타일로는 눌림을 못 그린다 · Phase 64 §7-5 규약 |
| I7 | 손바닥 규칙의 짝 찾기 | 새 손가락의 짝 = **이미 닿아 있던 손가락 중 가장 최근 것** · 제스처 중엔 새 짝을 찾지 않는다 | 손바닥(오래전 착지) + 두 손가락이면 나중 두 손가락이 짝이 된다. 대가: 한 손가락을 떼면 남은 손가락과 새 손가락은 착지 차가 커서 다시 핀치하려면 **둘 다 뗐다 대야** 한다(실물에서 거슬리면 조율) |
| I8 | 확대 중 격자 | 1배에서만 픽셀 격자에 맞춘다(`round + 0.5`) · 확대 중에는 선 굵기 `1/s`·점 간격 `/s` | 확대해도 머리카락 선·같은 점 간격(스크린샷 확인) |

### 13-2. 하니스 (임시 라우트 `app/dev69` — 커밋하지 않음, dev 종료 뒤 삭제)

- 캔버스 18/18: ① 펜 획 · 1배 좌표 = 쓰기 면 로컬 ② 한 손가락 → 아무것도 안 함 ③ 마우스 기본 무시 ④ 두 손가락 2배 · 중점 아래 종이 점 고정 ⑤ 확대 중 획 좌표 = `toPaper` ⑥ 원래 크기 ⑦ 착지 차 400ms → 확대 안 됨 ⑧ 펜 뗀 직후 → 안 됨 · ⑧′ 냉각 뒤 → 됨 ⑨ 3배 상한 ⑩ PNG 보조선 색 0 · 흰 배경 · 크기 ⑪ 모두 지우기 → 되돌리기 ⑫ KaTeX 글꼴 · 예시 픽셀 ⑬ `?input=mouse` ⑭ 펜 진행 중 두 손가락 → 안 됨
- 카드 22/22: 포커스 유지 · 하단 도킹·z 10300·transform 없음 · `latex_styled` 인라인 초깃값 · KaTeX 렌더 · 1/2 · 신뢰도·삽입 위치 · 카드 안 ⌘B 무동작(대조: 블록 안 ⌘B는 탐) · 확인 → 앞 공백 보정 · inserted 기록 · ⌘Z 1회 · 수식 안 구분자 벗김 · 선택 대체 · 펜스형 블록 · 접힌 블록 비활성 · 자동완성 툴팁 위치 · 취소 확인창 · OCR 실패 띠
- 첫 실행 실패 4건은 전부 **하니스 쪽**이었다: ④ 펜 획 직후 250ms에 핀치 → **펜 뒤 300ms 규칙이 정확히 막은 것**(⑧이 같은 규칙을 의도적으로 검사) · 선택 인덱스 셈 · LaTeX 자동완성은 수식 안에서만 뜬다 · 빈 편집창 placeholder 글자를 내용으로 읽음
- ⚠ 임시 라우트는 서버/클라이언트 첫 렌더가 달라 hydration 경고가 난다(쿼리로 모드를 고르기 때문) — 하니스 전용, 앱 라우트(`/`·`/ink`)는 콘솔 오류 0

### 13-3. 남은 일 (덕수)

1. 규칙 배포 `firebase deploy --only firestore:rules,storage` — 배포 전에는 로컬 dev도 `ink_jobs` 쓰기·Storage 업로드가 거부된다
2. push → Vercel 빌드 로그 `[icons:check] OK — 63종`
3. iPad 실물 §11-3 — 특히 3번 핀치(**손바닥 규칙 상수 넷 조율** — `lib/ink/view.ts` 한 곳)와 5번(Mathpix `latex_styled`가 손글씨 단일 식에 실제로 오는가)
4. Storage 규칙 콘솔 Playground 4건(본인 png create · 타인 read 거부 · 6MB 거부 · 본인 delete)
