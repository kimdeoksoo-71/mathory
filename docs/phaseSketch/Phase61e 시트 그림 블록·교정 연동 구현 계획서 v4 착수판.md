# Phase 61e — 시트 가져오기 × 그림 블록 · 교정 연동 (v4 착수판)

> 계보: v1(web 타당성) → v2(CLI 실측 교차검토 — 정정 C1~C9 · 실측 N1~N10 · 결정 D15~D20)
> → v3(web 재검증 — Z1~Z8) → **v4 = 착수판(구현 사양)**. **구현은 이 문서만 본다.**
> 인용 원천: mathory `b3a9612` · gas-project-latex-convert `4dfa3aa` · 「문제 검토」 시트 2026-08-30.
> 덕수 선행 작업(Drive API 활성화 · `IMAGE_FIG` 폴더 SA 공유 · `AUDITION_FIG_FOLDER_ID` 등록) **완료 보고됨**.

---

## 0. 한 줄

**Data_DS 본문에 문자열로만 남아 있는 `\includegraphics{…}`를 Drive에서 실물로 받아 image 블록으로
바꾸고, 가져오는 김에 편집창의 결정적 자동 수정을 한 번 태운다.**
서버 1개 신설(읽기 프록시) · Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 블록 타입 union 0 · 전처리 0.

⚠ **자동 수정은 오늘 `\includegraphics`를 파괴한다**(v2 C2, v3 Z1에서 재현). 그래서 **1번 커밋이
`lib/proofread.ts` 보호 규칙**이고, 그 전에 나머지를 만들면 안 된다.

---

## 1. v3에서 바뀐 것 (v3 → v4)

v3의 Z1~Z8을 전부 채택한다. 그중 **Z2는 채택하되 v3의 서술 하나가 틀렸다** — 아래 Z2′.

### Z2′. ⚠ **`storage.rules`는 0건이 아니다** — 현행 규칙에서 delete는 **거부된다**

v3 Z2: *"`storage.rules:13`은 `write`만 규정하므로 delete가 write에 포함된다 → 규칙 변경 0."*

전반부는 맞다(Storage 규칙에서 `write` = create·update·**delete**). 그런데 현행 규칙은
`write` 조건에 **`request.resource`를 읽는다**:

```
allow write: if request.auth != null
  && request.resource.size < 10 * 1024 * 1024
  && ( request.resource.contentType.matches('image/.*') || … );
```

**delete 요청에는 `request.resource`가 없다**(쓰이는 객체가 없으므로 null). null의 `.size`를 읽으면
조건이 오류로 평가되어 **거부**된다. 즉 D7′의 `deleteObject`는 **규칙 그대로면 100% 실패하는
죽은 코드**가 된다 — best-effort라 조용히 실패하므로 "동작하는 줄 알았는데 아무것도 안 지워지는"
가장 나쁜 형태다.

⇒ **규칙을 세 갈래로 쪼갠다**(→ 결정 **D7″**):

```
match /problems/{problemId}/{fileName=**} {
  allow read;
  allow create, update: if request.auth != null
    && request.resource.size < 10 * 1024 * 1024
    && ( … 기존 contentType 조건 그대로 … );
  allow delete: if request.auth != null;
}
```

⚠ **규칙 배포는 덕수가 하고, 배포가 코드보다 먼저**다(Phase 55·51 전례 — 규칙 선배포).
배포 전에 5번 커밋을 올리면 그 사이의 실패 롤백이 고아를 남긴다(지금과 같은 상태이므로 회귀는 아니다).

⚠ v3 §4의 **수정 목록에 `lib/storage.ts`도 빠져 있다** — `deleteObject`를 부를 곳이 필요하다(§3-6).

### v3에서 그대로 가져오는 것

