# 수식 기호 설정 화면 설계서

> 작성일: 2026-05-25 (최종: displayLatex 하이브리드 렌더링 + \dfrac 구분 반영)
> 범위: 설정 화면(SymbolSettingsModal)의 UX·데이터·국제화 설계
> 목표: 중학생부터 교수까지, 한·일·중·영어권 모두 10년간 불편 없이 사용


---

## 1. 설계 원칙

### 1-1. 세 가지 핵심 원칙

| 원칙 | 근거 | 설정 화면 적용 |
|------|------|---------------|
| **2단계 점진적 노출** | NN/g 연구: 3단계 이상의 disclosure는 사용자가 길을 잃음 | 설정 화면 = 1단계(프리셋 선택), 2단계(세부 커스터마이징). 3단계는 만들지 않는다 |
| **기본값은 코드에, 변경분만 저장** | VS Code 모델: settings.json에는 사용자가 바꾼 것만 저장 | Firestore에는 사용자가 변경한 그룹만 저장. 프리셋 기호는 코드 상수 |
| **ID는 영원히** | Unicode/Protocol Buffers: 한 번 부여한 ID는 재사용·변경 금지 | 기호 ID(1~332+)는 불변. 미래에 기호가 추가되면 333번부터 이어감 |

### 1-2. 사용자 페르소나별 설정 화면 사용 시나리오

| 페르소나 | 행동 | 설정 화면 체류 시간 |
|----------|------|-------------------|
| 중학생 | 프리셋 "중·고등학교" 선택 → 끝 | 5초 |
| 고등학교 교사 | 프리셋 "중·고등학교" + 그룹 1개 추가 ("통계" 기호 몇 개 추가) | 1~2분 |
| 대학 1~2학년 | 프리셋 "대학 기초" 선택 → 끝 | 5초 |
| 수학과 교수 | 프리셋 "대학 전공" + 자기 분야 그룹 세밀 구성 (위상수학, 추상대수 등) | 3~5분 |
| 물리학과 대학원생 | 프리셋 "대학 전공" + "벡터 미적분" 그룹에 기호 추가/삭제 | 2~3분 |

**핵심 통찰:** 대부분의 사용자는 프리셋 하나를 고르고 끝낸다. 세부 커스터마이징은 소수의 파워 유저만 한다. 따라서 설정 화면의 첫 화면은 **프리셋 선택**이어야 하고, 세부 편집은 그 다음 단계에 있어야 한다.


---

## 2. 설정 화면 구조: 2단계 설계

### 2-1. 전체 흐름

- ⚙ 클릭 (툴바 오른쪽 끝)
- 1단계: 프리셋 선택 (대부분의 사용자는 여기서 끝)
  - ○ 중·고등학교 ~120개 기호
  - ● 대학 기초 ~230개 기호
  - ○ 대학 전공 ~300개 기호
  - ○ 전체 332개 기호
  - [이 프리셋으로 설정] [직접 편집 →]
- 2단계: 세부 편집 ("직접 편집" 클릭 시)
  - 왼쪽: 내 기호 그룹 | 오른쪽: 기호 카탈로그
  - [완료]

### 2-2. 왜 2단계인가

- **1단계만 있으면**: 파워 유저가 원하는 세밀한 제어 불가
- **2단계만 있으면**: 중학생이나 바쁜 교사가 수십 개 기호를 하나하나 골라야 함 → 이탈
- **3단계 이상이면**: NN/g 연구에 따르면 사용자가 현재 위치를 잃고 혼란

2단계가 정답이다. 1단계(프리셋)로 80%의 사용자를 5초 안에 보내고, 2단계(세부 편집)로 나머지 20%를 만족시킨다.


---

## 3. 1단계: 프리셋 선택 화면

### 3-1. 프리셋 정의

| 프리셋 | 등급 범위 | 기호 수 | 대상 사용자 |
|--------|----------|---------|------------|
| 중·고등학교 | ★1 | ~120 | 중고생, 중등 교사 |
| 대학 기초 | ★1~2 | ~230 | 대학 1~2학년, 이공계 교수(교양) |
| 대학 전공 | ★1~3 | ~300 | 수학/물리 전공, 대학원생, 교수 |
| 전체 | ★1~4 | 332 | 연구자, 특수 분야 |

### 3-2. 프리셋별 기본 그룹 구성

**"중·고등학교" 프리셋 기본 그룹:**

| 그룹명 | 기호 예시 | 기호 수 |
|--------|----------|---------|
| 기본 연산 | + − × ÷ ± \frac \dfrac \sqrt ^{} _{} | ~12 |
| 등호·부등호 | = ≠ < > ≤ ≥ ≈ | ~8 |
| 집합 | ∈ ∉ ⊂ ⊆ ∪ ∩ ∅ { } | ~12 |
| 함수·수열 | f(x) f∘g f⁻¹ lim Σ aₙ log ln | ~12 |
| 삼각함수 | sin cos tan csc sec cot arcsin arccos arctan | ~9 |
| 미적분 | dy/dx f'(x) ∫ ∫ₐᵇ Δx dx | ~8 |
| 기하·벡터 | ∠ △ ∥ ⊥ ° π →a a·b | ~10 |
| 확률·통계 | P(A) P(A|B) E(X) V(X) σ N(μ,σ²) Ω | ~10 |
| 논리·증명 | ∧ ∨ ¬ ⇒ ⇔ ∴ ∵ | ~7 |
| 그리스·기호 | α β γ θ π σ λ μ φ ω Δ Σ ∞ | ~13 |
| 괄호·장식 | () [] {} |x| x̄ ↗ ↘ → | ~10 |

**"대학 기초" 프리셋:** 위 그룹 + 편미분·다변수, 선형대수, 확률·통계 확장, 추가 그리스

**"대학 전공" / "전체" 프리셋:** 카테고리 기반 자동 그룹 (A~V를 그대로 그룹화)

### 3-3. UI 동작

