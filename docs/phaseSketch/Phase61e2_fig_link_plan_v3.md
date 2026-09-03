# Phase 61e-2차 — 그림 링크 이관(패치 11) 대응 구현 계획서 v3 착수판

> 작성: CLI(Claude Code) 2026-09-03 · 저본: v2(web, 같은 날 오후)
> 계보: v1(web 초안) → v2(web · GAS 두 레포 재검토) → **v3(CLI 원본 대조 + 결정 확정 = 착수판)**
> 실측 기준: mathory `466d347` / gas-project-audition `8ebb218` / gas-project-latex-convert `7719d12`
> **결정 D27~D35는 전부 확정됐다**(덕수 승인 2026-09-03). 이 문서는 그대로 구현하면 되는 상태다.
> 남은 절차는 **검증 1턴**(§8 체크리스트) → 착수.

---

## 0. 판정과 확정 사항

**v1·v2의 원인 분석과 큰 방향(두 형식 모두 그림 경계로 인식)은 옳다.** 원본 대조에서 **정정 11건(C1~C11)** 과 **새 사실 8건(N1~N8)** 이 나왔고, 그중 셋은 계획대로 구현하면 **작동하지 않거나 새 결함을 남긴다**:

- **C4 — 프록시가 NFD 한글 파일명을 검색 전에 400으로 막는다.** v2 D22(NFC/NFD 이중 검색)는 그 앞의 `FIG_NAME_RE` 게이트를 통과하지 못해 **효과가 0이다.** (61e에도 잠복해 있던 버그다.)
- **C8 — 새 형식이 선택지 셀·O열에 오면 자동 수정이 alt 안 숫자를 수식화한다**(`연구실모의$6$회…`). v2 §4는 이 세 자리를 언급하지 않았다.
- **C7 → D30 — v2 D23(`origText` 복원)은 지금 고치려는 증상을 그대로 재현한다.** 폴백이 `![이름](Drive링크)`면 저장본에 **깨진 이미지**가 남는다. → **D23 철회**, 현행 리터럴 유지.

또 v2가 "추가 안전장치"로 둔 D22는 **선택이 아니라 필수**다 — 패치 11이 alt를 `nfc_()`로 만드는데 Drive 실제 파일명은 비정규화 원형이라 **구조적으로** 어긋난다(N1+N2).

**확정 결정 요약**

| # | 확정 | 한 줄 근거 |
|---|---|---|
| D27 | Data_DS 라디오 **유지**, 안내문만 갱신(+N8 한 줄) | 검증 직후 그 세트만 바로 가져오는 흐름에 여전히 유용 |
| D28 | 읽기 범위 **`A1:P` 유지**(Y=fig_info 안 읽음) | 열은 뒤에만 붙어 위치 계약이 안전(C5) |
| D29 | 프록시 조회는 **이름만** — NFC 시도 → 0건이면 NFD 재시도 | 재추출이 fileId를 바꾼다(N5). 시트의 id는 휴지통 판본을 가리킨다 |
| D30 | 폴백은 **`\includegraphics{figName}` 유지**(v2 D23 철회) | `origText` 복원 = 깨진 `<img>` = 고치려는 증상의 재현 |
| D31 | `lib/proofread.ts` 보호 목록에 **마크다운 이미지 추가** | URL은 보호되는데 **alt가 무방비**. 같은 구멍이 편집창 [교정]에도 있다 |
| D32 | `FIG_NAME_RE`를 **`lib/sheetImport.ts`가 소유**, route가 import | 클라 게이트 = 서버 게이트. import 0 규약 무저촉 |
| D33 | 링크 호스트는 **`https://drive.google.com/`만** | GAS `reLink`와 문자 그대로 동일. 좁을수록 안전 |
| D34 | alt 게이트는 **서버 `FIG_NAME_RE` 전체와 동일** | D32의 자연스러운 귀결 |
| D35 | svg는 **현행 유지**(분할 안 함 + 경고) | GAS도 `IMAGE_MIME_OK` 밖으로 두고 누락 기록만 한다(N6) |

**규모**: 수정 4파일(`lib/sheetImport.ts` · `SheetImportModal.tsx` · `figure/route.ts` · `lib/proofread.ts`) · 신규 0.
**Firestore 규칙 0 · 스키마 0 · 마이그레이션 0 · 블록 타입 union 0 · 전처리 파이프라인 0 · 렌더 5곳 0 · Storage 규칙 0.**
로직 검증 289 → **302건**(`test:sheet` +11 · `test:proofread` +2).

---

## 1. 검증 방법과 원천 (C1)