| v3 | 반영 |
|---|---|
| **Z1** `test:proofread`·`tests/proofread.test.mjs`(17케이스)는 **이미 있다** | 실측 확인(`package.json:17`, 케이스 17). v2의 "신설"은 오기 → **증설**로 정정 |
| **Z3** O-1 닫힘: 선택지 셀 안 `\includegraphics` **0건** | **D3′ (i) 미구현**. 대신 choices raw_text에 `\includegraphics`가 있으면 경고 + 그 블록 자동 수정 제외 |
| **Z4** O-2 닫힘: B열 헤더 = `problem` | `EXPECTED_HEADERS.problem = 'problem'` **추가** |
| **Z5** O-3 닫힘: Data_DS 39행 중 10행(26%)이 그림 문항, 파일 19개 | D16(지연 로딩) 유지 |
| **Z6** O-4·O-5 닫힘 | GAS·시트 사실은 v1의 web 실측으로 확정 |
| **Z7** 문구 정정(전지 → 정지 등) | 이 문서에 반영 |
| **Z8** D15 주의 2건 | §3-1에 규약으로 명문화 |

---

## 2. 확정 결정 (D1~D21)

v2 §3의 D1~D20을 **그대로 승계**한다. v4에서 손댄 것만 적는다.

| # | v4 확정 |
|---|---|
| **D3′** | (i) 선택지 **셀 안** 인라인 그림 = **구현하지 않는다**(Z3, 실측 0건). (ii) 선택지 **뒤** 꼬리 그림 = choices 블록 다음의 독립 image 블록(불변). 추가: choices raw_text에 `\includegraphics`가 있으면 **경고 배지 + 그 블록만 자동 수정 제외** |
| **D7″** | 롤백 시 방금 올린 Storage 객체를 best-effort `deleteObject`. **`storage.rules`를 `create,update` / `delete`로 분리하고 덕수가 선배포**(Z2′). 실패는 집계만 하고 멈추지 않는다 |
| **D13** | `SHEET_COL.problem = 1` **+ `EXPECTED_HEADERS.problem = 'problem'`**(Z4) |
| **D15** | 하니스는 **기존 `test:proofread` 증설**(Z1). 보호 규칙과 트레이드오프는 §3-1 |
| **D21**(신규) | `![alt](https://cdn.mathpix…)` 형태(패치 3 미적용 잔재)는 **분할하지 않고 경고만 남긴다** | 

**D21 근거**: 그 형태는 오늘도 `EditorPreview`가 마크다운 이미지로 **그대로 렌더한다**(외부 핫링크).
분할하려면 Drive가 아닌 **외부 URL 다운로드 경로**가 새로 필요해 프록시의 폴더 고정(D12)이 무너진다.
현행 동작 보존 + 경고가 범위·보안 양쪽에서 옳다. ⚠ v1 §2-1이 "안전 마진으로 `![](url)`도 경계로
삼는다"고 적은 것은 **채택하지 않는다.**

---

## 3. 파일별 구현 사양

### 3-1. `lib/proofread.ts` — LaTeX 제어열 보호 (D15) ★ 1번 커밋

`autoWrapBareNumbers`(:327)와 `autoWrapBareLetters`(:386)의 `protectedRanges` 수집부에 한 갈래를 더한다.
두 함수가 **똑같은 보호 목록을 각자 적고 있으므로** 새 수집기는 **공용 헬퍼 하나**로 만들어 둘이 부른다.

```ts
/** 텍스트 영역에 남은 LaTeX 제어열(\cmd 와 그 중괄호 인자)을 보호 범위로 수집한다.
 *  ⚠ 중괄호는 정규식으로 자르지 않는다 — `readGroup`(lib/latexScan.ts)의 균형 스캔을 쓴다.
 *    `\{[^}]*\}`는 중첩 인자에서 잘못 끊긴다(개선묶음 M1 W2가 그 실패의 기록). */
function collectControlSeqRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const re = /(?<!\\)\\[A-Za-z]+\*?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let end = m.index + m[0].length;
    // 뒤따르는 중괄호 인자를 균형 스캔으로 흡수 (연속 인자 허용: \frac{a}{b})
    while (text[end] === '{') {
      const close = readGroup(text, end);
      if (close < 0) break;          // 짝이 없으면 거기서 멈춘다(변환하지 않는다)
      end = close + 1;
    }
    out.push([m.index, end]);
  }
  return out;
}
```