- 라디오 버튼으로 하나 선택
- 각 프리셋 항목에 대표 기호 미리보기 (KaTeX 렌더링)
- [현재] 뱃지로 현재 설정된 프리셋 표시
- [이 프리셋으로 설정] → 해당 프리셋의 기본 그룹으로 즉시 교체, 모달 닫힘
- [직접 편집 →] → 2단계(세부 편집) 화면으로 전환
- 하단 안내: "프리셋을 선택해도 나중에 기호를 추가/삭제할 수 있습니다."


---

## 4. 2단계: 세부 편집 화면

### 4-1. 레이아웃

왼쪽: 내 기호 그룹 (그룹별 기호 그리드) | 오른쪽: 기호 카탈로그 (A~V 세로 스크롤, 검색)

### 4-2. 오른쪽 패널: 기호 카탈로그

332개 기호를 A~V 카테고리 순서로 나열. 세로 스크롤로 탐색.

**하이브리드 렌더링 전략:**

기호를 두 종류로 나눠 렌더링 방식을 다르게 적용한다.

| 종류 | 판정 기준 | 비율 | 렌더링 | 예시 |
|------|----------|------|--------|------|
| 단순 기호 | displayLatex 없음 | ~200개 (60%) | symbol 유니코드 그대로 | ± ≤ α ∈ ∪ ∞ → |
| 구조형 기호 | displayLatex 있음 | ~130개 (40%) | KaTeX로 displayLatex 렌더링 | \frac{a}{b} \sqrt{x} \int_a^b |

```typescript
function renderSymbolPreview(sym: MathSymbol): string | HTMLElement {
  if (sym.displayLatex) {
    return katex.renderToString(sym.displayLatex, { throwOnError: false });
  } else {
    return sym.symbol;
  }
}
```

**기호 셀:**
- 셀 크기: 40×40px (터치 대응 44px 근접)
- 가로 배치: CSS Grid auto-fill
- hover tooltip: {이름} ({LaTeX}) ★{등급}
- 이미 내 그룹에 있는 기호: 우측 상단 체크 마크(✓)

**등급 시각 구분 (색맹 대응):**

| 등급 | 배경색 | 추가 표시 |
|------|--------|----------|
| ★1 | 흰색 (기본) | 없음 |
| ★2 | 연한 파란 틴트 | 없음 |
| ★3 | 연한 회색 배경 | 좌상단 작은 점(·) |
| ★4 | 연한 회색 배경 | 좌상단 작은 점 2개(··) |

**검색:** 카탈로그 상단 검색 필드. 한국어/영어/LaTeX 명령어/기호 자체 모두 매칭. debounce 150ms.

**성능 (하이브리드 전략):**
- 단순 기호 (~200개): 유니코드 그대로 → KaTeX 호출 zero
- 구조형 기호 (~130개): displayLatex를 KaTeX 렌더링
- IntersectionObserver: 뷰포트 밖은 placeholder
- KaTeX 결과 캐싱: Map<string, string>으로 모듈 레벨 캐시

### 4-3. 왼쪽 패널: 내 기호 그룹

- 그룹 헤더: 이름 + [...] 더보기 (이름 변경, 그룹 삭제)
- 기호 셀: 40×40px, hover 시 × 삭제 버튼
- 드래그 재정렬: dnd-kit SortableContext
- [+ 그룹 추가] 버튼 (최대 12개)
- 그룹 삭제: 즉시 삭제 + Undo 토스트 (5초)

### 4-4. 기호 추가 방식: 클릭 기반

1. 왼쪽 그룹 헤더 클릭 → 선택 상태
2. 오른쪽 기호 클릭 → 선택된 그룹에 추가
3. 드래그 앤 드롭은 하지 않음 (클릭이 더 직관적, 모바일 대응)

### 4-5. 프리셋 ↔ 커스텀 관계

- 프리셋 선택 후 편집 안 하면: Firestore 저장 안 함 (코드 기본값)
- 한 번이라도 편집하면: Firestore 저장 → 이후 Firestore 우선
- 다른 프리셋 선택 시: "현재 설정이 초기화됩니다" 확인


---

## 5. 데이터 모델

### 5-1. Firestore 스키마

```
users/{uid}/toolbar_config/default (document)
{
  schemaVersion: 1,
  preset: "university-basic",    // null이면 커스텀
  maxTier: 2,
  groups: [
    { id: "g1", name: "기본 연산", order: 0, symbolIds: [1, 2, 3, 4, 8, 7, 10, 322, 323] },
    ...
  ],
  recentSymbolIds: [7, 10, 137, 99],
  updatedAt: Timestamp
}
```

문서 크기: ~1KB (Firestore 1MB 제한 대비 충분)

### 5-2. TypeScript 타입

```typescript
export type PresetId = "high-school" | "university-basic" | "university-major" | "all";

export interface ToolbarGroup {
  id: string;
  name: string;
  order: number;
  symbolIds: number[];
}

export interface ToolbarConfig {
  schemaVersion: number;
  preset: PresetId | null;
  maxTier: 1 | 2 | 3 | 4;
  groups: ToolbarGroup[];
  recentSymbolIds: number[];
}
```

### 5-3. 기호 레지스트리 (MathSymbol 인터페이스)

```typescript
export interface MathSymbol {
  id: number;
  symbol: string;            // 표시 기호 (유니코드, 예: "±")
  latex: string;             // 삽입용 LaTeX (예: "\\frac{}{}")
  displayLatex?: string;     // 미리보기용 LaTeX (예: "\\frac{a}{b}")
  tier: 1 | 2 | 3 | 4;
  category: string;          // "A" ~ "V"
  cursorOffset?: number;     // 삽입 후 커서 위치

  name: {
    ko: string;              // "분수"
    en: string;              // "fraction"
    ja?: string;             // "分数"
    zh?: string;             // "分数"
  };

  variants?: {
    region: "kr" | "jp" | "cn" | "en";
    note: string;
  }[];
}
```

**displayLatex 필드 — 삽입용과 미리보기용 분리:**

