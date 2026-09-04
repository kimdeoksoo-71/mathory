# Phase 61e-2차 — 그림 링크 이관(패치 11) 대응 v5 최종 실행판

> 작성: CLI(Claude Code) 2026-09-03 저녁 · 계보: v1(web) → v2(web·GAS 재검토) → v3(CLI 원본 대조·결정 확정) → v4(web 검증 턴) → **v5(CLI 최종 = 착수판)**
> 인용 기준: mathory `466d347` · gas-project-latex-convert `7719d12` · gas-project-audition `8ebb218`
> **v4의 지적 3건 중 2건 수용(V1·V4), 1건 반증(V3).** 그 결과가 §3에 반영돼 있고 나머지는 v3 그대로다.
> **구현·검수 완료(2026-09-04) — §10이 구현 기록, §10-2가 검수 결과.** 남은 것은 운영(§7-6)과 배포뿐이다.

---

## 0. 최종 형태

Data_DS 본문의 그림 표기가 **`\includegraphics{파일명}` → `![파일명](Drive링크)`** 로 바뀐 것(GAS 패치 11)에 Mathory가 따라간다. **두 형식 모두**를 그림 경계로 인식하고, 프록시는 **NFC/NFD 두 정규형**으로 Drive를 찾는다.

**수정 3파일 · 신규 0.**

| 파일 | 내용 |
|---|---|
| `lib/sheetImport.ts` | `FIG_NAME_RE` 이주·export · 통합 스캔 정규식 · `MATHPIX_IMG_RE` 축소 · 이름 대조 NFC |
| `components/import/SheetImportModal.tsx` | choices 자동 수정 가드에 새 형식 추가 · 주석 정정 |
| `app/api/sheet-import/figure/route.ts` | NFC 정규화 → 게이트 → NFC·NFD 순차 검색 · `FIG_NAME_RE` import |

**Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · Storage 규칙 0 · 블록 타입 union 0 · 전처리 파이프라인 0 · 렌더 5사이트 0 · 서버 신규 0.**
로직 검증 289 → **302건**(`test:sheet` +11 · `test:proofread` +2 — **후자는 코드 변경 없는 회귀 고정**).

---

## 1. 원인

Phase 61e(08-30)는 "그림 = `\includegraphics{파일명}`" 계약 위에 구현됐다. GAS **패치 11**(09-01, latex-convert `e57d036` · 현행 `Datalatex_To_Data_DS.gs:178-193`)이 Data_Latex→Data_DS 이관 시 그 태그를 **`![파일명](Drive링크)`** 로 치환하면서 계약이 바뀌었다. Mathory의 `splitFigures`는 `![…](…)`을 **의도적으로** 경계에서 제외했으므로(61e D21) 그림 블록이 만들어지지 않고, 본문에 비공개 Drive URL이 텍스트로 남는다 — "주소만 붙는" 증상.

되돌릴 수 없다: audition 검증(패치 12·13)이 이 형식으로 그림을 내려받아 Gemini에 첨부한다. **해법은 Mathory가 두 형식을 모두 인식하는 것이다.**

---

## 2. GAS 실측 (원본 대조)

> ⚠ **로컬 사본(`~/Documents/gas-project-audition`)은 `b6b91f6`으로 stale**하다(패치 12·13 이전이라 `Pipelineverify.gs`가 아예 없다). CLI도 두 레포를 origin에서 clone해 읽을 수 있다 — v2의 "CLI는 GAS를 볼 수 없다"는 전제는 틀렸다. **이후 GAS 사실도 CLI가 교차검증한다.**