**규약 (Z8 — 주석으로 파일에 남길 것)**

1. `(?<!\\)`가 있어 `\\`(줄바꿈)·`\$`·`\{`에 걸리지 않고, `\\[6pt]`도 통과한다(`[`는 영문자가 아니다).
   **이 세 가지를 증설 케이스로 못 박을 것.**
2. **인자를 통째로 보호하면 `\textbf{2개}`의 `2`도 수식화되지 않는다 — 의도한 트레이드오프다.**
   실데이터의 텍스트 영역 제어열은 `\includegraphics`·`\begin`·`\item`·`\hline`이 사실상 전부라
   실익이 없고, 반대로 인자를 열어 두면 C2가 재발한다. **"왜 `\textbf{3}`이 안 감싸지나"가 훗날
   버그로 오인되지 않도록 이 문단을 주석으로 남길 것.**
3. `readGroup`이 −1(짝 없음)을 주면 **제어열 본체까지만** 보호하고 변환도 하지 않는다.

**테스트 증설(`tests/proofread.test.mjs` — 기존 17케이스 무회귀 + 최소 5)**

| # | 입력 | 기대 |
|---|---|---|
| P-1 | `\includegraphics{연구실모의6회(260824)_문제_1공통07_fig1.jpg}` | count 0 · 문자열 불변 |
| P-2 | `\begin{itemize}\n\item 첫째\n\end{itemize}` | count 0 · 불변 |
| P-3 | `$\begin{array}{cc} 1 & 2 \end{array}$` 뒤에 `\includegraphics{a_fig1.jpg}` | 표 변환은 그대로 일어나고 그림 태그만 불변 |
| P-4 | `$\begin{aligned} x &= 1 \\[6pt] y &= 2 \end{aligned}$` | 기존 동작 불변(`\\[6pt]` 미손상) |
| P-5 | `함수 f가 $x^2$일 때` | `$f$` · `x^{2}` — **자동 수정이 여전히 일한다**(과잉 보호 회귀 방지) |

### 3-2. `lib/sheetImport.ts` — 분할 · B열 (D2 · D13 · D21) ★ 2번 커밋

⚠ **import 0 규약**(`npm run test:sheet`가 단독 컴파일). `proofread`를 여기서 부르지 않는다.

```ts
export const SHEET_COL = { …, problem: 1, … } as const;   // B
export const EXPECTED_HEADERS = { …, problem: 'problem', … };

export interface DraftBlock {
  type: 'text' | 'choices' | 'image';
  raw_text: string;          // image는 저장 직전까지 빈 문자열
  figName?: string;          // image 전용. Drive 파일명
}
```

**분할 함수**

```ts
/** `\includegraphics[opt]{name}` 경계로 텍스트를 조각낸다.
 *  ⚠ 여기서 `\{[^}]*\}`를 쓰는 것은 M1 W2 규약의 예외가 아니라 **적용 대상이 아니다** —
 *    파일명에는 중괄호가 없다(GAS가 `<stem>_figN.<ext>`로만 만든다). 중첩이 없으므로 균형 스캔이 필요 없다.
 *  ⚠ `![alt](url)`은 **경계로 삼지 않는다**(D21). 경고만 올린다. */
export function splitFigures(text: string): { blocks: DraftBlock[]; figNames: string[]; warnings: string[] }
```

- 빈/공백뿐인 텍스트 조각은 버린다(순서는 배열 인덱스가 소유 — Y3).
- 파일명은 `warnings`가 아니라 `figNames`로 올려 미리보기 배지가 쓴다.
- **`stemHash`는 `normalizeText(E)` 직후 값으로 고정**(N-4) — 분할·자동 수정 어느 것도 앞서지 않는다.
  `rowToDraft`에서 `stemHash(stem)`을 **분할 호출보다 먼저** 계산할 것.

**B열 복구(D13)**: E에서 얻은 `figNames`와 B(`problem`)에서 얻은 `figNames`를 비교해
**B에만 있는 이름**을 문제 탭 **맨 끝**에 image 블록으로 붙이고
`"E열에서 사라진 그림 1개를 B열에서 복구했습니다"` 경고를 올린다.