| 기호 | latex (삽입용) | displayLatex (미리보기용) | 미리보기 결과 |
|------|---------------|--------------------------|-------------|
| 분수 (인라인) | \frac{}{} | \frac{a}{b} | 인라인 a/b |
| 분수 (디스플레이) | \dfrac{}{} | \dfrac{a}{b} | 큰 a/b |
| 제곱근 | \sqrt{} | \sqrt{x} | √x |
| n제곱근 | \sqrt[n]{} | \sqrt[n]{x} | ⁿ√x |
| 정적분 | \int_{}^{} | \int_a^b | ∫ₐᵇ |
| 합 | \sum_{k=1}^{n} | \sum_{k=1}^{n} | Σ |
| 행렬 | \begin{pmatrix}...\end{pmatrix} | \begin{pmatrix}a&b\\c&d\end{pmatrix} | 2×2 행렬 |

**\frac vs \dfrac 구분:**
\frac은 인라인 수식에서 작게 렌더링되고, \dfrac은 항상 디스플레이 크기로 렌더링된다. 둘 다 레지스트리에 별도 항목으로 등록하여, 사용자가 용도에 맞게 선택할 수 있게 한다. 미리보기(displayLatex)에서 크기 차이가 명확히 보이므로 직관적으로 구분 가능하다. 같은 패턴으로 \tfrac(텍스트 크기 강제)도 추후 추가 가능하다.

- displayLatex가 없는 기호 → 유니코드 symbol 그대로 표시
- displayLatex가 있는 기호 → KaTeX로 렌더링하여 표시

**국제화 이름:** 검색 시 모든 언어 매칭, tooltip은 사용자 locale 우선. ko/en 필수, ja/zh 선택.

### 5-4. 미래 확장성

- 기호 추가: id 333부터. 기존 사용자 영향 없음
- 카테고리 추가: "W", "X" 등. 기존 코드 불변
- 스키마 변경: schemaVersion 증가 + lazy migration


---

## 6. 국제화 (i18n)

### 6-1. 언어별 차이 대응

| 차이 | 대응 |
|------|------|
| 중국 lg = log₁₀ | variants에 "중국: lg 표기 사용" 명시 |
| 한국 ≒ vs 국제 ≈ | 두 기호 모두 레지스트리에 포함 |
| ⊂의 의미 차이 | tooltip에 국가별 용법 차이 명시 |
| nCr 표기 차이 | variants: "중국: C_n^r", "미국: (n choose r)" |
| 벡터 표기 | →a와 a(bold) 모두 제공 |

### 6-2. 프리셋명 국제화

| 프리셋 ID | ko | en | ja | zh |
|-----------|----|----|----|----|
| high-school | 중·고등학교 | High School | 中学·高校 | 初高中 |
| university-basic | 대학 기초 | University Basic | 大学基礎 | 大学基础 |
| university-major | 대학 전공 | University Major | 大学専門 | 大学专业 |
| all | 전체 | All Symbols | すべて | 全部 |

### 6-3. UI 텍스트 및 카테고리명도 locale별 표시 (next-intl 등 활용)


---

## 7. 최근 사용 기호 (자동 관리)

- 최대 20개 유지 (FIFO), 중복 시 맨 앞으로 이동
- MathSymbolPalette에 "최근 사용" 탭을 첫 번째 그룹 위에 표시
- 사용자가 편집 불가 (자동 관리)
- 설정 화면에서는 표시하지 않음
- Firestore 저장: 세션 종료 시 또는 5분 간격 일괄 저장


---

## 8. 접근성 (a11y)

- 기호 그리드: role="grid", 각 셀 role="gridcell" + aria-label
- 화살표 키 네비게이션, Enter/Space 선택
- 등급: 색상만으로 구분 안 함 (형태 병용)
- 스크린 리더: aria-description="등급 3, 대학 전공 수준"
- 포커스: 모달 열림→내부, 닫힘→⚙ 버튼 복귀


---

## 9. 컴포넌트 구현 명세

### 9-1. 파일 구조

```
components/editor/
  ├── MathSymbolPalette.tsx        (사용 모드)
  ├── SymbolSettingsModal.tsx       (설정 모달)
  ├── settings/
  │    ├── PresetSelector.tsx       (1단계)
  │    ├── UserGroupEditor.tsx      (2단계 왼쪽)
  │    ├── SymbolCatalog.tsx        (2단계 오른쪽)
  │    └── SymbolCell.tsx           (공유)

lib/
  ├── math-symbols.ts              (332개 기호 레지스트리)
  └── toolbar-defaults.ts          (프리셋 기본 그룹)

hooks/
  └── useToolbarConfig.ts          (Firestore CRUD)

types/
  └── toolbar-config.ts            (타입)
```

### 9-2. 상태 관리

```typescript
interface SettingsModalState {
  step: "preset" | "editor";
  selectedGroupId: string | null;
  searchQuery: string;
  editingGroupName: string | null;
}
```

모달 내부 useState로 관리. Firestore는 useToolbarConfig 훅의 debounce 처리.

### 9-3. 인터랙션 상세

**추가:** 왼쪽 그룹 선택 → 오른쪽 기호 클릭 → 그룹 끝에 append + ✓ 표시 + 하이라이트 애니메이션
**삭제:** hover 시 × 버튼 → fade-out → 카탈로그 ✓ 제거
**그룹 삭제:** 즉시 삭제 + Undo 토스트 5초


---

## 10. 이전 계획에서 변경된 사항

| 항목 | 이전 | 변경 후 | 이유 |
|------|------|---------|------|
| 설정 진입 | 바로 2패널 | 1단계(프리셋) → 2단계(편집) | 80% 사용자 5초 완료 |
| 등급 필터 | 슬라이더 | 프리셋 통합 | 별도 컨트롤 불필요 |
| 기호 추가 | 드래그 앤 드롭 | 클릭 기반 | 직관적, 모바일 대응 |
| 기호 이름 | 한국어만 | ko/en 필수 + ja/zh 선택 | 4개 문화권 |
| 프리셋 | 없음 | 4개 (교육 단계별) | 즉각적 가치 |
| 최근 사용 | 없음 | 자동 20개 | 반복 검색 제거 |
| 미리보기 | 특수문자 조합 | 하이브리드 (유니코드 + KaTeX) | 정확성 + 성능 |
| 분수 | \frac만 | \frac + \dfrac 별도 | 인라인/디스플레이 구분 |