| # | 사실 | 근거 |
|---|---|---|
| **N1** | 패치 11의 alt는 **NFC로 정규화된 파일명**이다 | `Datalatex_To_Data_DS.gs:184-191` — `nfc_(name)`을 키로 alt에 쓴다. 링크 못 찾은 태그는 **그대로 남긴다**(두 형식 공존 행이 생기는 이유) |
| **N2** | Drive의 **실제 파일명은 비정규화 원형**이다 | `Mathpix 그림 추출.gs:229` `${stem}_fig${i+1}.${ext}` + `:197-198` `blob.setName(name)`. `stemOf_`(:85)는 확장자만 뗀다 |
| **N2′** | **그 원형은 지금도 계속 만들어진다** | `링크&파일명 추출(키워드).gs:55` *"패치 6: 비교만 NFC, **기록은 원본명 기준**"*, `:72` `singles.push([raw, …])` · `:81` `g.name = raw.replace(…)`. Data1!A에 들어가는 것은 `raw`다 → **stem이 NFD면 fig 파일명도 NFD** (v4 V3의 "09-03 이후는 NFC" 는 반증됐다 — §3-V3) |
| **N3** | GAS는 링크에서 fileId를 뽑아 **id 우선 · 이름 폴백** | `Itemverification.gs:594-602, 660`. 호스트는 **`https://drive.google.com`만**, alt는 빈 문자열도 허용 |
| **N4** | 이름 폴백이 **Drive 전역**을 뒤진다 | `:608-637` `DriveApp.getFilesByName`. ⚠ **Mathory는 따라 하지 말 것** — 폴더 고정(61e D12)이 프록시 4중 방어의 한 축이다 |
| **N5** | 그림 재추출은 **파일 id를 바꾼다** | `saveBlob_`(:193-199)이 동명 파일을 휴지통에 보내고 새로 만든다 → 시트에 박힌 링크의 id는 옛 휴지통 판본을 가리킨다 |
| **N6** | svg가 만들어질 수 있고, GAS 검증기는 제외 기록만 한다 | `extFromUrl_`(:186-191)에 `svg` · `IMAGE_MIME_OK`에는 없음(`Itemverification.gs:121`) |
| **N7** | E열 그림 유실 전제(61e D13)는 그대로 | `normalizeProblem.gs:161-177` — 선택지 뒤 잔여를 `trailer`로 떼고 `TRAILER_DROPPED` |
| **N8** | `pv_load_`가 Data_DS **A~AC를 통째로 비우고** A~K만 다시 쓴다 → **M열(get) 체크박스도 지워진다** | `Pipelineverify.gs:477-522`. `Movetostack.gs:191`도 이관 후 Data_DS를 clearContent — **휘발이 두 번**이다 |
| **N9** | 패치 11 형식은 **B·C 둘 다**에 실린다 | `dlds_toDataDS`가 `[key, problem, solution]`을 함께 쓴다. E는 normalizeProblem이 B에서 만든다 → **B열 복구(D13)도 새 형식을 봐야 한다** |
| **N10** | Data_DS 열 확장(Y=fig_info 25)·Stack 세트열 Y/Z→AD/AE는 **A~P에 영향 0** | 열 추가가 전부 `insertColumnsAfter(getMaxColumns(), …)` = 뒤에만 붙는다(`Itemverification.gs:730`, `Movetostack.gs:145`) |

`normalizeProblem.gs`는 두 레포가 **바이트 동일**하다(md5 `9d40f71cf85731279b8d1980e5111685`, 448행). 단 `8ebb218`에서 585행이 바뀐 직후의 동일이라 다시 갈릴 수 있다 — 인용 시 해시를 남길 것.

---

## 3. v3 → v5에서 뒤집힌 것 (v4 검증 턴 반영)

| # | v3 주장 | v5 판정 |
|---|---|---|
| **V1** | *"proofread의 보호 목록은 URL만 지키고 **alt는 무방비**"* → D31(보호 1줄 ×2 추가) · C8-①의 근거 | **틀렸다 — 철회.** `lib/proofread.ts:342`·`:403`에 **`addAll(/!?\[[^\]\n]*\]\([^)\n]*\)/g)` — 마크다운 링크/이미지**가 61e 이전부터 있다. 실행 프로브(HEAD 단독 컴파일)로 확인: `![연구실모의6회(260824)_…_fig1.jpg](drive…) 이때 f(1)은?` → **alt 무변경**, 바깥 `f`만 `$f$`. → **`lib/proofread.ts` 코드 변경 0** |
| **V3** | (v4의 정밀화) *"09-03부터 A열 파일명을 `nfc_(f.getName())`로 기록하므로 새 그림은 stem부터 NFC"* | **반증.** 같은 파일 `:55`가 *"비교만 NFC, **기록은 원본명 기준**"* 이라고 못 박고 `:72`가 `raw`를 push한다. **NFD stem은 지금도 새로 생길 수 있다** → N2′. 사양은 안 바뀌지만(이중 검색이 양쪽을 덮는다) **이 사실을 잘못 남기면 나중에 "이제 다 NFC니 NFD 폴백을 빼자"는 판단이 나온다** |
| **V4** | `FIG_SCAN_RE`의 링크 갈래가 `](` 뒤 공백을 불허 | **수용.** `[ \t]*`를 넣어 닫는다(61e `MATHPIX_IMG_RE`는 `\(\s*`를 허용했다 — 좁히면 공백 든 링크가 **분할도 경고도 없이 침묵**한다) |
| **C8-①** | choices 가드 확장의 근거 = "alt 수식화 방지" | **근거 교체(내용은 유지).** 수식화는 일어나지 않는다(V1). 가드를 넓히는 진짜 이유는 **기존 `\includegraphics` 가드와의 대칭**이다 — D3′ *"손댈 이유가 없는 블록은 손대지 않는다"*. ⚠ 거짓 근거를 주석에 남기면 나중에 이 가드를 지우려는 사람이 잘못된 전제와 씨름한다 |
| **C11** | materializeImage 주석 정정 | **3분법으로 확정.** ① 폴백 리터럴은 autoFix **이후** 삽입 → proofread를 아예 안 지난다 ② O열·choices에 남은 **구형** 리터럴은 `collectControlSeqRanges`(D15)가 지킨다 ③ 같은 자리의 **새 형식**은 `:342`·`:403`이 지킨다 |