**경고 목록(신규)**

| 조건 | 문구 |
|---|---|
| choices 블록에 `\includegraphics` (Z3) | `선택지 안에 그림이 있습니다 — 편집창에서 손봐야 합니다` |
| `![](…)` 잔재 (D21) | `변환되지 않은 Mathpix 이미지 링크가 있습니다(외부 링크로 표시됩니다)` |
| 분할 후 question에 텍스트 블록 0 (N-8) | `문제 본문이 그림뿐입니다 — 정밀 검증이 차단됩니다` |
| B열 복구 발생 | 위 문구 |

**테스트 증설(`tests/sheetImport.test.mjs`)**: 앞/중/뒤 분할 · 연속 2개 · 파일명만 있는 셀 ·
`stemHash` 분할 전후 동일 · choices 경고 · `![](url)` 미분할+경고 · B열 복구 · 빈 조각 폐기.

### 3-3. `app/api/sheet-import/figure/route.ts` — 신설 (D1 · D12 · D20 · N-6) ★ 3번 커밋

```
GET /api/sheet-import/figure?name=<urlencoded>
headers: Authorization: Bearer <Firebase ID token>
200: 이미지 바이트 (Content-Type: 원본 · Cache-Control: private, no-store)
     X-Fig-Duplicates: <n>   ← 2 이상이면 클라가 경고 배지를 띄운다
400 화이트리스트 위반 · 401/403 인증 · 404 미발견 · 502 Drive 오류
```

- **자기 JWT 싱글턴**, 스코프 `['https://www.googleapis.com/auth/drive.readonly']` **단독**(D20).
  ⚠ `app/api/sheet-import/route.ts`는 **한 줄도 건드리지 않는다**(C4).
- `verifyUid(req.headers.get('authorization'), apiKey, allowedUids)` — `lib/apiAuth.ts` 재사용(D12).
- 환경변수 `AUDITION_FIG_FOLDER_ID` 추가. `readEnv()`는 **핸들러 안에서** 부른다(빌드 안 깨지는 61a 규약).
- **화이트리스트**(D12 · N-10):
  ```ts
  const FIG_NAME_RE = /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ()._\-]{1,200}_fig\d+\.(jpe?g|png|gif|webp)$/;
  ```
  `'`를 문자 집합에서 **배제**하므로 Drive 쿼리 이스케이프가 불필요해진다.
- **검색**(N-6):
  `files?q=name='<name>' and '<FOLDER_ID>' in parents and trashed=false`
  `&orderBy=modifiedTime desc&pageSize=2&fields=files(id,name,mimeType,size)`
  → `files[0]`을 쓰고 `files.length >= 2`면 `X-Fig-Duplicates`에 실어 알린다.
- **바이트**: `files/{id}?alt=media` → `new NextResponse(buf, { headers })`.
- `runtime = 'nodejs'` · `dynamic = 'force-dynamic'` · `maxDuration = 30`.

### 3-4. `components/import/SheetImportModal.tsx` — 미리보기 (D7·D9·D16·D18) ★ 4번 커밋

**그림 캐시** (모듈 밖 상태 아님 — 모달 인스턴스 `useRef`)

```ts
type FigEntry = { blob: Blob; blobUrl: string; type: string; dupes: number } | { error: string };
const figCache = useRef<Map<string, FigEntry>>(new Map());
```

- **가져오는 시점**(D16): ① 행을 펼칠 때 그 행의 `figNames`만 ② 저장 직전 전건.
  동시성은 `SAVE_CONCURRENCY`(=4)를 재사용한다.
- **N-5**: 인증 헤더가 필요하므로 `<img src="/api/…">`는 **불가**. `fetch` → `blob()` →
  `URL.createObjectURL`. **행 접힘·모달 언마운트에서 `revokeObjectURL`.**
- **D17**: 키는 파일명이므로 문제·해설이 같은 그림을 가리켜도 **1회 다운로드 · 1회 업로드**.
- **미리보기 raw_text**: `persisted[tab][i]`가 image면
  `<img src="${blobUrl}" alt="${figName}" width="400" />`로 채워 그린다.
  캐시 미스·실패면 **`\includegraphics{…}` 리터럴을 그린다**(D5와 같은 모습).