---

## 11. 검증 시나리오

### 시나리오 1: 중학생 첫 사용
⚙ → "중·고등학교" → [이 프리셋으로 설정] → ~120개 기호, 11개 그룹. 5초.

### 시나리오 2: 고등학교 교사
⚙ → [직접 편집] → [+ 그룹 추가] "통계 심화" → 카탈로그 L. 확률·통계 → 𝔼[X], Var, Cov 클릭 → [완료]

### 시나리오 3: 수학과 교수 (위상수학)
⚙ → "대학 전공" → [직접 편집] → 불필요 그룹 삭제 → [+ 그룹 추가] "위상" → U. 위상수학·해석학에서 π₁, Hₙ, ≃ 등 추가 → [완료]

### 시나리오 4: 일본 사용자
UI 일본어 표시 → "中学·高校" 선택 → tooltip "分数 (\\frac) ★1" → 검색 "積分" → ∫ 필터링

### 시나리오 5: 검색
"nabla" 또는 "나블라" 또는 "\\nabla" → ∇ 표시


---

> **보완판 (2026-06-02): 사용 툴바 다듬기 + 대화 패널 통일 + KaTeX 렌더링 확정**
> 범위 = 전체 Phase 40 (프리셋·332심볼·Firestore 커스터마이징 포함). 아래 12~17장은 기존 1~11장(설정 모달 중심)에 더해, 실제로 사용자가 매일 쓰는 **사용 툴바(진입 드롭다운)**의 UX·통일·렌더링을 확정한다.


---

## 12. 사용 툴바 (MathSymbolPalette) — 진입과 표시 다듬기

설정 모달(1~11장)이 "기호를 고르는 화면"이라면, 이 장은 "고른 기호를 매일 꺼내 쓰는 화면"이다. 현재 거칠다는 지적을 받은 부분이 바로 여기다.

### 12-1. 현황 (Phase 25 잔재)

| 위치 | 컴포넌트 | 진입 | 표시 방식 | 문제 |
|------|----------|------|-----------|------|
| 에디터 | `UnifiedToolbar` → `MathToolbar` | 커서가 수식 안(`cursorInMath`)일 때 6개 카테고리 풀다운 | 유니코드/특수문자 조합 + monospace | 시인성 낮음, 거침 |
| 대화 패널 | `CommentEditor` → `MiniMathToolbar` | 입력창 위 7개 버튼 고정 | 동일(`ₙPᵣ`, `a/b`) | 에디터와 별개, 중복 |

- 진입 로직: `$`/`$$` 버튼은 `cursorInMath === false`일 때 노출(`insertInlineMath`/`insertBlockMath`), 수식 안이면 카테고리 풀다운으로 전환. (`UnifiedToolbar.tsx` 라인 ~1005, `EditorView.tsx`의 `isInsideMath`로 판정)
- 카테고리는 컴포넌트에 하드코딩. Phase 40 데이터 레지스트리 **미적용**.

### 12-2. 목표 구조 — 단일 패널 + 탭 (개별 풀다운 폐기)

6개 카테고리가 각각 별도 드롭다운으로 흩어진 현재 방식 대신, **하나의 패널 안에서 탭으로 카테고리 전환**한다. (결정 D6)

```
[ $ ][ $$ ]  ← 수식 밖: 진입 버튼
─────────────────────────────────────────
수식 안(cursorInMath) 또는 팔레트 열림 시:
┌─────────────────────────────────────────┐
│ [기본][미적분][기호][괄호]  [＋]  🔍검색 │  ← 탭(기본 4개) + 추가 + 검색
├─────────────────────────────────────────┤
│  ⎡a⎤  √x  x²  x₂  ←  KaTeX 하이브리드     │  ← 40×40 그리드 셀
│  ⎣b⎦                                     │
│  최근 사용: ∫  Σ  ±  ≤                    │  ← 첫 줄 최근 사용(7장)
└─────────────────────────────────────────┘
```

- 셀: 40×40px(터치 44px 근사), CSS Grid auto-fill, hover 툴팁 `{이름} ({LaTeX})`.
- 키보드: 화살표 그리드 내비, Enter/Space 삽입, Esc 닫기 (a11y 8장 준수).
- 닫기: outside-click + Esc. 삽입 후에도 유지(연속 삽입) — 단, 모바일/대화 패널은 1회 삽입 후 닫기 옵션.

### 12-3. 기본 4개 카테고리 + 확장 (결정 D4·D1)

사용 팔레트의 **기본 탭은 4개**: `기본 / 미적분 / 기호 / 괄호`. (순열조합은 `기호`에 흡수)

- 이 4개는 `lib/toolbar-defaults.ts`의 프리셋 그룹을 4개의 "표시 카테고리"로 매핑한 것.
- **확장**: 설정 모달(2단계)에서 그룹을 추가하면 사용 팔레트에 5번째 탭부터 자동 노출. 탭이 많아지면 `＋` 옆으로 가로 스크롤 또는 "더보기".
- 프리셋 선택만 한 사용자: 4개 기본 탭. 커스터마이징 사용자: 자기 그룹 수만큼 탭.

> 정리: **"기본 4개, 필요 시 확장"**(항목 3)은 Phase 40의 프리셋·그룹 시스템의 *표시 계층*으로 구현된다. 별도 데이터 구조가 아니라 `groups[]`를 탭으로 투영.


---

## 13. 에디터 ↔ 대화 패널 툴바 통일 (항목 2)

### 13-1. 핵심 난점 — 삽입 컨텍스트가 다르다