> v2 머리말: *"⚠ GAS 레포는 CLI가 볼 수 없으므로(관례) §1·§2의 GAS 사실은 이 문서가 원천이다."*

**틀렸다.** 두 레포 다 public이라 CLI가 origin에서 clone해 직접 읽는다. 이번 검토는 스크래치패드 clone으로 수행했다:

```
gas-project-audition      8ebb218 "26-09-03(2)"  2026-09-03 14:07:15 +0900
gas-project-latex-convert 7719d12 "26-09-03"
```

⚠ `~/Documents/gas-project-audition`의 로컬 사본은 **`b6b91f6`으로 stale**하다(패치 12·13 이전이라 `Pipelineverify.gs` 자체가 없다). CLAUDE.md의 *"GAS 인용은 GitHub origin/main만을 원천으로 하고 커밋 해시를 남길 것"* 규약이 이번에도 유효했다 — **로컬 사본을 읽었으면 U1~U3을 통째로 놓쳤다.**

→ **앞으로 GAS 사실도 CLI가 교차검증한다.** "web 판본이 단독 원천"이라는 서술을 v3 이후 문서에 다시 쓰지 말 것.

정규식은 전부 node로 실행해 확인했다(§5-1 말미 실측표).

---

## 2. GAS 사실 대조 (U1~U7 전수 + 새 사실 N1~N8)

### 2-1. v2 서술 대조

| # | v2 서술 | 판정 | 실측 |
|---|---|---|---|
| **U1** | 패치 13 그림 첨부 강화 · 구형 태그도 이름 검색 | **확인 + 정밀화(C2)** | `Itemverification.gs:118-125` VCONFIG v7 — `MAX_IMAGES_PER_CALL:8` · `MAX_IMAGE_BYTES:4MB` · `MAX_TOTAL_IMAGE_BYTES:16MB` · `IMAGE_MIME_OK:[jpeg,png,gif,webp]` · `FIG_FOLDER_DEFAULT:'PBMAI/IMAGE_FIG'` · `COL_FIG_INFO:25`. `iv_collectFigRefs_`(586-605)가 `reLink`+`reTag` 이중 스캔 |
| **U2** | Data_DS Y=fig_info 신설 · Stack 세트열 Y/Z→AD/AE · 이관 폭 29열 | **확인 + 근거 보강(C5)** | `Movetostack.gs:32-35` `NUM_COLS:29` · `COL_SET:30` · `COL_GROUP:31`, `mts_migrateSetCols`(235). 열 추가는 전부 `insertColumnsAfter(getMaxColumns(), …)` = **뒤에만 붙는다** → A~P 위치 불변이 *우연이 아니라 구조적으로* 보장된다 |
| **U3** | `pv_load_`가 이관을 자동화, Data_DS는 휘발 | **확인 + 보강(C6)** | `Pipelineverify.gs:477-522`(v2의 "474-520"은 어긋난다). A~K를 키워드로 긁어 오고 `dst.getRange(2,1,maxRows-1,29).clearContent()` 후 재기록. **휘발은 두 번이다** — `Movetostack.gs:191`도 이관 후 Data_DS를 clearContent |
| **U4** | audition `normalizeProblem.gs` = latex-convert HEAD 바이트 동일 | **확인** | md5 양쪽 `9d40f71cf85731279b8d1980e5111685`, 448행. 단 `8ebb218`에서 585행이 바뀐 **직후**의 동일이라 다시 갈릴 수 있다 — 인용 시 해시를 남길 것 |
| **U5** | latex-convert 변화 없음, 패치 11 유지 | **확인** | `Datalatex_To_Data_DS.gs:178-193` `dlds_embedFigLinks_` |
| **U6** | `mpf_runRange`/`mpf_stop` 미등록 | 미검증(무관) | 이번 구현과 무관해 확인하지 않았다 |
| **U7** | 데이터 흐름 확정판 | **확인 + 정정(C6)** | `dlds_toDataDS`가 `[key, problem, solution]`을 함께 쓰므로 **B·C 둘 다 패치 11 형식**이다. E는 normalizeProblem이 B에서 만든다 |

### 2-2. 새로 확인한 사실

**N1 — 패치 11의 alt는 NFC로 정규화된 파일명이다.**
```js
// Datalatex_To_Data_DS.gs:184-191
const names = String(figFiles||'').split(',').map(s => nfc_(s.trim()))…
const key = nfc_(String(name).trim());
return map[key] ? ('![' + key + '](' + map[key] + ')') : m;   // 링크 못 찾으면 태그 그대로
```