- **D18 — 렌더 분기를 셋으로**:
  ```tsx
  b.type === 'choices' ? <ChoicesBlock …/>
  : b.type === 'image'  ? <ImagePreview src={…} block={b} />   // TabBody:119-134 마크업 + imageTreatmentStyle
  : <EditorPreview …/>
  ```
  ⚠ "렌더 5곳"에 여섯 번째를 만드는 것이 **아니다** — `imageTreatmentStyle`을 공유하므로 사본이 아니다.
- **D9 — 자동 수정 토글**: 3단계(폴더 선택) 화면에 `[가져오면서 문법 자동 수정 적용]` 체크박스,
  **기본 ON**. 미리보기 배지 `자동 수정 n건`.
  적용 지점은 **분할 뒤 · `toPersistedBlock` 앞**:
  ```
  rowToDraft → splitFigures → autoFixDeterministicIssues → toPersistedBlock
  ```
  `image` 블록은 제외, `choices`는 `skipJamoRefs: true`
  (편집창 `AUTOFIX_EXCLUDED_TYPES` = image·svg·ggb와 같은 규칙),
  **`\includegraphics`가 남은 choices 블록은 추가로 제외**(D3′).
- ⚠ **Y1(미리보기=저장) 유지**: 유일한 차이는 image 블록 `src`뿐이다 —
  미리보기 blob URL ↔ 저장 Storage URL. **이 예외를 코드 주석으로 명시할 것.**

### 3-5. 저장 경로 (D6 · D17 · D7″) ★ 5번 커밋

```
createProblem
  → 이 문항의 figNames를 순회: 캐시 blob → new File([blob], figName, {type})   ← N-9: type 필수
      → uploadImage(file, problemId) → url
      → persisted의 해당 image 블록 raw_text에서 src를 url로 치환
  → saveTabBlock 루프
  실패 시: deleteProblem(problemId)  →  방금 올린 url들 best-effort 삭제(D7″)
```

- 업로드 URL은 `uploadedUrls: string[]`에 모아 두고 롤백에서 쓴다.
- 그림 다운로드 실패 문항은 **저장을 막지 않는다**(D5) — 그 블록만 `text`로 되돌려
  `\includegraphics{…}` 리터럴을 넣고 결과 요약에 `그림 n개 실패`로 집계한다.
  ⚠ 이 되돌림은 **자동 수정보다 뒤**여야 리터럴이 온전하다 — 순서상 이미 그렇다(자동 수정은 image 블록을
  건너뛰고, 되돌림은 저장 단계다). **D15가 없으면 이 경로가 깨진다**는 사실을 주석으로 남길 것.

### 3-6. `lib/storage.ts` — 삭제 헬퍼 (D7″) ★ 5번 커밋

```ts
import { deleteObject, ref } from 'firebase/storage';

/** 업로드 다운로드 URL로 Storage 객체를 지운다(롤백 전용, best-effort).
 *  ⚠ `ref(storage, url)`은 https 다운로드 URL을 그대로 받는다.
 *  ⚠ storage.rules가 `allow delete: if request.auth != null`로 갈라져 있어야 통과한다 —
 *    `write` 한 덩어리로 두면 delete에는 `request.resource`가 없어 조건이 오류로 죽는다(Z2′). */
export async function deleteUploadedFile(url: string): Promise<void> {
  await deleteObject(ref(storage, url));
}
```

### 3-7. `storage.rules` — 규칙 분리 (D7″) ★ 0번(덕수 선배포)

§1 Z2′의 3줄. **코드보다 먼저 배포한다.**

---

## 4. 영향 범위