**변경 없는 것**: C4(§4-D29·§5-3) · N1~N10 · D27·D28·D29·D30·D32·D33·D34·D35 · §5 나머지 · §6 테스트 · §7 순서.

---

## 4. 확정 결정

| # | 확정 | 근거 |
|---|---|---|
| D27 | Data_DS 라디오 **유지**, 마법사 안내문만 갱신 | 검증 직후 그 세트만 바로 가져오는 흐름에 유용. 문구에 N8을 넣는다 — *"Data_DS는 마지막 검증 실행분만 담고, 불러올 때마다 M열 체크박스까지 비워집니다. 누적본은 Stack입니다."* |
| D28 | 읽기 범위 **`A1:P` 유지** | N10. `fig_info`는 "검증 요청에 뭐가 첨부됐나"의 기록이지 원본 그림의 존재 증명이 아니다 |
| **D29** | 프록시는 **이름만** 조회 — NFC 시도 → 0건이면 NFD 재시도. **fileId 폴백 없음** | N5 — 재추출이 id를 바꾸므로 시트의 id는 휴지통 판본을 가리킨다. 이름 검색은 `trashed=false` + `modifiedTime desc`라 항상 최신을 집는다. GAS가 id 우선인 것은 *같은 실행 안이라 링크가 신선하기 때문*이다 |
| **D30** | 그림 미발견 폴백은 **`\includegraphics{figName}` 유지**(v2 D23 철회) | `origText` 복원은 `![이름](Drive링크)`를 남겨 **깨진 `<img>`** = 고치려는 증상의 재현. `FigurePreview`(`:754`)의 "저장본과 같은 모습" 약속도 깨진다. 링크 강등은 비공개 Drive URL을 공개 공유로 흘린다. → **`DraftBlock`에 `origText` 필드를 두지 않는다** |
| ~~D31~~ | **철회** — `lib/proofread.ts` 코드 변경 0 | V1 |
| **D32** | `FIG_NAME_RE`를 **`lib/sheetImport.ts`가 소유**, route가 import | `app/api/sheet-import/route.ts:22`가 이미 그 파일을 import한다. **import 0 규약은 sheetImport가 *남을* import하지 않는다는 뜻**이라 저촉되지 않고 단독 컴파일도 성립. 게이트가 갈리면 접미사만 맞는 이름이 클라에서 분할된 뒤 프록시에서 400이 난다 |
| **D33** | 링크 호스트는 **`https://drive.google.com/`만** | GAS `reLink`와 동일(N3). 모르는 형식은 오늘 동작(텍스트 유지 + 경고)으로 떨어진다 |
| **D34** | alt 게이트는 **서버 `FIG_NAME_RE` 전체와 동일** | D32의 귀결 |
| **D35** | svg는 **현행 유지**(분할 안 함 + 경고) | N6 — GAS도 같은 판단 |

---

## 5. 구현 사양

### 5-1. `lib/sheetImport.ts`