| | 에디터(`MathToolbar`) | 대화 패널(`MiniMathToolbar`) |
|---|----------------------|------------------------------|
| 호출 시점 | 이미 수식 안(`$…$`) | 일반 텍스트(마크다운) |
| 삽입 형태 | bare LaTeX (`\frac{}{}`) | `$…$` 래핑 (`$\frac{|}{}$`) |
| API | `onInsert(template, cursorOffset)` | `insertAtCursor(text, offset)` + `|` 마커 |

→ 단순히 같은 컴포넌트를 꽂으면 안 된다. **공유 본체 + 어댑터** 패턴으로 통일.

### 13-2. 공유 컴포넌트 구조

```
components/math-toolbar/
  MathSymbolPalette.tsx   ← 공유 본체 (탭·그리드·검색·최근). props: onPick(symbol), wrapInDollar
  SymbolCell.tsx          ← 하이브리드 셀 (KaTeX/유니코드 + 캐시)  ※ 설정 모달과 공유
  (데이터)  lib/math-symbols.ts · lib/toolbar-defaults.ts
```

- **단일 커서 마커 컨벤션**: 모든 기호 정의는 `latex` + `cursorOffset`(또는 `|` 마커)로 통일.
- **에디터 어댑터**: `wrapInDollar=false` → bare LaTeX 삽입(기존 `onInsert` 유지).
- **대화 어댑터**: `wrapInDollar=true` → `$…$`로 감싸 `insertAtCursor` 호출.
- 결과: `MathToolbar.tsx`, `MiniMathToolbar.tsx` **둘 다 제거**, `MathSymbolPalette` 하나로 수렴.

### 13-3. 통일 시점 (결정 D5) — 완료 (2026-06-02)

에디터를 `MathSymbolPalette`로 먼저 교체·검증(40-3) → 대화 패널(`CommentEditor`)도 같은 컴포넌트로 교체(40-4) 완료.

- `MathSymbolPalette`에 `wrapInDollar` prop 추가: 대화 패널(일반 텍스트)은 `$…$`로 감싸 삽입, 에디터(수식 안)는 bare 삽입.
- `CommentEditor`: `MiniMathToolbar` → `<MathSymbolPalette wrapInDollar onInsert={(t,o)=>editorRef.current?.insertAtCursor(t,o)} />`.
- **`components/comment/MiniMathToolbar.tsx` 삭제** (참조 0, 타입체크·컴파일 통과).
- 잔여: `components/editor/MathToolbar.tsx`는 `app/editor-test`만 참조 → 정리 보류.

> ⚠️ **KaTeX CSS 보장**: 대화 패널은 `EditorPreview` 없이 뜰 수 있어 `katex.min.css` 미로드 가능. `MathSymbolPalette.tsx` 상단에서 `import 'katex/dist/katex.min.css'` 1줄로 강제 로드.


---

## 14. 아이콘 렌더링 확정 — KaTeX 하이브리드 (항목 4)

> 이 장은 4-2절의 하이브리드 전략을 **사용 팔레트에도 동일 적용**하고, 검토 결론을 확정 기록한다. (결정 D2 = 하이브리드)

### 14-1. 검토 결론 — GO

| 관점 | 결론 |
|------|------|
| 실현가능성 | KaTeX 0.16.28 **이미 번들 포함**. 신규 의존성·번들 증가 0. `katex.renderToString` 추가 호출만. |
| 시스템 부하 | 드롭다운에 보이는 건 한 번에 ≤20개 → 열 때 ~20ms 일회성. 구조형만 렌더 + `Map` 캐시. 332개 전체 카탈로그도 lazy 시 초기 ~30ms. |
| 적합성 | 인쇄(rehype-katex) 결과와 WYSIWYG 일치. 현재 monospace 조합의 거침 해소. |

### 14-2. 하이브리드 + 폰트 통일 (결정 D3 = 예)

| 종류 | 비율 | 렌더링 |
|------|------|--------|
| 단일 유니코드 (±, ≤, ∈, ∪ …) | ~60% | **KaTeX 호출 0회** + `KaTeX_Main` 폰트 CSS 클래스만 입혀 표시 |
| 구조형 (`\frac`, `\sqrt`, `\int` …) | ~40% | `displayLatex`를 `katex.renderToString`으로 렌더 |

```typescript
// SymbolCell 내부
const cache = new Map<string, string>();             // 세션 캐시
function renderCell(sym: MathSymbol): string {
  if (!sym.displayLatex) {
    return `<span class="math-uni">${sym.symbol}</span>`;   // 유니코드 + KaTeX_Main
  }
  const hit = cache.get(sym.displayLatex);
  if (hit) return hit;
  const html = katex.renderToString(sym.displayLatex, { throwOnError: false });
  cache.set(sym.displayLatex, html);
  return html;
}
```

- 카탈로그(332개)는 `IntersectionObserver`로 뷰포트 진입 시에만 렌더(4-2절).
- 폴백(부하가 정말 클 때 — 현재 분석상 불필요): 빌드 타임 SVG 스프라이트. **채택 안 함**.


---

## 15. 확정된 결정 기록 (Decision Log, 2026-06-02)

| # | 항목 | 확정 | 비고 |
|---|------|------|------|
| D1 | 작업 범위 | **전체 Phase 40** | 프리셋·332심볼·Firestore 커스터마이징·i18n 포함 |
| D2 | 아이콘 렌더링 | **KaTeX 하이브리드** | 14장 |
| D3 | 단일 유니코드 폰트 통일 | **예 (KaTeX_Main)** | 호출 0회 유지 |
| D4 | 기본 카테고리 | **기본/미적분/기호/괄호 (4개)** | 순열조합→기호 흡수, 확장형 |
| D5 | 대화 패널 통일 | **에디터 먼저 → 대화 후속** | 같은 Phase 내 |
| D6 | 사용 팔레트 형태 | **단일 패널 + 탭** | 개별 풀다운 폐기 |
| D7 | 기호 레지스트리 신설 | **지금** | `lib/math-symbols.ts` |
| D8 | 커스터마이징·Firestore | **포함** | 5·9장 |


---

## 16. 구현 단계표 (전체 Phase 40)