| 구분 | 내용 |
|---|---|
| 신규 | `app/api/sheet-import/figure/route.ts` |
| 수정 | `lib/proofread.ts`(D15) · `tests/proofread.test.mjs`(증설) · `lib/sheetImport.ts`(분할·B열·경고) · `tests/sheetImport.test.mjs`(증설) · `components/import/SheetImportModal.tsx` · **`lib/storage.ts`**(D7″) · **`storage.rules`**(D7″) · `.env` 1개 |
| **0건** | `firestore.rules` · `toPersistedBlock` · 렌더 5곳 · `app/api/sheet-import/route.ts` · `app/api/verify/*` · `package.json`(스크립트 이미 있음 — Z1) · `lib/latexScan.ts`(사용만) · GAS 두 저장소 · 기존 문항 · 마이그레이션 |
| 알고 두는 손실 | 그림이 image 블록이 되면 `verifyBlocksOf`가 걸러 **정밀 검증 모델이 그림 존재를 모른다**(C1). 61f 후보(D19). ⚠ v1 §4의 "의도한 방향" 문장은 **삭제**할 것 |

---

## 5. 커밋 계획 · 검수 관문

| # | 커밋 | 관문 |
|---|---|---|
| **0** | (덕수) `storage.rules` 배포 | Firebase 콘솔에서 규칙 반영 확인 |
| **1** | `proofread`: LaTeX 제어열 보호 + 테스트 5 증설 | **기존 17 무회귀** · P-1~P-5 통과 · 다른 로직 검증 7종 무회귀 |
| **2** | `sheetImport`: 분할 · B열 · 경고 + 테스트 증설 | `stemHash` 분할 전후 동일 · O-1 재확인(choices 경고 경로) |
| **3** | figure 프록시 라우트 | `연구실모의6회(260824)_문제_1공통07_fig1.jpg` **200** · 없는 이름 404 · 토큰 없이 401 · 화이트리스트 밖 400 · 동명 2건에서 `X-Fig-Duplicates: 2`. *403 = 폴더 공유 누락, `accessNotConfigured` = Drive API 미활성화* |
| **4** | 미리보기: 지연 로딩 · image 분기 · 자동 수정 토글 | **검은 관문** ↓ |
| **5** | 저장 · 롤백 · `lib/storage.ts` | 같은 파일명이 문제·해설에 함께 있는 문항 → Storage 객체 **1개**(D17) · 강제 실패 시 `problems/{pid}/` **비어 있음**(D7″) |

**4번 검은 관문 (실물 판정)**

1. 그림 문항 **5건 이상**에서 미리보기 그림 = 저장 후 그림 (흑백 · multiply · 폭까지 일치, D18)
2. 선택지 뒤 꼬리 그림 1건 — **1공통13**(D13 B열 복구 경로 포함)
3. 자동 수정 ON/OFF 토글해도 **중복 배지 불변**(N-4 회귀)
4. 파일 미발견 문항에서 `\includegraphics{…}` 리터럴이 **원형 그대로**(D5 × D15 교차) —
   ⚠ **이 관문 하나가 이 Phase의 가장 값비싼 발견을 지킨다**
5. 500행급 가져오기에서 펼치지 않은 행의 그림은 **받지 않는다**(D16 — 네트워크 탭으로 확인)

---

## 6. 남은 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| P1 | GAS 패치 5(`mergeHeader_`·`mpf_repairHeaders`) push | 어림 — 구현과 무관, 데이터 품질 |
| P2 | `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 어림 — GAS |
| P5 | J열 `diagram_boxes` 크기 필터(조각 그림 근본 대책) | 후속 |
| 61f | AI 교정 일괄(라우트 인증 + 결과 저장) · 검증용 `[그림]` 자리표시자(D19) | 후속 Phase |
| — | Storage 규칙 회귀 테스트(에뮬레이터) | 하지 않는다 — `firebase.json`에 storage 에뮬레이터 포트가 없고, 규칙 3줄에 하니스를 새로 세우는 비용이 이득보다 크다. 5번 관문의 실물 확인으로 대신한다 |

---

*v4 착수판. 구현 후 실행판으로 고쳐 `docs/phasedocs/`에 등록하고 CLAUDE.md·roadmap 포인터를 갱신할 것
(작업 규칙 7 — 옮기지 않으면 phaseSketch 정리 때 이 Phase의 유일한 사양이 사라진다).*