**① `FIG_NAME_RE` 이주·export**(D32) — 값은 현행 그대로, `'` 배제 주석도 함께 옮긴다. **NFC 정규화로는 `'`가 새로 생기지 않으므로 그 방어는 정규화 후에도 유지된다**는 문장을 덧붙인다.

**② 통합 스캔 정규식 하나** — 두 정규식을 따로 돌려 병합하지 말 것. 교대 한 벌이면 인덱스 순서가 공짜다.
```ts
const FIG_SCAN_RE =
  /\\includegraphics[ \t]*(?:\[[^\]\n]*\])?\{([^}\n]+)\}|!\[([^\]\n]*)\]\([ \t]*(https:\/\/drive\.google\.com\/[^)\s]+)[ \t]*\)/;
// m[1] = 구형 태그 이름 / m[2] = alt / m[3] = Drive 링크
```
- `\includegraphics` 뒤 `[ \t]*`: GAS는 `\s*`로 읽는다(태그를 만드는 쪽도 GAS라 실제 공백은 없지만 맞춰 둔다). **`\s*` 금지** — 개행을 삼킨다(CLAUDE.md).
- `](` 앞뒤 `[ \t]*`: V4. 없으면 공백 든 링크가 **분할도 경고도 없이 침묵**한다.

**③ `MATHPIX_IMG_RE`를 비-Drive 전용으로 축소** — 안 그러면 정상 링크마다 "변환되지 않은 Mathpix 링크" 경고가 덧난다.
```ts
const FOREIGN_IMG_RE = /!\[[^\]\n]*\]\(\s*(?!https:\/\/drive\.google\.com\/)https?:\/\/[^)\s]+\s*\)/;
```
**경고 문구는 현행 유지** — `test:sheet` F7이 `/Mathpix/`를 본다.

**④ `splitFigures`** — `FIG_SCAN_RE`로 한 번 훑는다.
- 구형 태그: 지금과 같이 image 블록.
- Drive 링크: **`FIG_NAME_RE.test(alt.trim().normalize('NFC'))`가 참일 때만** image 블록.
  - **`figName`은 원문 그대로** 저장한다(정규형 시도는 프록시 몫 — D29).
  - ⚠ **게이트 판정만 NFC다.** 원문 그대로 검사하면 NFD alt가 규격 외로 떨어져 **분할 자체가 안 된다.** 이 비대칭이 의도다.
- 거짓이면 경계로 삼지 않고 경고: `'그림 링크의 파일명이 규격과 다릅니다(<alt>) — 본문에 그대로 둡니다'`.
- ⚠ **그림이 하나도 없으면 원문 그대로 text 블록 1개**를 돌려주는 갈래를 없애지 말 것(61a 비트 동일 규약, 빈 문자열 포함).

**⑤ `scanFigureNames`(B열 복구)** — 같은 통합 스캔. **B는 정규화 전 원문이라 새 형식이 반드시 온다**(N9). alt 게이트도 동일 적용(규격 외 이름을 복구 블록으로 만들면 프록시에서 400).

**⑥ 이름 대조는 NFC 기준** — `rowToDraft`의 `inQuestion` Set에 `normalize('NFC')`를 넣고 조회도 같은 형태로. **블록에 담는 `figName`은 원문 그대로.**

**⑦ D3′ 선택지 경고 · O열 경고**를 통합 스캔 기준으로.

**⑧ 손대지 않는 것**: `stemHash`(분할 전 `normalizeText(E)` — 61e N-4) · `normalizeText` · 열 매핑 · `A1:P` · `$$` 정규화의 `toPersistedBlock` 위임 · `DraftBlock` 필드.

### 5-2. `components/import/SheetImportModal.tsx`

**① choices 자동 수정 가드에 새 형식 추가** — 근거는 **대칭성**이다(§3 C8-①).
```ts
/** ⚠ 두 형식을 함께 본다 — 기존 `\includegraphics` 가드와 대칭(D3′ "손댈 이유가 없는 블록은 손대지 않는다").
 *  ⚠ **수식화 방지가 아니다** — alt·URL은 `lib/proofread.ts:342·403`(마크다운 링크/이미지)이 이미 보호한다. */
const CHOICE_FIG_RE = /\\includegraphics|!\[[^\]\n]*\]\([ \t]*https:\/\/drive\.google\.com\//;
```
**② `materializeImage` 주석 정정**(§3 C11 3분법). 코드는 불변(D30).
**③ 나머지 불변**: 지연 로딩 · `SAVE_CONCURRENCY 4` · blob URL 회수 · 업로드 · 롤백 `deleteObject` · 자동 수정 토글 · `X-Fig-Duplicates` 배지.