**N2 — 그런데 Drive의 실제 파일명은 정규화되지 않은 원형이다.**
```js
// Mathpix 그림 추출.gs:229, 197-198
const name = `${stem}_fig${i+1}.${extFromUrl_(...)}`;   // stem = 시트 A열 파일명 그대로
blob.setName(name); folder.createFile(blob);
```
`stemOf_`(85)는 확장자만 떼고 `nfc_`를 부르지 않는다. **61e까지는 본문이 `\includegraphics{원형}`이라 프록시의 이름 검색이 맞았고, 패치 11이 alt를 NFC로 바꾸면서 처음 어긋났다.** → C3·C4.

**N3 — GAS는 링크에서 fileId를 뽑아 id 우선, 이름 검색은 폴백이다.**
```js
// Itemverification.gs:594-602, 660
const reLink = /!\[([^\]\n]*)\]\((https:\/\/drive\.google\.com\/[^)\s]+)\)/g;
push(m[1], (m[2].match(/[-\w]{25,}/)||[])[0] || null);
const id = ref.id || iv_findFigIdByName_(ref.name);
```
호스트는 **`https://drive.google.com`만**이고 alt는 **빈 문자열도 허용**한다(`[^\]\n]*`). → C2·D33.

**N4 — 이름 폴백이 Drive 전역을 뒤진다.** `iv_findFigIdByName_`(608-637)은 폴더에서 못 찾으면 `DriveApp.getFilesByName(name)`으로 드라이브 전체를 검색한다. ⚠ **Mathory는 따라 하지 말 것** — 61e D12(폴더 고정)가 프록시 4중 방어의 한 축이다.

**N5 — 그림 재추출은 파일 id를 바꾼다.** `saveBlob_`(193-199)은 **동명 파일을 휴지통에 보내고 새로 만든다.** 시트에 이미 박힌 링크의 id는 재추출 후 **휴지통 파일**을 가리킨다. → D29에서 id 우선을 기각한 근거.

**N6 — svg가 만들어질 수 있다.** `extFromUrl_`(186-191)의 허용 확장자에 `svg`가 있다. GAS 검증기는 `IMAGE_MIME_OK`에 없다며 **제외하고 Y열에 사유를 남긴다**(576행 주석이 명시). → D35.

**N7 — E열의 그림 유실 전제(61e D13)는 그대로다.** `normalizeProblem.gs:161-177`이 선택지 뒤 잔여를 `trailer`로 떼고 `TRAILER_DROPPED` 경고만 남긴다. B열 복구 로직의 근거가 살아 있다.

**N8 — `pv_load_`는 M열(get) 체크박스도 지운다.** A~AC를 통째로 clearContent하고 A~K만 다시 쓴다 → 마법사의 **"사전 선별된 문제 포함하기"는 pv_load_ 직후 Data_DS에서 항상 0건**이다(`app/api/sheet-import/route.ts:161`의 안내 경고가 이미 그 상황을 설명한다). 코드 변경 없이 D27 안내문 한 줄로 족하다.

---

## 3. 정정 목록 (C1~C11)

