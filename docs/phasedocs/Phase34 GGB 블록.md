# Phase 34: GGB(GeoGebra) 블록 — 동적 기하·그래프 임베드

> **목표**: `.ggb` 파일을 업로드해 학생이 직접 점을 끌어보거나 슬라이더를 움직이며 도형/함수를 탐구할 수 있는 인터랙티브 블록을 추가한다. SVG가 못 다루는 "동적 변화"를 채운다.

**문서 작성일**: 2026-05-29 **예상 규모**: 중간 (Phase 32와 유사 또는 약간 작음)

**전제**: Phase 32(SVG 블록 시스템)의 인프라(그림 종류 선택 모달, 활성화 UX, 초기뷰 저장 패턴)를 최대한 재사용.

---

## 1. 배경 및 동기

### 현재 상태

- Phase 32에서 그림 종류 선택 모달에 GGB 옵션을 **비활성** 상태로 자리만 잡아둠 (`disabled: true`)
- SVG는 정적 그림에 최적이지만, "점 P를 끌어 삼각형이 직각이 되는 순간 관찰" 같은 동적 탐구는 불가능
- 한국 수학 교육에서 GeoGebra 활용도가 높음 — 교사들이 이미 `.ggb` 자료를 보유

### 개선 이유

- 함수의 매개변수 변화에 따른 그래프 변형, 기하 도형의 동적 조작, 슬라이더로 케이스 탐구 등 SVG로 표현 불가능한 학습 경험
- GeoGebra의 `deployggb.js` API가 성숙해서 외부 의존이 작음 (CDN 한 줄)
- Phase 32 인프라 재사용으로 구현 비용 절감

---

## 2. 결정 사항 (Phase 32와 다른 점 위주)

| 항목 | 결정 | 비고 |
|------|------|------|
| 렌더링 방식 | `deployggb.js` 인라인 임베드 (iframe X) | 통제력·통일성 |
| 라이브러리 로딩 | **클릭 활성화 시점에 lazy load** | 5MB 부담 최소화. SVG 활성화 UX와 일관 |
| 비활성 상태 표시 | 단순 빈 박스 + "▶ GGB 활성화" 안내 | poster 이미지는 후속 작업 |
| GGB UI 옵션 | 고정값: 툴바·메뉴·수식창 false, shift-drag-zoom true, 우클릭 false | 단순화. 필요시 후속 토글 |
| 초기 뷰 저장 | `getCoordSystem` / `setCoordSystem` — SVG 패턴 재사용 | 필드: `ggb_initial_coords?: {xMin,xMax,yMin,yMax}` |
| 활성화 UX | SVG와 동일 (클릭 활성, 외부 클릭 비활성, FolderView 그림자) | 다중 인스턴스 페이지 부담 최소화 필수 |
| 미리보기/썸네일 | 인스턴스 X, 정적 빈 박스만 | 메모리·CPU 보호 |
| 인쇄 | 이번 Phase는 "인쇄 미지원" 빈 박스 | PNG export 자동화는 후속 Phase |
| 라이선스 | 우선 진행, 오픈소스 공개 전 LICENSE 명시 | GeoGebra 영리 배포 시 별도 라이선스 |
| 그림 종류 모달 | GGB 옵션 활성화 (`disabled: false`) | accept=".ggb" |

---

## 3. 작업 범위

### Step 1: Block 타입 확장

```typescript
// types/problem.ts
export interface GgbInitialCoords {
  xMin: number; xMax: number;
  yMin: number; yMax: number;
}

interface Block {
  type: 'text' | 'heading' | ... | 'svg' | 'ggb';
  ggb_initial_coords?: GgbInitialCoords | null;
  ggb_height?: number;  // 기본 350
  // raw_text: Firebase Storage URL (.ggb 파일)
}
```

### Step 2: `.ggb` 업로드 (Storage)

```typescript
// lib/storage.ts
export async function uploadGgb(file: File, problemId: string): Promise<string>;
```