### 5-3. `app/api/sheet-import/figure/route.ts`

```ts
import { FIG_NAME_RE } from '../../../../lib/sheetImport';

const raw = (req.nextUrl.searchParams.get('name') ?? '').trim();
if (!raw) return fail(400, 'name 파라미터가 필요합니다');

// ⚠ 정규식 검사는 **NFC 정규화 뒤**에 한다.
//   NFD 한글은 U+1100 계열 자모라 `[가-힣]`에 안 걸려, 그냥 검사하면 검색 전에 400으로 죽는다.
const nfc = raw.normalize('NFC');
if (!FIG_NAME_RE.test(nfc)) return fail(400, '허용되지 않는 파일명입니다 — …');

// Drive는 저장된 문자열을 그대로 비교한다 → NFC 먼저, 0건이면 NFD로 한 번 더 (D29)
for (const v of Array.from(new Set([nfc, raw.normalize('NFD')]))) { … }
```
- `X-Fig-Duplicates`는 **적중한 변형의 개수**. 두 정규형에 파일이 갈려 있는 경우는 보고하지 않는다 — 알고 두는 손실.
- ⚠ **Drive 전역 검색(N4)을 따라 하지 말 것.**
- 화이트리스트 · 폴더 고정 · `verifyUid` · 허용목록 · `drive.readonly` 단독 JWT · `modifiedTime desc` — 전부 불변.

---

## 6. 테스트

### `npm run test:sheet` 53 → **64**

F9 새 형식 단독 분할 / F10 두 형식 공존(등장 순서) / F11 규격 외 alt 비분할+경고 / F12 비-Drive 링크 현행 경고(**F7 무회귀**) / F13 Drive 링크만 있을 때 Mathpix 경고 **안 덧남** / F14 `\includegraphics {name}` 공백 / F15 `FIG_NAME_RE`가 NFD `false`·NFC `true` / F16 **NFD alt도 분할된다**(게이트 NFC) / F17 `]( url )` 공백 든 링크도 분할(V4) / G11 B열 새 형식 복구 / G12 B·E 정규형이 갈려도 중복 복구 없음 / G13·G14 선택지·O열 새 형식 경고.

### `npm run test:proofread` +2 — **코드 변경 없는 회귀 고정**

마크다운 이미지의 **alt 안 숫자·문자가 수식화되지 않는다**(한글 alt 포함). 첫 실행부터 통과해야 하며, **통과 자체가 V1의 재검증**이다.

### 무회귀
10종 전량, **289 → 302**. `test:sheet` 기존 53건은 한 건도 바뀌지 않아야 한다.

---

## 7. 작업 순서

1. `test:proofread` +2 추가 → **즉시 통과 확인**(V1 재검증). 코드 변경 0.
2. `lib/sheetImport.ts` 통합 스캔 + `FIG_NAME_RE` 이주 → `test:sheet` §6 전건 + 기존 53건 무회귀.
3. 프록시 NFC/NFD + 모달 가드·주석.
4. `npm run build` 통과 확인.
5. **실데이터 검수**: ① 검증 직후 Data_DS 그림 문항 5건 이상 — 미리보기 = 저장 후 렌더 ② Stack의 08-30 구형 세트 1건 무회귀 ③ 두 형식 공존 행 1건 ④ 자동 수정 ON/OFF에 중복 배지 불변 ⑤ 한글 파일명 실물이 어느 정규형으로도 200
   — 정규형 확인법: `[...name].map(c=>c.codePointAt(0).toString(16))` 에 `1100` 계열이 보이면 NFD.
6. 운영(덕수): "주소만 붙은" 채 가져온 문항은 재가져오기로 교체(기존 것 휴지통). E 원문이 달라져 **중복 배지가 안 뜰 수 있다.** 마법사 안내문 갱신(D27).
7. `docs/phasedocs/` 등록 + roadmap·CLAUDE.md 갱신 + 각서: *"그림 표기 계약이 바뀌면 `splitFigures` · `scanFigureNames` · `applyAutoFix` 가드 · D3′/O열 경고 · 폴백 리터럴이 **함께** 움직인다(다섯 자리)."*