| # | 대상 | 정정 |
|---|---|---|
| **C1** | v2 머리말 | CLI가 GAS 레포를 읽을 수 있다(§1). 로컬 사본은 stale |
| **C2** | v2 §4-1 정규식 | `(?:drive\|docs)\.google\.com`은 GAS(`https://drive.google.com`만)보다 넓다 → D33 |
| **C3** | v2 D22 "추가" | NFC/NFD 이중 검색은 **선택이 아니라 필수**다(N1+N2가 만든 구조적 불일치) |
| **C4** | v2 §4-3 | **NFD 이름은 `FIG_NAME_RE`에서 400으로 막혀 검색까지 가지 못한다.** NFD 한글은 U+1100 계열 자모라 `[가-힣ㄱ-ㅎㅏ-ㅣ]`(U+AC00·U+3131 계열)에 안 걸린다 — 실측: NFD `false` / NFC로 되돌리면 `true`. **정규식 검사를 NFC 정규화 *뒤*로** 옮겨야 D22가 비로소 동작한다. 61e에도 있던 잠복 버그다 |
| **C5** | v2 U2 "영향 0" | 근거 명시: 열 추가가 전부 `insertColumnsAfter(getMaxColumns(), …)`라 A~P가 밀리지 않는다 |
| **C6** | v2 U3·U7 | 인용 위치는 `Pipelineverify.gs:477-522`. Data_DS는 pv_load_와 Movetostack에서 **두 번** 비워진다. 패치 11 형식은 B·C **둘 다**에 실린다 |
| **C7** | v2 D23 | `origText` 복원은 저장본에 **깨진 `<img>`** 를 남긴다 = 고치려는 증상의 재현. 미리보기 `FigurePreview`가 약속하는 문자열과도 어긋난다 → D30 |
| **C8** | v2 §4 누락 | ① `applyAutoFix`의 choices 가드(`SheetImportModal.tsx:104`) ② D3′ 선택지 경고(`sheetImport.ts:323`) ③ O열 경고(`:368`) — 셋 다 `\includegraphics`만 본다. 새 형식이 오면 **alt 안 숫자가 수식화**된다(URL은 proofread가 보호하지만 **alt는 무방비**) |
| **C9** | `INCLUDEGRAPHICS_RE`(`:187`) | GAS는 `\\includegraphics\s*\{`인데 Mathory는 공백을 허용하지 않는다. `[ \t]*`로 맞출 것(**`\s*` 금지** — CLAUDE.md 행 단위 규약) |
| **C10** | B열 복구(`:332-336`) | `inQuestion` 이름 대조를 **NFC 기준**으로. B는 원문, E는 정규화본이라 형태가 갈릴 수 있다 |
| **C11** | 코드 주석 | `materializeImage`(`SheetImportModal.tsx:158-160`)의 *"이 리터럴이 온전한 것은 proofread의 제어열 보호 덕"* 은 과장이다 — 그 리터럴은 autoFix **이후** 삽입돼 proofread를 지나지 않는다. 보호가 실제로 일하는 자리는 **O열 텍스트와 choices 블록**이다(주석을 그리로 옮길 것) |

---

## 4. 확정 결정의 근거 (D27~D35)

> 표 요약은 §0. 여기엔 검증 턴이 반박할 수 있도록 근거만 남긴다.

- **D29(이름만 조회)** — N5가 결정적이다. 그림을 재추출하면 동명 파일이 휴지통으로 가고 새 파일이 생기므로, 시트에 박힌 링크의 id는 **옛 휴지통 판본**을 가리킨다. 이름 검색은 `trashed=false` + `modifiedTime desc`라 항상 최신을 집는다. GAS가 id 우선인 것은 *같은 실행 안이라 링크가 신선하기 때문*이지 일반 원칙이 아니다.
  ⚠ **fileId 폴백은 만들지 않는다** — "id로 되살아난 것이 하필 지워진 옛 그림"인 갈래가 생긴다. 실사용에서 미발견이 실제로 관측되면 그때 연다(§9 O4).
- **D30(리터럴 유지)** — `origText`를 복원하면 `![이름](Drive링크)`가 그대로 남아 **깨진 이미지**가 된다. 이번 작업이 없애려는 "주소만 붙는" 증상과 화면상 구별되지 않는다. `FigurePreview`(`:754`)가 "저장본에 남을 것과 같은 모습"으로 `\includegraphics{…}`를 보여 주는 약속도 깨진다. 클릭 가능한 링크(`[name](url)`)로 강등하는 안은 **비공개 Drive URL이 본문에 남아** 공개 공유·Bazaar로 흘러간다.
  → **`DraftBlock`에 `origText` 필드를 추가하지 않는다.** 재가져오기·중복 판정은 시트 원문(`stemHash`) 기준이라 왕복 충실도가 필요 없다.
  (유일한 손실: `\includegraphics[width=5cm]{…}`의 옵션 인자가 폴백에서 떨어진다 — 61e부터 그랬고 무해하다.)
- **D31(proofread 보호)** — 현행 보호 목록(`proofread.ts:341`·`:402`)은 `https?://\S+`로 **URL만** 지킨다. alt는 무방비라 `연구실모의6회(260824)…`의 `6`·`260824`가 `$…$`로 감싸인다. 같은 구멍이 **편집창 [교정]에도** 있다(손으로 쓴 `![그림1](…)`). 한 줄씩 두 곳이면 양쪽이 함께 닫힌다.
  ⚠ **`convertJamoRefs`에는 넣지 말 것** — 제어열 인자 안의 참조까지 변환하는 것이 명시된 사양이다(CLAUDE.md, 덕수 2026-08-26).
  ⚠ D31을 해도 **C8의 세 자리는 별도로 고쳐야 한다** — 그건 보호 문제가 아니라 "손댈 이유가 없는 블록은 손대지 않는다"는 D3′ 방침이다.