| 단계 | 내용 | 주요 산출물 | 의존 |
|------|------|-------------|------|
| **40-1** | 데이터 레지스트리 | `types/toolbar-config.ts`, `lib/math-symbols.ts`(332개), `lib/toolbar-defaults.ts`(프리셋4) | — |
| **40-2** | 하이브리드 셀 | `SymbolCell.tsx` (KaTeX/유니코드+캐시), `katex.renderToString` 도입 | 40-1 |
| **40-3** | 사용 팔레트 | `MathSymbolPalette.tsx` (탭4·그리드·검색·최근), 에디터 `MathToolbar` 교체 | 40-2 |
| **40-4** | 대화 패널 통일 | `CommentEditor`가 `MathSymbolPalette` 사용, `MiniMathToolbar` 제거 | 40-3 |
| **40-5** | 설정 모달 | `SymbolSettingsModal` + `PresetSelector`/`UserGroupEditor`/`SymbolCatalog` | 40-2 |
| **40-6** | Firestore 영속화 | `useToolbarConfig.ts` (CRUD·debounce), 프리셋↔커스텀(4-5절) | 40-5 |
| **40-7** | i18n·a11y·최근사용 | ko/en + ja/zh, role=grid, 최근 20개 FIFO | 40-3·40-6 |

각 단계 완료 시 `CLAUDE.md`/`roadmap.md` 갱신, Cmd+Shift+R 하드 리프레시 검증.


---

## 17. 남은 확인 사항 (구현 착수 전 점검)

- [ ] **332개 기호 데이터 출처**: 설계서는 332개를 전제하나 실제 레지스트리는 미작성. 카테고리 A~V·등급·displayLatex를 어디서 가져올지(수작업 vs 기존 `latex-completions.ts`/`MathToolbar` 시드 확장).
- [ ] **기존 데이터 마이그레이션**: 현재 `MathToolbar`(6카테고리)·`MiniMathToolbar`(7버튼) 사용자 습관 → 기본 프리셋에 누락 없는지 매핑 검증.
- [ ] **`SPECIAL_CHAR_GROUPS`**(`UnifiedToolbar.tsx ~216`)·`MathSnippetMenu` 등 다른 삽입 경로와의 중복/충돌 정리.
- [ ] **대화 패널 삽입 위치**: 입력창 위 고정 vs 토글 버튼(공간 제약). 현재 `MiniMathToolbar`는 항상 노출.
- [ ] **모바일 레이아웃**: 40×40 그리드 + 탭의 좁은 화면 동작.


---

## 18. 데이터 출처 & 구축 파이프라인 (선행 연구 결과, 2026-06-02)

> deep-research 검증(23/25 주장 confirmed). 신뢰성 최우선 원칙에 따라 **재배포 가능한 1차 출처**만 채택.

### 18-1. 검증된 출처 (척추 2개 + 보강)

| 출처 | 제공 | 라이선스 | 접근 | 역할 |
|------|------|----------|------|------|
| **KaTeX `src/symbols.js`** (647 `defineSymbol`) | 유니코드 ↔ LaTeX ↔ 수학클래스(rel/bin/op/open/close/punct/ord/accent…). 정의됨 = **KaTeX 렌더 보장** | **MIT** | `node_modules/katex/src/symbols.js` (로컬) | **본체(척추 1)** |
| **KaTeX `src/functions/`** (46파일) | 구조형 명령(`\frac`,`\sqrt`,`\int`,`\sum`…) | **MIT** | 로컬 | **본체(척추 1)** |
| **unicode-math-table.tex** (~2,448 엔트리) | 코드포인트·LaTeX·math-class·영문명 크로스워크 | **LPPL 1.3c** | CTAN/GitHub | **참조 전용(척추 2)** — 영문명 보강·검증. *재배포 안 함* |
| The Comprehensive LaTeX Symbol List | 25,000+ 초집합 | LPPL 1.3c | CTAN | KaTeX 미지원 기호 참고용(선택) |
| W3C `unicode.xml` / MathML entities | 코드포인트별 TeX 등가·명명 엔티티 | W3C | w3.org | 보조 |

**라이선스 전략(오픈소스 대비):** 데이터셋 본체는 **KaTeX `symbols.js`(MIT)로만** 생성하고, unicode-math(LPPL)는 *영문명 채우기·교차검증에만 참조*하여 산출물에 그 텍스트를 재배포하지 않는다 → LPPL 의무(개명·변경기록·원본제공) 회피, 라이선스 청정. 산출물 헤더에 KaTeX MIT 귀속 표기.

### 18-2. 분류 체계 (이중축)

- **축 A — math-class (구조적):** KaTeX `symbols.js`의 atom class를 그대로 사용(rel/bin/op/open/close/punct/ord/accent…). **공짜·정확.**
- **축 B — 분야 (대수/해석/기하/집합·논리/확률·통계/벡터·선형대수/이산…):** **어떤 출처에도 기호 단위로 존재하지 않음** → 우리가 직접 부여. (MSC 2020은 너무 거칠어 부적합. KaTeX 기능그룹을 분야로 쓰는 안은 검증에서 0-3 기각됨.)
- 사용 팔레트의 "기본 4개 탭"(기본/미적분/기호/괄호, 12-3절)은 축 B를 사용자 표시용으로 묶은 것.

### 18-3. 미해결 신뢰성 갭 (후속 연구/수작업 필요)

선행 연구가 **미검증으로 명시**한 한국 특화 영역 — 별도 처리 필요:

1. **교육과정 등급 매핑**: 기호→학년의 인용 가능한 표는 **부재**. 교육과정 문서는 성취기준 서술이라 기호 목록이 아님 → 휴리스틱/수작업으로 부여하고 근거 문서만 인용.
2. **한국어 이름**: 대한수학회 수학용어집(kms.or.kr/mathdict)이 권위 출처이나 라이선스·기계가독성 미확인 → ~300–500개 수작업 큐레이션(KMS 인용) 유력.
3. 다중 표기(한국식 ⊂ vs 국제 ⊆ 등): `variants[]` 필드로 모델링(5-3절). ISO 80000-2:2019 참조.