- 확장자 `.ggb` 검증 (zip 무결성은 GGB 로드 시 자연스레 확인됨)
- Storage 경로: `problems/{problemId}/{timestamp}-{baseName}.ggb`
- ContentType: `application/vnd.geogebra.file` 또는 `application/octet-stream`
- Sanitize 불필요 (zip 바이너리, 코드 실행 위험 없음 — 단, deployggb.js가 안전한 sandbox에서 실행)

### Step 3: `deployggb.js` 로더

```typescript
// lib/ggb-loader.ts
let promise: Promise<void> | null = null;

export function loadGGB(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('SSR');
  if ((window as any).GGBApplet) return Promise.resolve();
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.geogebra.org/apps/deployggb.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { promise = null; reject(new Error('GGB load failed')); };
    document.head.appendChild(script);
  });
  return promise;
}
```

- 모듈 레벨 캐시 (한 번만 로드)
- 실패 시 재시도 가능하도록 promise 캐시 해제

### Step 4: `GgbViewer` 컴포넌트

```
components/viewer/GgbViewer.tsx
```

**Props**:
- `url`: .ggb URL
- `initialCoords?: GgbInitialCoords | null`
- `height: number`
- `interactive: boolean`
- `onSaveInitialView?: (coords: GgbInitialCoords) => void`
- `onResetView?: () => void`  // 저장된 초기뷰 삭제

**구조** (SvgViewer와 동일 패턴):
- 비활성 상태: 회색 박스 + "▶ GeoGebra 활성화" 안내 + (파일명 또는 메타)
- 클릭 → 활성화 → `loadGGB()` → applet 생성 → DOM inject
- 활성 시: 외부 클릭 또는 재클릭 시 비활성 → applet.remove() → 인스턴스 정리
- 외곽 그림자는 SVG와 동일
- 우상단 floating 버튼 (편집모드만):
  - 📌 초기뷰 저장 (현재 좌표영역 capture)

**applet 설정 (고정값)**:
```typescript
const PARAMS = {
  appName: 'classic',
  width: containerWidth,
  height: containerHeight,
  showToolBar: false,
  showAlgebraInput: false,
  showMenuBar: false,
  showResetIcon: true,         // 우상단 리셋 (저장된 초기뷰로 복귀)
  enableLabelDrags: false,
  enableShiftDragZoom: true,
  enableRightClick: false,
  showZoomButtons: true,       // 줌 + / − 버튼
  filename: url,
  appletOnLoad: (api) => { /* setCoordSystem(initialCoords) 등 */ },
};
```

**핵심 처리**:
- applet 인스턴스는 ref에 저장 — unmount/비활성 시 `applet.remove()` 호출
- `initialCoords` 있으면 `appletOnLoad`에서 `api.setCoordSystem(xMin, xMax, yMin, yMax)` 호출
- 저장 버튼: `api.getCoordSystem()` → 결과를 `{xMin, xMax, yMin, yMax}`로 변환

### Step 5: 그림 종류 모달 GGB 활성화

```typescript
// components/editor/ImageTypeSelectModal.tsx
const OPTIONS = [
  { kind: 'raster', ... },
  { kind: 'svg', ... },
  { kind: 'ggb', label: 'GeoGebra', desc: '동적 기하·그래프 (.ggb)' },  // disabled 제거
];
```

`ACCEPT_BY_KIND.ggb`는 이미 `.ggb`로 정의되어 있으므로 그대로.

### Step 6: EditorView 통합

`MediaBlockContent`에 ggb 블록 분기 추가 — SVG 블록 분기와 거의 동일 구조:
- 빈 상태: 파일 업로드 진입점
- 채워진 상태: GgbViewer + 높이 슬라이더 + 그림 변경 버튼

`handleBlockMediaUpload` 확장:
```typescript
if (kind === 'ggb') {
  const url = await uploadGgb(file, pid);
  setCurrentBlocks(prev => prev.map(b =>
    b.id === blockId
      ? { ...b, type: 'ggb', raw_text: url, ggb_initial_coords: null }
      : b
  ));
}
```

핸들러 추가: `handleSaveGgbInitialView`, `handleGgbHeightChange`.

저장 로직에 `ggb_initial_coords`, `ggb_height` 포함.

### Step 7: ProblemView / FolderView / PrintableContent 분기