- **D32(정규식 소유 이주)** — `app/api/sheet-import/route.ts:22`가 이미 `lib/sheetImport`를 import한다. **import 0 규약은 sheetImport가 *남을* import하지 않는다는 뜻**이라 저촉되지 않고, `npm run test:sheet`의 단독 컴파일도 그대로 성립한다. 게이트가 갈리면 접미사만 맞고 몸통에 공백·`#`이 든 이름이 **클라에서 분할된 뒤 프록시에서 400**이 난다.
- **D33(호스트 좁히기)** — 경계 판정은 좁을수록 안전하다. 모르는 형식은 **오늘 동작(텍스트 유지 + 경고)** 으로 떨어지지 새 갈래로 새지 않는다. `f.getUrl()`이 내는 것은 항상 `https://drive.google.com/file/d/<id>/view?usp=drivesdk`다.
- **D27** — 안내문에 N8을 넣는다: *"Data_DS는 마지막 검증 실행분만 담고, 불러올 때마다 M열 체크박스까지 비워집니다. 누적본은 Stack입니다."*
- **D28** — C5로 근거가 더 단단해졌다(열이 뒤에만 붙는다). `fig_info`는 "검증 요청에 뭐가 첨부됐나"의 기록이지 원본 그림의 존재 증명이 아니고, Mathory는 자체 이름 대조(미발견 경고)를 이미 한다.

---

## 5. 구현 사양

### 5-1. `lib/sheetImport.ts`

**① `FIG_NAME_RE`를 이 파일로 이주·export** (D32). 값은 현행 그대로:
```ts
/** Drive `IMAGE_FIG`의 허용 파일명. **클라 게이트와 서버 게이트가 이 하나를 공유한다**(D32).
 *  ⚠ `'`를 배제해 Drive 검색 `q`의 따옴표 이스케이프를 아예 불필요하게 만든다.
 *    NFC 정규화로는 `'`가 새로 생기지 않으므로 그 방어는 정규화 후에도 유지된다. */
export const FIG_NAME_RE =
  /^[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ()._\-]{1,200}_fig\d+\.(jpe?g|png|gif|webp)$/;
```
`figure/route.ts`의 사본은 삭제하고 import로 바꾼다.

**② 통합 스캔 정규식 하나** — 두 정규식을 따로 돌려 병합하지 말 것. **교대(alternation) 한 벌**이면 인덱스 순서가 공짜다:
```ts
/** `\includegraphics[opt]{name}` | `![alt](https://drive.google.com/…)`  (Phase 61e-2차)
 *  m[1] = 구형 태그 이름 / m[2] = alt / m[3] = Drive 링크
 *  ⚠ `[ \t]*`다 — `\s*`는 개행을 삼킨다(CLAUDE.md). GAS는 `\s*`지만 태그를 만드는 쪽도 GAS라 공백은 없다.
 *  ⚠ 호스트를 `drive.google.com`으로 좁힌 것은 의도다(D33) — 모르는 형식은 오늘 동작으로 떨어진다. */
const FIG_SCAN_RE =
  /\\includegraphics[ \t]*(?:\[[^\]\n]*\])?\{([^}\n]+)\}|!\[([^\]\n]*)\]\((https:\/\/drive\.google\.com\/[^)\s]+)\)/;
```
`INCLUDEGRAPHICS_RE`는 **남긴다** — C8-②③의 경고 판정이 통합 스캔으로 바뀌므로 소비처가 사라지면 함께 지운다(구현 시 확인).

**③ `MATHPIX_IMG_RE`(`:190`)를 비-Drive 전용으로 좁힌다** — 안 그러면 정상적인 패치 11 링크마다 "변환되지 않은 Mathpix 링크" 경고가 덧난다:
```ts
const FOREIGN_IMG_RE =
  /!\[[^\]\n]*\]\(\s*(?!https:\/\/drive\.google\.com\/)https?:\/\/[^)\s]+\s*\)/;