### 18-4. 구축 파이프라인 (확정)

1. **추출**: `node_modules/katex/src/symbols.js` 파싱 → `{unicode, latex, mathClass}` × ~647. `src/functions/`에서 구조형 명령 추출.
2. **렌더 검증**: 각 latex를 `katex.renderToString`으로 시도 → `katexSupported` 플래그 확정(support_table 문서는 수기관리라 신뢰하지 않고 실렌더로 판정).
3. **보강**: unicode-math-table.tex를 코드포인트로 조인 → 영문명 후보(참조용, 재배포 X).
4. **분야 부여(축 B)**: 수작업/규칙 — 본 프로젝트 큐레이션.
5. **한국어 이름·등급**: KMS 인용 수작업 큐레이션(18-3).
6. **산출**: `lib/math-symbols.ts` (또는 JSON + 빌드) — 5-3절 `MathSymbol` 스키마.

### 18-5. 골격 시드 — 생성 완료 (2026-06-02)

- **스크립트**: `scripts/extract-katex-symbols.cjs` (KaTeX MIT 소스만 사용, unicode-math 미사용)
- **산출**: `lib/data/katex-symbols.seed.json` (152KB)
- **결과**:
  - 단일 기호 **608개** 추출(중복 제거) — math 524 / text 84
  - **math 모드 524개 전부 `katex.renderToString` 렌더 검증 통과** (실패 0). text 전용 31개는 math 모드 비렌더로 `katexSupported:false` 정확 표기.
  - 구조형 오버레이 **28개**(`\frac`,`\dfrac`,`\sqrt`,`\int`,`\sum`,`\binom`,행렬,cases… `displayLatex` 포함) 전부 렌더 통과.
  - 각 레코드 필드: `latex / unicode / mathClass(rel·bin·op-token·open·close·punct·accent-token·ord) / mode / font / katexSection / katexSupported`
  - mathClass 분포: rel 238, textord 176, bin 69, mathord 34, accent-token 24, op-token 20, close 15, open 13, spacing 9, inner 6, punct 4
- **의의**: 설계서가 전제한 332개를 상회하는 **약 552개(math 524 + 구조형 28) 렌더 보장 시드**를 라이선스 청정하게 확보. 재실행 시 KaTeX 버전 업그레이드에 자동 추종.

### 18-6. 고빈도 큐레이션 v1 — 완료 (2026-06-02)

자동 시드(`latex/unicode/mathClass/katexSupported`) 위에 사람이 `field/tier/name(ko·en)`을 얹었다.

- **타입**: `types/toolbar-config.ts` (MathSymbol·PaletteCategory·ToolbarConfig·MathField·Tier)
- **빌더**: `scripts/build-curated-symbols.cjs` (시드에서 latex/unicode/cursorOffset 자동 결합 + 전수 재렌더 검증)
- **산출**: `lib/math-symbols.ts` (자동 생성, DEFAULT_CATEGORIES + CURATED_SYMBOLS + FIELD_TO_CATEGORY)
- **결과**: **74개**, **74/74 렌더 검증 통과**, 타입체크 통과. 분포 — 기본 14 / 미적분 12 / 기호 41 / 괄호 7
- **다국어/표기**: ko·en 완비. 한국 교과서 표기는 `variants`로 명시(예: `≒ \fallingdotseq`, `⊂` 부분집합 용법, `\neq`/`\notin`은 KaTeX 매크로라 unicode 오버라이드).
- **ko 이름 주의**: 현재는 통용 표준 용어. **대한수학회 수학용어집 대조는 후속**(§18-3 갭).

### 18-7. 전체 큐레이션 v2 — 완료 (2026-06-02)

74개 → **552개 전체**로 확장. 멀티에이전트 워크플로(15배치 병렬)로 `field/ko/en/tier/needsReview` 부여 → 시드와 병합.

- **워크플로**: `scripts/gen-curation-workflow.cjs`(데이터 내장 스크립트 생성) → `phase40-symbol-curation`(15에이전트) → `scripts/merge-curation.cjs`(시드 조인)
- **산출**: `lib/data/curated-full.json`(552), `lib/math-symbols.ts` 재생성(`scripts/build-symbols.cjs`)
  - `ALL_SYMBOLS`(552, 레지스트리) / `CURATED_SYMBOLS`(201, 팔레트 표시 = tier≤2 & !needsReview)
- **결과**: 미매칭 0. **needsReview 288개(52%)** — 대부분 tier 3·4 obscure. tier 분포 1:97/2:115/3:123/4:217.
- **팔레트 7탭**(설계 §12-3 확장): 기본26 / 미적분27 / 관계20 / 집합·논리45 / 그리스32 / 기하·기타28 / 괄호23. 탭 행은 wrap.

### 18-8. 남은 후속 (신뢰성 강화)

- **needsReview 288개 KMS 대조**: 대한수학회 수학용어집으로 한국어명 검증 → worklist는 `curated-full.json`에서 `needsReview:true` 필터.
- **교육과정 등급(tier) 근거 강화**: 현재 휴리스틱 → 2022 개정 교육과정 수학과 문서 대조.
- ja/zh 이름.
- KMS 수학용어집 라이선스·기계가독성 확인(후속 연구).
- 팔레트 노출 정책(현재 tier≤2 & !needsReview) 튜닝 / 설정 화면 카탈로그(§4)에서 전체 552 노출.

---

## 19. 개인화(커스터마이징) 기반 — 40-F1 완료 (2026-06-02)

결정: 이번 반복 = **기반 + 프리셋 선택까지**. 프리셋 그룹은 552 데이터에서 자동 생성. 로그아웃 시 기본 7탭 유지.

### 19-1. 추가된 것

