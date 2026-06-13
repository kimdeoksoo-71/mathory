# Phase 43: 글꼴 시스템 리뉴얼 (Pretendard 기반)

> 작성일: 2026-06-13
> 상태: 설계 확정 — 구현 대기
> 비고: 원안은 "Phase 42"로 작성됐으나 Phase 42는 이미 "AI 토론자 그래프 도구"로 사용됨 → **Phase 43으로 정정**.
> 이 문서는 첨부 원안을 **실제 코드베이스 조사 결과에 맞춰 정정**한 버전이다 (파일 경로·클래스명·CDN 경로·토큰 이름).

---

## 0. 확정된 결정 (2026-06-13 덕수 승인)

| 항목 | 결정 |
|------|------|
| 액센트 색 | **테라코타 `#c96442`** 채택 — 기존 클레이 `#B8845C`를 값 교체 |
| 토큰 병합 | **기존 토큰 이름 유지 + 값만 교체** (`--accent-primary`, `--text-*`, `--bg-*` 그대로) |
| 에디터 하이브리드 폰트 | **모든 CodeMirror에 적용** (메인 에디터 + 토론·댓글 입력창) |
| Pretendard 로딩 | **Variable 서브셋으로 전환** (굵기 미세조정 가능) |
| 텍스트 톤 | **기존 Clay 웜그레이 유지** (#2D2A23/#5D5647/#9C9585 — 값 변경 없음) |
| firebase-test dev 페이지 | 색 치환 **제외** |
| 인쇄 본문 크기/행간 | **계획서대로 — 12pt→10pt, 행간 2.5→1.7** (⚠️ 구현 후 인쇄 미리보기로 단 넘침 확인 필수) |
| 모델 | 구현은 opus-4-8로 진행 |

---

## 1. 배경과 목표

현재 본문에 사용 중인 명조체(Noto Serif KR)는 화면에서 두께가 무겁고 인상이 낡았다.
전체 글꼴 시스템을 **Pretendard** 기반으로 리뉴얼한다.

### 3대 원칙

| 원칙 | 구현 방향 |
|------|----------|
| **가독성** | 수식(KaTeX)은 진하게, 한글 본문은 살짝 톤다운하여 수식이 시각적으로 앞으로 나오게 |
| **호환성** | 모든 폰트를 CDN 웹폰트로 로딩. OS/브라우저/모바일/데스크탑에서 설치 없이 동일 렌더링 |
| **미적 완성도** | 모던·심플·차분. 굵기는 400/500/600 세 단계만, 700(bold) 사용 금지 |

### 적용 범위 외 (이번 Phase에서 하지 않음)

- Typst 기반 PDF 시험지 export 파이프라인 본구현 (글꼴·크기 스펙 설계와 `@media print` 적용까지만 — 3.5절)
- KaTeX 수식 글꼴 자체 교체 (KaTeX_Main 유지)
- 다크 모드

---

## 2. 폰트 시스템 정의

### 2.1 글꼴 스택

| 역할 | 글꼴 | 로딩 방식 |
|------|------|----------|
| 기본 (본문 + UI 전반 + 에디터 일반 텍스트) | **Pretendard Variable** | jsDelivr CDN, dynamic-subset |
| 수식 | **KaTeX_Main** (기존 유지) | katex CSS 번들 (변경 없음) |
| 에디터 **수식 영역(LaTeX 코드)** | **D2Coding** | jsDelivr CDN |
| **인쇄·PDF 본문** | **Noto Serif KR** (400/600) | Google Fonts CDN |

#### ⚠️ 원안 대비 정정 사항 (CDN 경로)

원안의 D2Coding 경로 `projectnoonnu/noonfonts_three@1.0/D2Coding.woff` 는 woff(구형) 포맷이다.
**검증 결과 더 안전한 경로**(woff2, 200 OK 확인):

```css
/* @font-face 직접 선언 — globals.css 상단 */
@font-face {
  font-family: 'D2Coding';
  src: url('https://cdn.jsdelivr.net/gh/joungkyun/font-d2coding@1.3.2/D2Coding.woff2') format('woff2'),
       url('https://cdn.jsdelivr.net/gh/joungkyun/font-d2coding@1.3.2/D2Coding.woff') format('woff');
  font-weight: normal;
  font-display: swap;
}
```

Pretendard는 현재 **static** dynamic-subset을 쓰고 있다(layout.tsx). 굵기 미세조정(380 등)을
쓰려면 **Variable** 서브셋으로 전환:

```
https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css
```

Noto Serif KR는 현재 `wght@500;700`을 로드 중 → 인쇄 본문 400 / 제목 600을 위해 **`wght@400;600`** 으로 변경.

**하이브리드 구성 이유**: 에디터의 raw_text는 한글 산문이 대부분이고 LaTeX가
중간에 박힌 구조다. 산문은 비례폭(Pretendard)이, LaTeX 코드는 고정폭이
가독성에 맞다. 상세 설계는 3.2절.

### 2.2 CSS 변수 (디자인 토큰) — 기존 이름 유지, 값만 교체

현재 `app/globals.css :root`의 토큰 이름을 그대로 두고 값만 갱신한다.

```css
:root {
  /* 폰트 — 값 교체 */
  --font-ui:      "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont,
                  system-ui, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif;
  --font-content: var(--font-ui);   /* 화면 본문도 Pretendard로 통일 (명조 → 산스) */
  --font-logo:    var(--font-ui);   /* 로고도 산스 (명조 제거) */
  --font-mono:    "D2Coding", "JetBrains Mono", Menlo, Monaco, monospace;
  --font-print:   "Noto Serif KR", "Noto Serif CJK KR", serif;   /* 신설: 인쇄 전용 */

  /* 액센트 — 값 교체 (클레이 → 테라코타) */
  --accent-primary: #c96442;
  --accent-hover:   #b1502f;
  --accent-soft:    #f5e6df;   /* 신설: 액센트 연한 배경 */

  /* 텍스트 — 기존 웜그레이 톤 유지 (Clay 정체성 보존).
     본문(secondary)과 수식(primary)의 명도 차이로 수식이 앞으로 나옴 */
  --text-primary:   #2D2A23;   /* 수식, 제목, 강조 */
  --text-secondary: #5D5647;   /* 본문 (톤다운) */
  --text-muted:     #9C9585;   /* 보조 텍스트, 캡션, 메타 */
  --text-faint:     #B8AFA4;   /* placeholder, 비활성 */

  /* 굵기 — 3단계만 */
  --weight-regular:  400;
  --weight-medium:   500;
  --weight-semibold: 600;
}
```

> **원칙**: `font-weight: bold`(=700)는 화면 인라인 스타일에서 제거하고 600으로 치환.
> Pretendard 700은 화면에서 둔하게 보인다.
>
> **본문 굵기 하한**: 본문 기본 400. ClearType(Windows) 한글 받침 깨짐 때문에
> 350 미만은 금지. 본문은 이미 색(`--text-secondary`)으로 톤다운했으므로 굵기까지
> 낮추는 중복은 지양.

---

## 3. 영역별 적용 계획

### 3.1 문제·해설 본문 (EditorPreview, ProblemView)

> **현황(정정)**: 본문 렌더 컴포넌트는 `components/problem/SolutionView.tsx`로 분리돼
> 있지 않다. 풀이는 ProblemView 내부 탭이다. 또한 두 컴포넌트가 **현재 폰트가 다르다**:
> - `EditorPreview.tsx:443` — `var(--font-content)` = **명조**
> - `ProblemView.tsx:664` — `.problem-content-scaled .problem-content-toned`, 폰트는 body `--font-ui` 상속 = **산스**
>
> 이번에 `--font-content`를 `--font-ui`로 통일하므로 둘 다 Pretendard가 된다.

가독성 원칙이 가장 직접 적용되는 영역. **"수식은 진하게, 본문은 흐리게"**.

```css
/* 공통 본문 클래스 — 기존 .problem-content-toned 에 부착하거나 globals에 공통 규칙 */
.problem-content-toned {
  font-family: var(--font-ui);
  font-weight: var(--weight-regular);
  line-height: 1.8;
  color: var(--text-secondary);   /* 본문 톤다운 */
  letter-spacing: -0.01em;
}
/* 수식은 본문보다 한 단계 진하게 */
.problem-content-toned .katex { color: var(--text-primary); }
```

> **현행 보존**: `.problem-content-toned`는 이미 `color:#6a6a6a` / `.katex{color:#000}`로
> 톤다운돼 있다(globals.css:121). 이를 토큰 기반으로 정리하되 대비 메커니즘은 유지.
>
> **줄 행간 보존 주의**: 미리보기에는 "큰 수식 행간 자동 확대" 로직(커밋 5be5abd,
> 8fd25e0)이 있다. `line-height:1.8`이 기존 행간 CSS를 덮지 않는지 큰 수식 포함
> 문제 1건으로 적용 전/후 비교 필수.

적용 대상:
- `components/editor/EditorPreview.tsx` (`.preview-content`, line 443 font-family)
- `components/problem/ProblemView.tsx` (`.problem-content-toned`)
- `components/problem/FolderView.tsx` (`.problem-content-toned`, line 506 — 동일 클래스라 자동 반영)
- `app/globals.css` (`.preview-content`, `.problem-content-toned` 규칙)

### 3.2 에디터 (CodeMirror 6) — 하이브리드 폰트

> **현황(정정)**: 활성 CodeMirror 래퍼는 `components/editor/MarkdownEditor.tsx`다
> (EditorView.tsx는 편집 화면 컨테이너). 원안이 지목한 `BlockEditor.tsx`는 해당 없음.
> 현재 `.cm-scroller` font-family가 **JetBrains Mono로 전역 고정**(MarkdownEditor.tsx:623).

| 영역 | 폰트 | 이유 |
|------|------|------|
| 일반 텍스트 | Pretendard (비례폭) | 산문 가독성, 미리보기와 시각 연속성 |
| 수식 영역 전체 | D2Coding (고정폭) | LaTeX는 코드. 중괄호 짝, 글자 단위 커서 이동에 고정폭이 유리 |

```ts
// MarkdownEditor.tsx EditorView.theme
'.cm-scroller': { fontFamily: 'var(--font-ui)' },   // 기본 = Pretendard
'.cm-content':  { lineHeight: '1.8' },              // 고정 행간 (폰트 혼용 줄높이 방지)
```

```css
/* latex-highlight 데코레이션 — 하드코딩 hex/bold 제거, 토큰화 */
.cm-base-text      { color: var(--text-secondary); }          /* 일반 텍스트 */
.cm-math-region    { font-family: var(--font-mono); font-size: 0.95em; }  /* 신설: 수식 전체 */
.cm-math-delimiter { color: var(--text-muted); }              /* $, \[ 등 흐리게 (기존 #e53935 + bold 제거) */
.cm-latex-command  { color: #3b5b7d; font-weight: 500; }      /* 명령어 (기존 #1565c0) */
.cm-latex-brace    { color: var(--text-muted); }              /* (기존 #2e7d32 + bold 제거) */
```

#### 구현 요구사항 (`lib/latex-highlight.ts` 수정)

1. **`cm-math-region` 마크 신설**: `buildDecorations`에서 수식 범위 전체(`$...$`,
   `$$...$$`, `\(...\)`, `\[...\]` 내부)를 감싸는 데코레이션 추가. 현재는
   명령어·중괄호·구분자만 마킹하고 **수식 내부 변수·숫자는 미데코**라 base(Pretendard)로
   떨어진다. region 마크를 먼저 깔고 그 위에 기존 command/brace/delimiter를 중첩.
   → `highlightMathContent` 호출부에서 region 범위를 별도 push.
2. **`latexHighlightTheme`의 하드코딩 제거**: `#4d4d4d/#e53935/#1565c0/#2e7d32`와
   `fontWeight:'bold'` 2건(line 180,182)을 위 토큰/약한 색으로 교체.
3. **줄 높이 검증**: 수식 포함 줄과 미포함 줄의 높이가 동일한지 확인. 다르면
   `--font-mono` font-size(0.95em 시작)로 보정.
4. **커서/선택 동작**: 비례폭-고정폭 경계에서 커서 위치, 드래그 선택, autoHeight
   스크롤(`getCursorPosition` 기반)이 정상인지 테스트. IME 조합 중 데코 재빌드
   스킵 로직(line 167)과 충돌 없는지 확인.

적용 대상:
- `lib/latex-highlight.ts` (cm-math-region 추가 + 색 토큰화 + bold 제거)
- `components/editor/MarkdownEditor.tsx` (scroller fontFamily JetBrains Mono → var(--font-ui), line 623·671)
- `components/editor/MathToolbar.tsx` (line 136·205 JetBrains Mono 직접 지정 → var(--font-mono))
- 토론·댓글 입력창 CodeMirror (동일 MarkdownEditor 래퍼 공유 시 자동 반영 — 구현 시 확인)

### 3.3 UI 전반 (메뉴, 제목, 사이드바, 토론창, 배지)

body 기본 글꼴은 이미 `--font-ui`(globals.css:61). 값 교체만으로 전역 반영.
인라인 스타일의 `fontWeight:'bold'`(700)와 명조 직접 지정을 grep으로 찾아 정리.

| UI 요소 | 크기 | 굵기 | 색 |
|---------|------|------|-----|
| 페이지 제목(h1) | 22px | 600 | `--text-primary` |
| 섹션 제목(h2) | 17px | 600 | `--text-primary` |
| 메뉴·사이드바 항목 | 14px | 500 | `--text-secondary` (활성만 primary) |
| 토론창 본문 | 14px | 400 | `--text-secondary`, line-height 1.7 |
| 토론창 작성자명·모델명 | 13px | 500 | `--text-primary` |
| 배지·라벨 | 12px | 500 | 상황별, letter-spacing 0.01em |
| 메타정보 (날짜·연도·태그) | 13px | 400 | `--text-muted` |
| placeholder | — | 400 | `--text-faint` |

### 3.4 KaTeX 크기 튜닝 (구현 후 실측)

> **현황(정정)**: `.katex .text { font-family: var(--font-content) !important; font-size: 15px !important }`
> (globals.css:135). `--font-content`가 Pretendard로 바뀌면 `\text{}`도 자동 Pretendard.

- KaTeX 기본 1.21em은 Pretendard x-height 기준 빈약해 보일 수 있음 → 본문 대비 1.05em 검토
- 실제 문제 1건(분수·적분 포함)에 1.00/1.05/1.10 비교 후 확정
- 확정값을 `--katex-scale` 변수로 추출

### 3.5 인쇄·PDF 출력용 (Noto Serif KR)

> **현황(정정)**: 인쇄 본문 타겟은 `.problem-content`가 **아니라** `.print-body`다
> (`components/print/PrintStyles.css`, `PrintableContent.tsx`). 현재:
> - `.print-body` font-family `'Noto Serif KR', Georgia, ...` / **font-size 12pt** / **line-height 2.5** (PrintStyles.css:32-34)
> - 제목 h1 16pt/700, h2 14pt/700, h3 12pt/700, 탭라벨 14pt/700 (700 다수)
>
> ⚠️ **원안의 `@media print { .problem-content {...} }` 는 타겟이 틀림.** `.print-body`를 수정해야 한다.
> ⚠️ 현재 line-height 2.5는 인쇄 단 채움을 위한 **의도적 큰 값**이다. 원안의 1.7로
> 바꾸면 2단 레이아웃이 급변하므로 **이번엔 행간/크기 급변을 보류**하고 굵기·글꼴만 정리(아래 결정 D).

인쇄물은 명조 유지(수능 시험지 관례). 단, "두껍고 부담스러움"은 굵기로 해결:

```css
/* PrintStyles.css — 보수적 변경안 */
.print-body { font-family: var(--font-print); /* font-size·line-height 현행 유지 */ }
.print-tab-label,
.print-body h1, .print-body h2, .print-body h3 { font-weight: 600; }  /* 700 → 600 */
```

**인쇄 적용 원칙 세 가지**:
1. 화면 톤다운(`--text-secondary`)은 인쇄 시 옅으므로 인쇄 본문은 `#000` 유지.
2. KaTeX 화면용 1.05em 보정은 명조에선 1.0em으로 환원(현행 PrintStyles.css:64가 이미 1em).
3. 배지·강조색은 흑백/테두리만 (현행 인쇄 CSS 이미 무채색 — 변경 불필요).

### 3.6 색 체계 — 하드코딩 hex 정리

배경이 크림(`#FAF9F7`)이므로 액센트는 테라코타 단일 톤으로 통일.

| 대상 | 토큰 | 비고 |
|------|------|------|
| 기본 버튼, 링크, 활성 탭·메뉴 | `--accent-primary` (#c96442) | 기존 `#4285f4` Google 블루 치환 |
| 에러 메시지 | `--accent-danger` (#C0392B, 현행 유지) | `#ea4335` 치환 |
| 성공/완료 표시 | (신규 status 토큰 또는 accent) | `#34a853` 치환 |

**하드코딩 grep 대상 (조건분기 주의 — 기계적 치환 금지)**:
- `#4285f4` (8건): settings, problems/new, problems, [id]/edit, LoginButton, FolderPathBar, **firebase-test(dev 페이지 — 제외 권장)**
- `#ea4335` (6건): firebase-test, problems/new(에러조건), [id]/edit(에러조건), Sidebar, SortableBlock(hover)
- `#34a853` (6건): firebase-test, problems/new(성공조건), [id]/edit(성공조건), PdfDownloadButton, ProblemView(복사완료), EditorView(저장상태)

`problems/new`·`[id]/edit`의 `#ea4335`/`#34a853`는 `includes('에러')` **상태 분기**에
쓰인다 → 의미를 유지하며 danger/success 토큰으로 매핑 (단순 일괄치환 X).

---

## 4. 구현 단계

1. **토큰 정의**: `globals.css :root` — `@font-face`(D2Coding) + 폰트 토큰 값 교체(Pretendard Variable, --font-mono=D2Coding, --font-print 신설) + 액센트 값 교체(#c96442) + --accent-soft 신설
2. **폰트 로딩**: `layout.tsx` — Pretendard static→variable 서브셋, Noto Serif KR `500;700`→`400;600`
3. **본문 영역**: `--font-content`→`--font-ui` 통일, EditorPreview/ProblemView 본문 Pretendard화, `.problem-content-toned` 토큰화, KaTeX 색·크기 오버라이드
4. **에디터**: `latex-highlight.ts` cm-math-region 추가 + 색 토큰화 + bold 제거, MarkdownEditor scroller·MathToolbar 폰트 → var(--font-mono), 고정 line-height + mono font-size 보정
5. **UI 정리**: 인라인 `fontWeight:'bold'`/`700` → `600` 치환, 명조 직접 지정 제거
6. **색 치환**: 하드코딩 hex → 토큰 (조건분기 개별 확인)
7. **인쇄**: `.print-body` 글꼴 토큰화 + 제목 700→600 (크기·행간 보류)
8. **검증**: 아래 수용 기준 체크 후 커밋 (push는 덕수가 직접)

---

## 5. 리스크와 주의사항

| 리스크 | 대응 |
|--------|------|
| D2Coding CDN 경로 | jsDelivr `joungkyun/font-d2coding@1.3.2` woff2 확인 완료(200). 불안정 시 `public/fonts/` self-host |
| 데코레이션 커버리지 미달 (수식 내부 변수/숫자가 base로) | `cm-math-region`으로 수식 범위 전체 마킹 후 command/brace 중첩 |
| 폰트 혼용 줄 높이 다용성 / 커서 오차 | `.cm-content` 고정 line-height 1.8 + mono 0.95em 보정, autoHeight 스크롤 테스트 |
| 큰 수식 행간 자동확대 로직(5be5abd) 충돌 | `line-height:1.8`이 기존 행간 CSS 덮는지 회귀 확인 |
| 인쇄 line-height 2.5 의도적 값 변경 위험 | 이번엔 크기·행간 보류, 글꼴·굵기만 정리 |
| FOUT | Pretendard dynamic-subset `font-display:swap` 내장. 폴백 Apple SD Gothic Neo/Noto Sans KR |
| 색 조건분기 오치환 | `includes('에러')` 등 상태 분기 hex는 개별 확인 |
| EditorPreview 명조→산스 시각 변화 | 의도된 변화. 미리보기/조회 폰트 통일이 목적 |

---

## 6. 수용 기준

- [ ] Chrome/Safari/Firefox + macOS/Windows/iOS/Android에서 본문이 모두 Pretendard 렌더 (Computed font-family 확인)
- [ ] 폰트 미설치 환경(시크릿 모드)에서도 동일 렌더
- [ ] 문제 본문에서 수식이 본문보다 시각적으로 진하게 보임 (명도 대비)
- [ ] 에디터에서 일반 텍스트 Pretendard, 수식 영역(변수·숫자 포함) D2Coding 렌더
- [ ] 수식 포함 줄과 미포함 줄 높이 동일 (줄 다용성 없음)
- [ ] 비례폭-고정폭 경계 커서 이동·드래그 선택·autoHeight 스크롤 정상
- [ ] 코드베이스에 `fontWeight:'bold'` 및 화면 명조 직접 지정 0건 (grep)
- [ ] KaTeX 수식 크기 본문과 균형 (1.05em 실측값 기록)
- [ ] 토론창 본문/작성자명/배지 크기·굵기 3.3과 일치
- [ ] 인쇄 미리보기(Ctrl+P)에서 본문 Noto Serif KR, 제목 600 출력
- [ ] `#4285f4`·`#ea4335`·`#34a853` 하드코딩 0건 (firebase-test 제외 합의 시 그 외 0건)
- [ ] 액센트가 테라코타 #c96442로 전역 반영 (버튼·링크·활성 탭)
- [ ] Lighthouse 성능 점수 폰트 도입 전 대비 유의미한 하락 없음

---

## 7. 후속 과제 (이번 Phase 범위 외)

- Typst 기반 PDF 시험지 export 파이프라인 본구현 — 3.5절 글꼴·크기 스펙 재사용
- 인쇄 본문 크기/행간 정밀 재조정 (12pt·line-height 2.5 → 수능 관례 기준 재검토)
- 다크 모드 도입 시 텍스트·배경·액센트 토큰 다크 변형