```
**경고 문구는 현행 유지**(테스트 F7이 `/Mathpix/`를 본다).

**④ `splitFigures`** — `FIG_SCAN_RE`로 한 번 훑는다.
- 구형 태그(`m[1]`): 지금과 같이 image 블록(`figName = m[1].trim()`).
- Drive 링크(`m[2]`): **`FIG_NAME_RE.test(alt.trim().normalize('NFC'))`가 참일 때만** image 블록.
  - **`figName`은 원문 그대로 저장한다** — NFC로 바꾸지 않는다. 정규화 시도는 프록시가 한다(D29).
  - ⚠ **게이트 판정에는 NFC를 쓴다**(실측 4). 원문 그대로 검사하면 NFD alt가 규격 외로 떨어져 분할 자체가 안 된다.
- 거짓이면 **경계로 삼지 않고** 경고: `'그림 링크의 파일명이 규격과 다릅니다(<alt>) — 본문에 그대로 둡니다'` (D24).
- `FOREIGN_IMG_RE` 경고는 현행 위치에서 그대로.
- ⚠ **그림이 하나도 없으면 원문 그대로 text 블록 1개**를 돌려주는 갈래를 없애지 말 것(61a 비트 동일 규약, 빈 문자열도 포함).

**⑤ `scanFigureNames`(B열 복구)** — 같은 통합 스캔을 쓴다. **B는 정규화 전 원문이라 새 형식이 반드시 온다**(C6). alt 게이트는 `splitFigures`와 동일하게 적용한다(규격 외 이름을 복구 블록으로 만들면 프록시에서 400이 난다).

**⑥ 이름 대조는 NFC 기준** (C10) — `rowToDraft`의 `inQuestion` Set에는 `name.normalize('NFC')`를 넣고 조회도 같은 형태로 한다. **블록에 담는 `figName`은 원문 그대로**다.

**⑦ D3′ 선택지 경고(`:323`) · O열 경고(`:368`)** 를 통합 스캔 기준으로 (C8-②③).

**⑧ 손대지 않는 것**: `stemHash`(분할 전 `normalizeText(E)` 기준 — 61e N-4) · `normalizeText` · 열 매핑 · `A1:P` 범위 · `$$` 정규화를 `toPersistedBlock`에 위임하는 규약 · `DraftBlock` 필드(D30).

**실측표 (node 확인 완료)**

| 입력 | 결과 |
|---|---|
| `앞 \includegraphics{a_fig1.jpg} 가운데 ![<한글>_fig1.jpg](drive) 뒤` | tag(idx 2) · link(idx 35) — **등장 순서** |
| `\includegraphics {a_fig1.jpg}`(공백) | 잡힌다 (C9) |
| `![무제 1.jpg](drive)` | 잡히지만 게이트 `false` → 비분할 + 경고 |
| `![<NFD 한글>_fig1.jpg](drive)` | 게이트 `true`(NFC 판정 덕) → 분할 |
| `![…](drive)`만 있는 텍스트 | `FOREIGN_IMG_RE` **false** (경고 안 덧남) |
| `![](https://cdn.mathpix.com/x.jpg)` | `FOREIGN_IMG_RE` **true** (F7 무회귀) |
| `![…](drive)` + mathpix 둘 다 | `FOREIGN_IMG_RE` **true** |

### 5-2. `components/import/SheetImportModal.tsx`

**① `applyAutoFix`의 choices 가드(`:104`)를 두 형식으로** (C8-①):
```ts
/** ⚠ 두 형식을 함께 본다 — 새 형식(패치 11)이 선택지 셀에 오면 URL은 proofread가 지켜도
 *    **alt가 무방비**라 `연구실모의$6$회…`가 된다(Phase 61e-2차 C8). */
const CHOICE_FIG_RE = /\\includegraphics|!\[[^\]\n]*\]\(https:\/\/drive\.google\.com\//;
…
if (b.type === 'choices' && CHOICE_FIG_RE.test(b.raw_text)) return { text: b.raw_text, count: 0 };
```

**② `materializeImage` 불변**(D30) — `\includegraphics{figName}` 폴백 유지. **주석만 C11대로 정정**: 제어열 보호가 실제로 일하는 자리는 O열 텍스트·choices 블록이라고 옮겨 적는다.

**③ 나머지 불변**: 지연 로딩 · `SAVE_CONCURRENCY 4` · blob URL 회수 · 업로드 · 롤백 `deleteObject` · 자동 수정 토글 · `X-Fig-Duplicates` 배지.

### 5-3. `app/api/sheet-import/figure/route.ts`

```ts
import { FIG_NAME_RE } from '../../../../lib/sheetImport';   // D32 — 게이트 단일 소유

const raw = (req.nextUrl.searchParams.get('name') ?? '').trim();
if (!raw) return fail(400, 'name 파라미터가 필요합니다');

// ⚠ 정규식 검사는 **NFC 정규화 뒤**에 한다(C4).
//   NFD 한글은 U+1100 계열 자모라 `[가-힣]`에 안 걸려, 그냥 검사하면 검색 전에 400으로 죽는다.
//   패치 11이 alt를 nfc_()로 만드는데 Drive 실제 파일명은 원형이라 두 형태가 다 온다(N1·N2).
const nfc = raw.normalize('NFC');
if (!FIG_NAME_RE.test(nfc)) {
  return fail(400, '허용되지 않는 파일명입니다 — 시트가 만든 그림 파일만 가져올 수 있습니다');
}

// Drive는 저장된 문자열을 그대로 비교한다 → NFC 먼저, 0건이면 NFD로 한 번 더 (D29)
const variants = Array.from(new Set([nfc, raw.normalize('NFD')]));
let hit: Awaited<ReturnType<typeof findFile>> | null = null;
for (const v of variants) {
  const r = await findFile(v, token, env);
  if (r.file) { hit = r; break; }
}
if (!hit) return fail(404, '그림 파일을 Drive에서 찾지 못했습니다');
```
- `X-Fig-Duplicates`는 **적중한 변형의 개수**를 쓴다. 두 정규형에 파일이 갈려 있는 경우는 보고하지 않는다 — **알고 두는 손실**.
- ⚠ **드라이브 전역 검색(N4)을 따라 하지 말 것.**
- 화이트리스트 · 폴더 고정 · `verifyUid` · 허용목록 · `drive.readonly` 단독 JWT · `modifiedTime desc` — 전부 불변.

### 5-4. `lib/proofread.ts` (D31)

`autoWrapBareNumbers`(`:341` 부근)와 `autoWrapBareLetters`(`:402` 부근)의 보호 수집부에 각각 한 줄:
```ts
addAll(/!\[[^\]\n]*\]\([^)\s]*\)/g);   // 마크다운 이미지 — URL은 이미 보호되지만 alt가 무방비다
```
⚠ **`convertJamoRefs`에는 넣지 않는다.**

---

## 6. 테스트 증설

### `npm run test:sheet` — 53 → **64건**

| 태그 | 내용 |
|---|---|
| F9 | 패치 11 형식 단독 분할 → `text/image/text`, `figNames=[alt]` |
| F10 | 한 셀에 두 형식 공존(패치 11이 링크 못 찾은 태그를 남긴 행) — **등장 순서대로** 블록이 나온다 |
| F11 | 규격 외 alt(`무제 1.jpg`)는 분할하지 않고 경고 |
| F12 | 비-Drive 이미지 링크는 현행 경고 + 비분할 (**F7 무회귀**) |
| F13 | Drive 링크만 있을 때 Mathpix 경고가 **덧나지 않는다** |
| F14 | `\includegraphics {name}`(공백)도 잡힌다 (C9) |
| F15 | `FIG_NAME_RE`가 NFD 원문에는 `false`, NFC로는 `true` — C4의 회귀 고정 |
| F16 | **NFD alt도 분할된다** — 게이트가 NFC로 판정하기 때문 (5-1-④의 ⚠) |
| G11 | B열이 새 형식일 때도 복구된다 (C6) |
| G12 | B·E의 정규형이 갈려도 **중복 복구가 일어나지 않는다** (C10) |
| G13/G14 | 선택지 셀·O열의 새 형식에 경고가 뜬다 (C8-②③) |

### `npm run test:proofread` — +2건

- 마크다운 이미지의 **alt 안 숫자·문자가 수식화되지 않는다**(`![a_fig1.jpg](http…)` · 한글 alt).
- URL 보호·기존 제어열 보호는 그대로.

### 무회귀 관문
10종 전량. CLAUDE.md 기준 **289 → 302건**. `test:sheet` 기존 53건은 한 건도 바뀌지 않아야 한다(F7 포함).

---

## 7. 작업 순서 · 검수 관문

1. **`lib/proofread.ts` 보호 1줄 ×2 + 테스트** — 관문: `test:proofread` 통과.
   *(먼저 하는 이유: 61e 커밋 1이 그랬듯, alt 보호가 성립해야 아래 폴백·경고 갈래의 전제가 선다.)*
2. **`lib/sheetImport.ts` 통합 스캔 + `FIG_NAME_RE` 이주 + 테스트** — 관문: §6 전건 통과, 기존 53건 무회귀.
3. **프록시 NFC/NFD + 모달 choices 가드** — 관문: **한글 파일명 실물 1건이 어느 정규형으로 요청해도 200.**
   실측 절차: Drive에서 파일명을 복사해 `[...name].map(c=>c.codePointAt(0).toString(16))` — `1100` 계열이 보이면 NFD다. 두 형태를 각각 `/api/sheet-import/figure?name=`에 넣어 본다.
4. **실데이터 검수 관문**
   - ① 문제검토 Data_DS(검증 직후 = 새 형식) 그림 문항 **5건 이상** — 미리보기 그림 실물 = 저장 후 렌더(흑백 multiply·폭)
   - ② **Stack의 08-30 구형 세트 1건**(`\includegraphics` 잔존) — 구형 경로 무회귀
   - ③ 한 셀에 두 형식이 공존하는 행 1건
   - ④ 자동 수정 ON/OFF 토글에 **중복 배지 불변**(`stemHash`가 분할 전 값이라는 계약)
   - ⑤ 선택지 셀에 그림이 든 행에서 alt가 수식화되지 않는지(실물이 없으면 손으로 만든 셀로 대체)
5. **운영(덕수)**: 이미 "주소만 붙은" 채 가져온 문항은 배포 후 같은 행 재가져오기로 교체(기존 것 삭제 → 휴지통). E 원문이 달라져 **중복 배지가 안 뜰 수 있다.** 마법사 안내문 갱신(D27 + N8).
6. **문서화**: 결과를 `docs/phasedocs/`에 실행판으로 등록, roadmap·CLAUDE.md 갱신 + 재발 방지 각서 —
   *"그림 표기 계약이 바뀌면 `splitFigures` · `scanFigureNames` · `applyAutoFix` 가드 · D3′/O열 경고 · 폴백 리터럴이 **함께** 움직인다(다섯 자리)."*

---

## 8. 검증 1턴 체크리스트

한 턴에 볼 것만 추렸다. **①②는 이 계획의 성립 조건**이다.

1. **C4가 맞나** — `'…_fig1.jpg'.normalize('NFD')`가 `FIG_NAME_RE`에 걸리지 않는다는 것, 그래서 v2의 D22만으로는 아무 효과가 없다는 것.
2. **N1·N2가 맞나** — 패치 11의 alt가 `nfc_()`이고(`Datalatex_To_Data_DS.gs:184-191`) Drive 파일명은 `stemOf_`의 원형(`Mathpix 그림 추출.gs:85,229`)이라는 것. 이 둘이 아니면 D29·C4가 통째로 무의미해진다.
3. **D30이 옳나** — `origText` 복원이 저장본에 깨진 `<img>`를 남긴다는 판단. (반대 의견이 있으면 여기서 뒤집는 편이 싸다 — 구현 후엔 `DraftBlock` 필드 추가가 딸려 온다.)
4. **D33이 너무 좁지 않나** — `docs.google.com`·`http`를 배제해도 되는지. 근거는 `f.getUrl()`의 실제 반환 형태.
5. **§5-1-④의 게이트 NFC 판정** — `figName`은 원문, 게이트는 NFC라는 **비대칭**이 의도대로 읽히는지.
6. **C8의 세 자리가 다인가** — `\includegraphics` 문자열을 보는 자리가 그 셋 말고 더 없는지(`grep -rn 'includegraphics' lib components app`).
7. **누락 위험** — 그림 표기 계약이 닿는 다섯 자리(§7-6) 외에 렌더 5사이트·전처리에 영향이 없다는 판단.

---

## 9. 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| **O1** | `hasImages` 죽은 필드(61e) — 그림이 image 블록이 되면 정밀 검증이 그림을 못 본다 | **61f 후보 · 우선순위 하향 유지.** GAS 패치 12·13이 검증 쪽 그림 첨부를 해결했으므로 Mathory 검증의 손실만 남는다 |
| O2 | 미결: `[4점]` → `[$4$점]` (61e §5 O-A) | D31과 **성격은 같지만**(문맥상 수식이 아닌 숫자) 별건이다 — 함께 고치지 말 것 |
| O3 | Drive 파일명 정규형 실태 | 관문 3에서 실측. NFD가 실제로 있으면 **61e부터 조용히 실패하던 그림이 있었다는 뜻**이라 기록할 것 |
| O4 | fileId 폴백(D29에서 보류) | 실사용에서 이름 미발견이 관측되면 연다. 열 때는 **부모 폴더 검증 + 휴지통 판본 배제**가 조건 |
| O5 | svg 그림(N6) | 실물이 나오면 61f |
| P2 | latex-convert `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 열림 — GAS, 이번 구현과 무관 |
| P5 | J열 `diagram_boxes` 크기 필터 | 후속 |
| — | Stack 기존 행 Y/Z→AD/AE 마이그레이션(`mts_migrateSetCols` 1회) | 덕수 — Mathory와 무관 |

---

*v3 착수판 — mathory `466d347` · audition `8ebb218` · latex-convert `7719d12` 원본 대조. v2 대비 정정 11건(C1~C11) · 새 사실 8건(N1~N8) · 결정 9건 확정(D27~D35). 다음: 검증 1턴(§8) → 착수.*