- **ProblemView**: GgbViewer interactive=true
- **EditorView 미리보기**: 정적 박스만 (interactive=false → 인스턴스 X, "GGB 블록 — 편집창에서 조작" 안내)
- **FolderView 썸네일**: 정적 박스만
- **PrintableContent**: 정적 박스 + "GGB 인쇄 미지원" 또는 파일명만

### Step 8: BLOCK_TYPES에서 ggb 제외

SVG와 마찬가지로 그림 종류 모달이 유일한 진입점. 사용자가 드롭다운에서 직접 선택 불가.
기존 ggb 블록이 있으면 select 옵션에 자기 자신만 노출 (값 보존).

### Step 9: roadmap 업데이트

Phase 34 항목 추가.

---

## 4. 파일 구조 (신규/수정)

```
components/
├── viewer/
│   └── GgbViewer.tsx          # (신규) GGB 임베드 + 활성화 UX
├── editor/
│   ├── ImageTypeSelectModal.tsx  # (수정) GGB disabled 해제
│   └── EditorView.tsx         # (수정) ggb 분기, 핸들러 추가
├── problem/
│   ├── ProblemView.tsx        # (수정) ggb 렌더 분기
│   └── FolderView.tsx         # (수정) ggb 썸네일 분기
└── print/
    └── PrintableContent.tsx   # (수정) ggb 정적 박스

lib/
├── storage.ts                 # (수정) uploadGgb 추가
├── ggb-loader.ts              # (신규) deployggb.js lazy loader
├── pdfPrint.tsx               # (수정) PrintBlock 타입 확장
└── firestore.ts               # (수정) duplicate 시 ggb 필드 포함

types/
└── problem.ts                 # (수정) 'ggb' 타입, ggb_initial_coords, ggb_height
```

---

## 5. Firestore 스키마 변경

| 필드 | 타입 | 적용 블록 |
|------|------|----------|
| `ggb_initial_coords` | `{xMin, xMax, yMin, yMax} \| null` | `ggb` |
| `ggb_height` | `number` (기본 350) | `ggb` |
| `raw_text` (재사용) | string (Storage URL) | `ggb` |

기존 svg 필드는 변경 없음.

---

## 6. 의존성 변경

- **추가 없음** (deployggb.js는 CDN에서 동적 로드, npm 패키지 X)
- 단, CSP가 적용된 환경이라면 `script-src https://www.geogebra.org` 허용 필요 — Vercel 기본은 CSP 없음, 문제 없음

---

## 7. 구현 순서

| 순서 | 작업 | 선행 조건 |
|------|------|----------|
| 7-1 | `Block` 타입 확장 (`'ggb'`, `ggb_initial_coords`, `ggb_height`) | 없음 |
| 7-2 | `lib/ggb-loader.ts` — 스크립트 lazy loader | — |
| 7-3 | `lib/storage.ts` — `uploadGgb` | — |
| 7-4 | `GgbViewer.tsx` — 활성화 UX + applet inject + cleanup | 7-2 |
| 7-5 | `ImageTypeSelectModal` — GGB 활성화 | — |
| 7-6 | `EditorView` MediaBlockContent ggb 분기 + 핸들러 + 저장 로직 | 7-3, 7-4 |
| 7-7 | `EditorView` 미리보기 패널 ggb 정적 박스 분기 | — |
| 7-8 | `ProblemView` ggb 분기 (interactive) | 7-4 |
| 7-9 | `FolderView` 썸네일 분기 (정적 박스) | — |
| 7-10 | `PrintableContent` + `pdfPrint.tsx` PrintBlock 확장 (정적 박스) | — |
| 7-11 | `lib/firestore.ts` duplicate 경로 ggb 필드 포함 | 7-1 |
| 7-12 | BLOCK_TYPES에서 ggb 제외 + 기존 ggb 블록 옵션 보존 | — |
| 7-13 | 테스트: 업로드 → 활성화 → 슬라이더 조작 → 초기뷰 저장 → 미리보기 정적 → 새로고침 복원 | 전체 |
| 7-14 | roadmap.md Phase 34 추가 | — |

---

## 8. 알려진 함정 (Known Pitfalls)