---

## 8. 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| ~~O1~~ | `hasImages` 죽은 필드 — 정밀 검증이 그림을 못 본다 | **Phase 61f로 해결(2026-09-04)** → `docs/phasedocs/Phase61f 정밀 검증·토론 그림 첨부 v3 실행판.md`. 필드 자체가 삭제되고 그림은 실물로 첨부된다 |
| O2 | `[4점]` → `[$4$점]` (61e §5 O-A) | 별건 — 함께 고치지 말 것 |
| ~~O3~~ | Drive 파일명 정규형 실태 | **종결(§10-1)** — 고유 36개 중 **NFD 18개**. 수정 전이라면 전부 400이었다. NFD 폴백은 제거 금지 |
| O4 | fileId 폴백(D29에서 보류) | 실사용에서 이름 미발견이 관측되면 연다. 조건: **부모 폴더 검증 + 휴지통 판본 배제** |
| O5 | svg 그림(N6) | 실물이 나오면 61f |
| P2 | latex-convert `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 열림 — GAS |
| P5 | J열 `diagram_boxes` 크기 필터 | 후속 |
| — | Stack 기존 행 Y/Z→AD/AE 마이그레이션 1회 | 덕수 — Mathory와 무관 |

---

## 9. 교훈 (다음 Phase가 가져갈 것)

- **"무방비다"라는 주장은 실행 프로브로 재현해야 한다.** 보호 목록류(protected ranges·화이트리스트)는 인용이 아니라 실행으로 검증할 것. v3는 `addAll` 목록을 **한 줄 아래를 못 읽고** 단정했고(`:341` URL만 보고 `:342` 마크다운 보호를 놓쳤다), v4는 그것을 프로브로 잡았다. ⚠ `lib/proofread.ts`는 비ASCII 제어 문자열 때문에 `file(1)`이 `data`로 판정해 **맨 grep이 매치를 조용히 감춘다** — `grep -a` 필수(61e 규약).
- **반대로, 사실 정정도 원본 주석까지 읽어야 한다.** v4의 V3은 `nfc_(f.getName())` 호출만 보고 "기록도 NFC"로 읽었지만 같은 파일이 *"비교만 NFC, 기록은 원본명 기준"* 이라고 못 박고 `raw`를 push한다. **호출이 아니라 무엇이 저장되는지를 볼 것.**
- **거짓 근거로 옳은 코드를 지키지 말 것.** choices 가드 확장은 유지하되 근거를 "수식화 방지"(거짓)에서 "기존 가드와의 대칭"(참)으로 바꿨다. 잘못된 근거는 나중에 그 코드를 지우려는 사람을 헛돌게 한다.

---

## 10. 구현 기록 (2026-09-03)

계획대로 **수정 3파일 · 신규 0**. 서버 신규 0 · 규칙 0 · 스키마 0 · 마이그레이션 0 · 전처리 0 · 렌더 5사이트 0.

| 순서 | 한 일 | 관문 |
|---|---|---|
| 1 | `tests/proofread.test.mjs` P-9·P-10 추가 (**코드 변경 0**) | 26 → 28, **첫 실행에 통과** — V1(alt는 이미 보호된다) 재검증 완료 |
| 2 | `lib/sheetImport.ts` — `FIG_NAME_RE` export · `FIG_SCAN_RE` 통합 스캔 · `FOREIGN_IMG_RE` · `scanFigMatches`/`containsFigure` · 이름 대조 NFC | 기존 53건 무회귀 확인 후 F9~F18·G11~G14 **14건** 추가 → 67 |
| 3 | `figure/route.ts` — `FIG_NAME_RE` import · NFC 정규화 → 게이트 → NFC·NFD 순차 검색 · 머리말 주석 갱신 | — |
| 4 | `SheetImportModal.tsx` — `CHOICE_FIG_RE` 가드 · `materializeImage` 주석 3분법 정정 | — |
| 5 | 전체 회귀 | 10종 **305건** 통과(계획 302 예상 → 실제 305, 시트 테스트를 11 대신 14건 넣었다) · `npm run build` 통과 · `/api/sheet-import/figure` 여전히 `ƒ` Dynamic |

**구현 중 나온 것 1건 — 이름 충돌**: 계획서의 헬퍼명 `hasFigure`가 `rowToDraft` 안의 지역 상수
`const hasFigure`(N-8 판정)와 **같은 블록**에서 충돌한다 — 그대로 뒀으면 선택지·O열 경고가
TDZ `ReferenceError`로 터졌다(컴파일은 통과한다). `containsFigure`로 개명했고 주석에 이유를 남겼다.

**E2E 프로브**(패치 11 행 1건, B에 fig2 추가 · C에 구형 태그 · 선택지 2개):
```
[question] 0 text / 1 image fig=…_fig1.jpg / 2 text / 3 choices / 4 image fig=…_fig2.jpg(B열 복구)
[solution] 0 text / 1 image fig=a_fig9.png / 2 text
warnings: E열에서 사라진 그림 1개를 B열에서 복구했습니다
```
자동 수정이 image 블록을 건드리지 않고 인덱스 정렬이 유지되는 것까지 확인했다.

### 10-1. 실데이터 1차 실측 (dev, 같은 날) — **O3 판정: NFD는 실재하고 절반이다**

dev 서버 로그 집계(그림 요청 36건 · 고유 파일명 36개 · `POST /api/sheet-import` 4건 · 오류 0):

| 파일명 정규형 | 결과 |
|---|---|
| **NFC 18개** | 전부 200 |
| **NFD 18개** | **전부 200** (예: `강대모의고사X14(260901)_문제_1공통07_fig1.jpg`) |

*(그 밖의 401 3건은 CLI가 가짜 토큰으로 쏜 프로브다 — 인증 게이트 정상.)*

⚠ **이 18건은 이번 수정 전이라면 전부 400이었다.** 파일명 게이트가 NFC 정규화 **앞**에 있었고
NFD 한글은 `[가-힣]`에 안 걸리므로, 프록시가 **Drive를 조회해 보지도 않고** 거절했다 —
C4가 "61e에 잠복해 있던 버그"라고 한 것이 실데이터로 확인됐다. 절반이 NFD인 것은
**N2′ 때문에 구조적**이다(파일명 수집이 "비교만 NFC, 기록은 원본명"). → **O3 종결.**
⚠ **그래서 D29의 NFD 폴백은 어떤 이유로도 제거하면 안 된다** — 지금 절반이 그것으로 산다.

### 10-2. 덕수 검수 (2026-09-04) — **전항 통과, 한 항목은 표본 없음**

| # | 항목 | 결과 |
|---|---|---|
| ① | 미리보기 = 저장 후 렌더 | **정상** — 흑백 multiply·폭 400이 두 자리에서 일치 |
| ② | Stack 08-30 구형 세트 무회귀 | **정상** — `\includegraphics` 단독 행이 61e와 같이 돈다 |
| ③ | 한 셀에 두 형식 공존 | **표본 없음** — 실데이터에 그런 행이 0건 |
| ④ | 자동 수정 토글 ↔ 중복 배지 | **정상** — 배지 불변, "자동 수정 n"만 변한다 |
| ⑤ | 그림 수신 | **정상**(§10-1) — 36건 200, NFD 18건 포함 |

⚠ **③이 "표본 없음"인 것은 결함이 아니라 상류가 온전하다는 신호다** — 패치 11이 M/N열에서 링크를
못 찾은 태그만 `\includegraphics`로 남기는데(`dlds_embedFigLinks_`), 검수 시점에는 짝이 다
맞았다는 뜻이다. 다만 **앞으로 생길 수 있는 경우**이고, 통합 스캔을 **교대 정규식 한 벌**로 만든
이유가 바로 이 경우의 등장 순서다. 실물로 확인한 적이 없으므로 **테스트 F10이 유일한 방어선**이다 —
두 정규식을 따로 돌려 병합하는 형태로 되돌리지 말 것.

**남은 것**: §7-6 운영 중 **재가져오기 교체만**(주소만 붙은 문항 — 배포 후 덕수) · 배포(61e 본체와 함께).
마법사 안내문(D27+N8)은 2026-09-04 반영 완료 — Data_DS 힌트 "마지막 검증 실행분 (불러올 때마다 교체됨)" +
사전 선별 안내에 "M열 체크까지 비워집니다 — 체크는 Stack에서" 한 줄.

---

*v5 최종 실행판 — 구현 완료. 인용: mathory `466d347` · latex-convert `7719d12` · audition `8ebb218`.*