| 파일 | 역할 |
|------|------|
| `lib/toolbar-defaults.ts` | 4개 프리셋(중·고/대학기초/대학전공/전체) → 기본 ToolbarConfig 자동 생성(tier·field). 미리보기 id |
| `lib/toolbar-config.ts` | Firestore CRUD `users/{uid}/toolbar_config/default` |
| `hooks/useToolbarConfig.ts` | 로드/저장(모듈 캐시), `applyPreset`, 로그아웃 폴백 |
| `lib/katex-render.ts` | KaTeX 렌더 캐시 공유 헬퍼(팔레트·모달 공용) |
| `components/editor/settings/SymbolSettingsModal.tsx` | 1단계 프리셋 선택 모달(미리보기·적용·로그인 안내). 2단계는 후속 |
| `MathSymbolPalette` | config.groups를 탭으로 읽음(없으면 기본 7탭) + ⚙ 진입 + 검색 풀 확장(config 시 전체 552) |

### 19-2. 동작
- 로그인 + 프리셋 적용 시: Firestore 저장 → 팔레트 탭이 그 그룹으로 전환.
- 미적용/로그아웃: 기본 7탭(CURATED_SYMBOLS).
- 프리셋 기호 수: 중·고 97 / 대학기초 212 / 대학전공 335 / 전체 552(katexSupported 기준 가변).

### 19-3. ⚠️ 배포 필요
- **`firestore.rules`에 `toolbar_config` 규칙 추가** → 규칙은 하위 컬렉션 비상속이라 필수. **`firebase deploy --only firestore:rules` 배포 전에는 저장이 권한거부로 실패**.

### 19-4. 다음 (40-F2)
- 2단계 세부 편집: `UserGroupEditor`(그룹 추가/이름변경/삭제/dnd 정렬) + `SymbolCatalog`(552 카탈로그 검색·등급뱃지·클릭 추가) + `SymbolCell`.
- 최근 사용 기호(`recentSymbolIds`) 자동 관리.


---

## 20. 2단계 세부 편집 — 40-F2 완료 (2026-06-02)

계획서 §4(2단계 편집)를 구현. 모달이 1단계(프리셋)↔2단계(편집) 전환.

### 20-1. 추가된 것

| 파일 | 역할 |
|------|------|
| `components/editor/settings/SymbolCell.tsx` | 공유 셀 — KaTeX 렌더 + 등급 뱃지(색+점) + ✓(이미 추가) + hover × 삭제. 팔레트도 이 셀 사용 |
| `components/editor/settings/SymbolCatalog.tsx` | 우측 — 552 카탈로그(분야 섹션), 검색, 등급 뱃지, ✓, 클릭 추가 |
| `components/editor/settings/UserGroupEditor.tsx` | 좌측 — 그룹 선택/추가(≤12)/이름변경/삭제(+Undo 5초)/▲▼ 정렬/기호 × 제거 |
| `SymbolSettingsModal` | 2단계 추가: draft 편집 → [완료] 저장. "직접 편집 →" 활성화 |
| `lib/toolbar-defaults.ts` | FIELD_ORDER·FIELD_LABELS export |

### 20-2. 동작 (§4-4 클릭 기반)
- 좌측 그룹 선택 → 우측 카탈로그 기호 클릭 → 선택 그룹에 추가(중복 무시, ✓ 표시).
- 편집 시 `preset=null`(커스텀)로 전환. [완료] → `save(draft)` → Firestore + 팔레트 즉시 반영.
- 시작점: 기존 config 있으면 복제, 없으면 `university-basic` 프리셋.

### 20-3. 계획 대비 차이 / 후속
- **그룹 재정렬**: dnd-kit 대신 ▲▼ 버튼(1차). dnd는 폴리시 항목.
- **카탈로그 성능**: 현재 524개 일괄 렌더(KaTeX 캐시). IntersectionObserver lazy(§4-2)는 후속 최적화.
- **남음**: 최근 사용 기호(§7), i18n ja/zh(§6), a11y 그리드 내비(§8), 다른 프리셋 선택 시 초기화 확인(§4-5).

### 20-4. 편집 피드백 반영 (2026-06-02)
1. **누락 연산자 보강**: `\log \ln \lg \exp \lim \sin \cos \tan …` 등 함수명은 symbols.js가 아닌 op.js에 있어 빠져 있었음. `scripts/build-supplement.cjs` → `lib/data/curated-supplement.json`(32개, 렌더 검증)로 추가. 새 분야 **`function`(함수)** 신설 → 미적분 탭/카탈로그 함수 섹션. ALL_SYMBOLS 552→**584**. id는 553+ 부여(기존 불변, §1).
2. **그리스 알파벳순**: `build-symbols.cjs`에서 그리스 분야를 α β γ … ω, Γ Δ … Ω 순으로 정렬(자기 위치 내 재배열, id 불변).
3. **그룹 내 기호 dnd 정렬**: `UserGroupEditor`에 dnd-kit(`SortableContext`/`useSortable`) 적용 — 그룹별 기호를 드래그로 재정렬.

### 20-5. 카탈로그 20개 카테고리 재구성 (2026-06-02)
첨부 문서(*Comprehensive LaTeX Symbol List* 요약, 20 카테고리) 기준으로 설정 모달 카탈로그를 재분류.
- `scripts/catalog-classify.cjs`: 명령어 명시 매핑 + mathClass/field/패턴 규칙 → 각 기호에 `catalogCategory`(1~20) 부여. `build-symbols.cjs`가 적용·`CATALOG_CATEGORIES` export.
- `SymbolCatalog`: field 섹션 → **20개 카테고리 섹션**으로 그룹화(빈 카테고리는 숨김).
- 글꼴 명령(`\mathbb{} \mathcal{}` 등 9개)·수 체계(ℕℤℚℝℂℙℍ) 보강 → 카탈로그 수학 글꼴/수 체계 채움. ALL_SYMBOLS 593.
- 분포(1~20): 56·14·47·24·55·42·50·7·37·66·45·11·5·24·5·25·27·20·9·24.
- 참고: 팔레트 빠른 탭은 그대로 field 기반 7탭. 20 카테고리는 카탈로그(세부 편집) 전용.