### 8-1. `deployggb.js` 글로벌 변수
`window.GGBApplet`을 노출. 두 번 로드 방지 위해 모듈 레벨 promise 캐시 필수.

### 8-2. applet inject DOM ID 충돌
`applet.inject('container-id')` 호출 시 div ID가 필요. 블록마다 unique ID (nanoid) 생성. 한 페이지에 같은 GGB 블록이 두 번 나올 일은 없지만 안전하게.

### 8-3. 비동기 초기화
`appletOnLoad(api)` 콜백 안에서만 `setCoordSystem` 같은 API 호출 가능. 그 전엔 `null`. ready 플래그 관리.

### 8-4. 인스턴스 메모리 누수
블록 unmount, 비활성 전환, 페이지 이탈 시 `applet.remove()` 또는 컨테이너 DOM 비우기 필수. 5MB 메모리가 누적되면 페이지가 느려짐.

### 8-5. SSR
`window` 의존. 컴포넌트는 `'use client'`, 스크립트 로드는 `useEffect` 내부에서만.

### 8-6. 인쇄 한계
`window.print()`로는 GGB iframe 내부가 거의 안 찍힘. 이번 Phase는 인쇄 미지원 박스. 후속에서 `getPNGBase64()` 자동 export 검토.

### 8-7. 모바일 5MB 로딩
3G/저속 환경에서 5MB 다운로드는 체감 느림. 로딩 인디케이터 + "처음 한 번만 로드됨" 안내 권장.

### 8-8. iframe 내부 키보드 캡처
GGB iframe이 일부 키 이벤트를 캡처할 수 있음. 활성화 상태에서만 인스턴스 띄움으로 영향 최소화.

### 8-9. `enableShiftDragZoom`과 외부 활성화 UX 충돌
GGB의 Shift+드래그 줌은 GGB 활성 시에만 동작 — 외부 SvgViewer-style 활성화 래퍼와 무관. 사용자에게 "활성화 후 GGB 자체 도구 사용" 안내 필요.

### 8-10. 좌표계 저장/복원 정밀도
`getCoordSystem()`이 반환하는 값은 부동소수 — JSON 저장/로드 과정에서 미세 오차 있을 수 있으나 시각적으로는 무시 가능.

---

## 9. 보류 항목 (이번 Phase 범위 외)

- **PNG poster 자동 생성**: GGB API의 `getPNGBase64()`로 인쇄·썸네일 개선
- **GGB UI 옵션 토글**: 블록별로 툴바·메뉴·슬라이더 노출 여부 편집
- **GGB 내부 객체 제어**: `api.setValue("a", 3.5)` 같은 프로그래밍 인터랙션
- **인쇄용 PNG 자동 출력**
- **GGB 파일 직접 편집** (Mathory 안에서 GGB 도형 그리기) — 별도 큰 Phase

---

## 부록 A: deployggb.js 핵심 API

| API | 용도 |
|-----|------|
| `new GGBApplet(params, true)` | 인스턴스 생성 |
| `applet.inject('container-id')` | DOM에 inject |
| `applet.remove()` | 인스턴스 정리 |
| `appletOnLoad(api)` | ready 콜백, 이후 모든 API 사용 가능 |
| `api.getCoordSystem()` | 현재 보이는 좌표 영역 |
| `api.setCoordSystem(xMin, xMax, yMin, yMax)` | 좌표 영역 설정 |
| `api.getPNGBase64(scale, transparent, dpi)` | PNG export (후속) |
| `api.setSize(w, h)` | 캔버스 크기 변경 |
| `api.evalCommand(cmd)` | 명령 실행 (후속) |

## 부록 B: 라이선스 메모

- GeoGebra Apps는 비상업적 사용 무료 (학교·개인)
- 상업적 배포 시 별도 라이선스 협의 필요
- Mathory가 오픈소스 공개되더라도 deployggb.js는 CDN에서 받아오는 외부 자산 — 사용자가 GGB 약관에 동의하는 것으로 간주됨
- 오픈소스 공개 전 README/LICENSE에 "GeoGebra 사용 관련 별도 약관" 명시 권장
- 관련 참고: https://www.geogebra.org/license
