# Phase 61e 타당성 검토 — 시트 가져오기 × 그림 블록 · 교정(proofread) 연동 (v2 · CLI 교차검토 **확정판**)

> 작성: CLI(Claude Code) 2026-08-30 · 저본: `docs/phaseSketch/Phase61e_review_v1.md`(web)
> **덕수 판정 2026-08-30: v2의 권장안을 전부 채택.** 아래 §3의 결정 20건은 모두 **확정**이다.
> 실측 원천: 로컬 워킹트리 `mathory` HEAD `b3a9612` 직접 읽음 · `.env.local` 직접 조회 ·
> `lib/proofread.ts` **단독 컴파일 후 실행 프로브**(§2 N-1) · Drive 파일 메타데이터 1건 조회.
> ⚠ GAS 두 저장소는 CLI가 볼 수 없다 — **§1-1(G1~G10)은 v1을 그대로 신뢰**하고 검증하지 않았다.
> ⚠ 스프레드시트 본문(S1~S7)도 2.7MB라 CLI가 전량을 읽지 않았다 — web 실측을 채택하되,
>   착수 전 실물 확인이 필요한 항목은 §6에 남긴다.

---

## 0. 결론 한 줄

**v1의 방향(그림 = 별도 블록 · 교정 = 결정적 자동 수정만)은 옳다. 다만 v1이 "0건"이라고 적은 곳 중
두 곳이 실제로는 0건이 아니고, 결정 두 쌍(D5↔D9, D3↔실물)이 서로 충돌했다 — 둘 다 이 판에서 풀었다.**

정정 9건(C1~C9) · 신규 실측 10건(N1~N10) · 신규 결정 6건(D15~D20). **전부 확정.**
가장 값비싼 발견은 **C2**다 — v1대로 구현하면 D5의 복구 장치(리터럴 보존)를
D9의 기본값(자동 수정 ON)이 **같은 저장 경로 안에서 파괴한다**. 실행 프로브로 재현했고,
**D15가 그 매듭을 푼다 — 그래서 D15는 구현 순서의 맨 앞이다.**

---

## 1. v1 정정

### C1. ⚠ `hasImages`는 **죽은 필드**다 — v1 §4 "부수 효과" 서술이 반대로 적혔다

v1 §4:
> 그림 문항이 image 블록을 갖게 되어 정밀 검증(61b/61d)에 `hasImages`가 참이 된다(M10)
> → 검증 프롬프트가 "그림을 봐야 한다면" skip/uncertain 처리. 의도한 방향

**실측**: `hasImages`는 `app/api/verify/route.ts:116`의 요청 인터페이스에 **선언만 되어 있고
라우트 어디에서도 읽지 않는다**. `lib/verify/prompts.ts`에는 등장조차 하지 않는다.
프롬프트의 그림 관련 지침(`prompts.ts:91` skip · `:315` uncertain)은
**`hasImages`와 무관하게 항상** 실려 나간다.

따라서 이번 변경의 실제 부수 효과는 v1이 적은 것과 **반대**다:

| | 현재(그림이 텍스트) | 변경 후(그림이 image 블록) |
|---|---|---|
| `verifyBlocksOf` | `\includegraphics{…}` 문자열이 **블록 텍스트에 포함** | image 타입이라 **통째로 필터링**(`verifyFlow.ts:22`) |
| 모델이 받는 신호 | "여기 그림이 있다"를 문자열로 알 수 있다 | **그 자리에 아무것도 없다** |

즉 **그림 문항의 검증 품질이 조용히 나빠진다.** → 결정 **D19**(범위 밖으로 두되 기록).

### C2. ⚠ **`autoFixDeterministicIssues`가 `\includegraphics` 리터럴을 파괴한다** — D5와 D9가 충돌

v1은 D5(a)에서 "다운로드 실패 시 `\includegraphics{…}` **리터럴 유지** — 나중에 검색으로 되찾을 수
있다"고 했고, D8/D9(a)에서 "가져오기 때 결정적 자동 수정을 **기본 ON**"이라고 했다.
두 결정이 **같은 저장 경로 안에** 있다. 실행 프로브 결과:

```
IN : 그래프가 그림과 같다. \includegraphics{S학모의6회(260722)_문제_1공통14_fig1.jpg} 이때 $f(1)$의 값은?
OUT: 그래프가 그림과 같다. \$includegraphics${$\mathrm{S}$학모의$6$회(260722)_문제_$1$공통$14$_fig1.$jpg$} 이때 $f(1)$의 값은?
                          ^^^^^^^^^^^^^^^^^^^  count=6
```

원인은 `autoWrapBareLetters`(`lib/proofread.ts:386`)와 `autoWrapBareNumbers`(`:327`)의
**보호 목록에 LaTeX 제어열이 없다**는 것이다. 보호 대상은 수식 영역 · HTML 태그 · URL ·
마크다운 링크 · 인라인 코드 · `\tag`/`\ref` · `(n)` · 행 선두 `n.` 뿐이고,
`\includegraphics`·`\begin`·`\item` 같은 **일반 제어열은 무방비**다. 같은 프로브:

```
IN : \begin{itemize}\n\item 첫째 조건\n\end{itemize}
OUT: \$begin${$itemize$}\n\$item$ 첫째 조건\n\$end${$itemize$}     count=6
```

결과: 파일명이 `$…$` 조각으로 흩어져 **`includegraphics`로 검색해도 안 나오고**, 화면에는 깨진
수식이 뜨며, 사람이 손으로 되돌리기도 어렵다. D5의 복구 장치가 **작동 전에 소멸**한다.

⚠ 이것은 이번 Phase가 만드는 버그가 아니라 **이미 존재하는 버그**다 — 편집창에서 `\item`이 든
블록을 두고 [교정]을 누르면 오늘도 같은 일이 난다. 다만 가져오기는 **수십 문항에 일괄로**,
그리고 **사람이 각 문항을 보지 않은 채** 적용된다는 점이 다르다. → 결정 **D15**.

⇒ **v1 §4의 "0건: `lib/proofread.ts`"는 성립하지 않는다.**

### C3. `AUDITION_SPREADSHEET_ID` 대조 — **확인 완료**(v1의 열린 질문 해소)

```
.env.local: AUDITION_SPREADSHEET_ID=1hrvhHVRCqWHdoCUu6ECBoAWNmoDwDKbGMrpyeOa6XDk
Drive 메타 : title="문제 검토", owner=kimdeoksoo@gmail.com, modifiedTime=2026-08-30T12:06:18Z
```
v1 §1-3이 지목한 시트와 **동일**하다. §1-3의 "대조 확인 필요"는 닫힌다.
서비스 계정은 `mathory-sheet-reader@mathory-d7d03.iam.gserviceaccount.com`
— §5의 폴더 공유 대상은 이 주소다(v1은 `GOOGLE_SA_EMAIL`이라고만 적었다).

### C4. `app/api/sheet-import/route.ts`는 **수정 대상이 아니다** — v1 §4의 오분류

v1 §4 수정 목록: *"`app/api/sheet-import/route.ts`(JWT 스코프에 `drive.readonly` 추가 → 시트
라우트와 SA 공유)"*.

**실측**: `getJwt()`는 그 파일의 **모듈 스코프 싱글턴**이고 스코프가 `spreadsheets.readonly`
하나로 잠겨 있다(`route.ts:70-78`). figure 라우트는 **별개 모듈**이므로 자기 JWT 싱글턴을
`drive.readonly` 하나로 만들면 된다. 시트 라우트 파일은 **한 줄도 건드리지 않는다.**

그렇게 해야 하는 적극적 이유도 있다 — 시트 라우트의 설계 문구가
*"쓰기 API를 부르지 않는 것이 아니라 **부를 수 없다**"* 인데, 공용 JWT에 스코프를 더하면
그 잠금이 **시트 라우트에서도** 느슨해진다. → 결정 **D20**.

### C5. "렌더 5곳"과 "정규식 6곳"은 다른 수다 (미세)

`raw_text.match(/src="([^"]+)"/)`는 **6곳**에 있다 — `EditorView:438`(블록 렌더)과
`EditorView:3759`(별도 소비처)가 같은 파일 안에 둘이다. 나머지는 `TabBody:120` ·
`FolderView:291` · `ProblemTabContent:49` · `PrintableContent:249`.
CLAUDE.md의 "렌더 사이트 5곳"은 여전히 맞다(사이트 수). 다만 `<img>` 형식을 손대는 날에는
**6군데**를 봐야 한다. 이번 Phase는 형식을 바꾸지 않으므로 실질 영향 없음.

### C6. 미리보기 모달에는 **`image` 타입 분기가 없다** — D7이 자기 목표를 못 지킨다

`SheetImportModal.tsx:625-629`의 분기는 `choices` ↔ 그 외 **둘뿐**이다.
`type:'image'` 블록을 그냥 `EditorPreview`에 넘기면 `rehypeRaw` 덕에 그림 자체는 나오지만,
**렌더 5곳이 공유하는 처리(`imageWidth` · multiply 블렌드 · 흑백)가 하나도 걸리지 않는다.**
컬러 원본이 400px로 뜨고 저장 후에는 흑백 multiply로 보인다 → D7이 내세운
"미리보기에서 **저장될 실물**을 본다"가 깨진다. → 결정 **D18**.

### C7. 화면에는 `img { max-width: 100% }` 전역 규칙이 **없다**

`app/globals.css`에서 `img` 셀렉터는 `img.twemoji` 하나뿐이고, `EditorPreview`에는
`img` 컴포넌트 오버라이드가 없다. 즉 raw `<img width="400">`은 **화면에서 컨테이너를 넘친다.**
(인쇄만 안전하다 — `PrintableContent:148`이 `maxWidth:'100%'`를 강제한다.)

⇒ 선택지 안 인라인 그림은 **폭을 줄이는 것만으로 부족하고 `max-width:100%`를 함께 실어야** 한다
(`hast-util-to-jsx-runtime`이 style 문자열을 객체로 파싱하므로 React에서 안전하다).

### C8. D3의 전제가 실물과 어긋난다 — S3은 "선택지 **안**"이 아니라 "선택지 **뒤**"다

v1 §1-3 S2③·S3은 1공통13을 *"정지 ⑤ 뒤"* 로 적었다. 그것은 **선택지 다섯 셀 중 하나에 든
그림이 아니라 선택지 블록 전체 뒤에 붙은 꼬리 그림**이다. 그런데 D3은 이 사례를 근거로
"선택지 텍스트에 inline `<img>`"를 결정했다. 두 경우는 처리도 위험도 다르다. → 결정 **D3′**.

### C9. 미리보기는 **펼친 행만** 렌더한다 — 전건 선다운로드는 전제가 틀렸다

`SheetImportModal.tsx:607` — `{expanded && draft && (…)}`. 행은 기본 접힘이고 `expanded`는
**단일 rowIndex**(한 번에 한 행만 펼쳐진다). 즉 500행을 가져와도 실제로 렌더되는 본문은 1행치다.

v1 §2-1의 흐름도를 그대로 만들면 Stack 대량 가져오기에서 **수백 장을 아무도 안 볼 화면을 위해
내려받는다.** → 결정 **D16**.

---

## 2. v1 보완 — CLI 신규 실측

### N-1. 실행 프로브(재사용 가치 있음)

```bash
npx tsc lib/proofread.ts lib/latexScan.ts --outDir <scratch>/pf --rootDir . \
  --module commonjs --target es2022 --moduleResolution node --skipLibCheck
node -e "…autoFixDeterministicIssues(input)…"
```
`lib/proofread.ts`는 import가 `./latexScan` 하나뿐이라 **둘만 컴파일하면 단독 실행된다.**
프롬프트 왕복 없이 결정적 규칙의 실제 출력을 볼 수 있다 — 이번 검토의 C2가 여기서 나왔다.
**D15의 회귀 하니스(`test:proofread`)가 이 구성을 그대로 굳힌다.**

⚠ 부수 발견: `lib/proofread.ts`는 `file(1)`이 **`data`로 판정**한다(내부에 비ASCII 제어 문자열
`⟦M0⟧` 등). 그래서 **맨 `grep`이 매치를 조용히 감춘다** — `grep -a`를 쓸 것.
(이 저장소에서 "분명히 있는데 grep이 0건"이면 이 함정을 먼저 의심할 것.)

### N-2. 마커·조판 규약은 자동 수정에 안전하다 (실측 count=0)

| 입력 | 결과 |
|---|---|
| `ㄱ. $a=1$` / `ㄴ.` / `ㄷ.` | 무변경 (count 0) |
| `(가) 첫 조건` / `(나) …` | 무변경 (count 0) |
| `15. 다음 <보기>에서 …` + `ㄱ.` 항목 | 무변경 (count 0) |
| `7. 실수 전체의 집합에서 … 함수 f가 …` | `f` → `$f$` 만. **`7.`은 보존**(행 선두 ol 마커 보호) |
| `① 1 / ② 2 / ③ 3` | `① $1$ …` — 편집창의 choices 처리와 **동일**(EditorView:1440 주석의 명시 동작) |
| `옳은 것은 (ㄱ), (ㄴ)이다.` | `(1), (2)` — 아래 N-3 |

즉 v1 §1-3 S7의 우려("`7.`이 목록 마커로 보호되므로 손상되지 않는다")는 **실측으로 확인**됐다.
Phase 60 로케일 규약(`(가)`·`ㄱ.` 리터럴 보존)도 침범되지 않는다.

### N-3. `(ㄱ)→(1)` 변환은 정의부·참조부를 **함께** 바꾸므로 일관적이다

편집창에서는 `roman`·`choices` 타입에서만 이 변환을 끈다(`skipJamoRefs`). 가져오기에서는
보기 정의부와 참조부가 **한 text 블록에 함께 들어오므로 타입으로 가를 수 없다** —
그래서 둘 다 변환된다. 실측상 이것은 **문제가 아니다**: `(ㄱ) 첫 조건 … 옳은 것은 (ㄱ)`이
`(1) 첫 조건 … 옳은 것은 (1)`이 되어 **짝이 유지**되고, `(1)` 형태는 한국 문항에서 정당한 표기다.
2026-08-30 "GAS에서 `(ㄱ)→(1)` 변환 제거, Mathory가 담당" 결정과도 정합한다. **추가 조치 불필요.**

### N-4. `stemHash`는 반드시 **자동 수정 전** 텍스트로 계산해야 한다

`rowToDraft`는 `stemHash(stem)`에서 `stem = normalizeText(E)`를 쓴다(`sheetImport.ts:271`).
자동 수정을 이 뒤에 끼우면 **체크박스 상태가 중복 키를 바꾼다** — 켜고 한 번, 끄고 한 번
가져오면 같은 문항이 **중복으로 감지되지 않고 두 벌** 저장된다.
⇒ 규약: **`stemHash`는 `normalizeText` 직후 값으로 고정. 그림 분할·자동 수정 어느 것도 앞서지 않는다.**

### N-5. 인증 프록시는 `<img src>`로 소비할 수 없다

figure 라우트가 `verifyUid`를 요구하면(D12) 브라우저의 `<img src="/api/…">`는
**Authorization 헤더를 실을 수 없어** 401이 된다. 반드시 `fetch(url,{headers})` → `blob()` →
`URL.createObjectURL`이어야 한다. + **`URL.revokeObjectURL`을 행 접힘·모달 닫힘에서 호출할 것**
(펼침/접힘을 반복하는 UI다).

### N-6. Drive는 **동명 파일을 허용한다**

`files.list`의 `name='…'` 검색은 결과가 여러 건일 수 있다(GAS 재실행 시 같은 이름이 다시 생성된다).
⇒ `orderBy=modifiedTime desc&pageSize=2`로 받아 **최신 1건을 쓰고, 2건 이상이면 경고**를 남길 것.

### N-7. 같은 파일명이 문제(E)와 해설(C)에 함께 나올 수 있다

v1 G5 자신이 *"`_해설` 파일도 같은 경로를 판다 → 해설에도 그림이 올 수 있다"* 고 적었다.
한 문항 안에서 같은 이름이 두 번 나오면 **다운로드 2회 · Storage 업로드 2회**가 되어
같은 그림이 두 객체로 남는다. → 결정 **D17**.

### N-8. E가 통째로 그림뿐인 문항은 **검증이 사전 차단된다**

분할 후 question 탭이 `[image]` 하나뿐이면 `verifyBlocksOf`가 빈 배열을 내고
61d 프리플라이트가 `empty_question`으로 막는다(`batchPlan.ts:110`, `route.ts:170`).
**문제뿐 아니라 풀이 검증까지 함께 막힌다**(batchPlan.ts:101의 W6 주석).
⇒ 빈 텍스트 조각을 버릴 때 **question 탭에 텍스트 블록이 하나도 남지 않으면 경고 배지**를 띄울 것.

### N-9. `uploadImage`는 600px 초과일 때만 리사이즈한다

`lib/storage.ts:22` — `img.width <= 600`이면 원본 그대로 통과. v1 S4의 실물 크기
(142×320 · 733×82 · 620×736)를 보면 **대부분 리사이즈 없이 그대로 올라간다**.
확장자는 `file.type === 'image/png' ? '.png' : '.jpg'`이므로, 프록시가 돌려준
**content-type을 `new File(...,{type})`에 실어야** 한다.

### N-10. 저장 경로의 파일명은 이미 한글·괄호를 통과시키고 있다 (v1 P4 확인)

`uploadImage`는 `${timestamp}-${baseName}${ext}`로 Storage 경로를 만든다. 편집창에서
한글 파일명 이미지를 올리는 경로가 **이미 프로덕션에서 같은 일을 한다** → SDK가 인코딩을 처리한다.
Drive 검색 `q`의 `'` 이스케이프만 남는데, **화이트리스트 정규식에서 `'`를 아예 배제**하면
이스케이프 자체가 불필요해진다.

---

## 3. 확정 결정 20건

### 3-1. v1 결정 재판정 (D1~D14)

| # | 확정 | 근거 · 덧붙인 규약 |
|---|---|---|
| **D1** | SA가 Drive `IMAGE_FIG`에서 **파일명으로 검색** | GAS·시트 스키마 변경 0. 동명 파일은 N-6대로 최신 1건 + 경고 |
| **D2** | 본문의 파일명 **위치에서 분할**(text/image/text) | 61a §7 "블록 자동 분할 금지"의 **명시적 예외**로 기록 — 이번 요구의 본질이 분할이다. N-4(stemHash는 분할 전) · N-8(빈 question 경고) |
| **D3′** | **두 갈래로 나눈다** — (i) F~J **셀 안** 그림 → 인라인 `<img width="160" style="max-width:100%">` / (ii) E열 **정지 뒤** 꼬리 그림 → choices 블록 **다음의 독립 image 블록** | C8 + C7. ⚠ **(i)의 실재 여부는 O-1의 관문** — 실측 0건이면 (i) 코드를 넣지 않는다(추측으로 분기를 만들지 않는다) |
| **D4** | 그림 블록 기본 속성은 **기존 기본값 그대로**(`imageWidth` 미설정=400 · multiply 블렌드 · 흑백) | 인쇄지 스캔 그림은 흑백이 맞고, 편집창에서 만든 그림과 규칙이 같아야 한다. D18이 이 결정의 전제다 |
| **D5** | 미발견·다운로드 실패 시 **`\includegraphics{…}` 리터럴 유지 + 경고 배지**, 문항은 저장 | 리터럴 보존 규약과 정합. ⚠ **D15가 선행 조건** — 없으면 C2로 파괴된다 |
| **D6** | 업로드 주체는 **클라이언트 `uploadImage`**(서버는 바이트 프록시) | 61a 아키텍처(저장=클라이언트) 유지 · Storage 규칙 0 · Admin SDK 불필요. N-9(content-type 전달) |
| **D7** | 미리보기에 **실물 그림 표시** | 61a §6 "검은 관문"의 원칙. D16(지연 로딩) · D18(image 분기)이 함께 가야 성립한다 |
| **D8** | 가져오기 시 교정은 **① 결정적 자동 수정만**. AI 제안(②)은 61f로 분리 | ②는 결과 저장 구조가 없고(M8) 라우트가 무인증이라 일괄 호출에 부적합 |
| **D9** | 자동 수정 **기본 ON + 해제 체크박스**, 미리보기에 `자동 수정 n건` 배지 | 편집창 [교정]과 같은 규칙이고 미리보기에서 결과를 확인한다. **D15 채택이 이 값의 전제**(미채택이면 기본 OFF로 내려야 했다) |
| **D10** | AI 교정은 **후속 61f**(라우트 인증 + 일괄 + 결과 저장) | 매 진입 자동 실행은 비용·지연, 본문 자동 적용은 "제안 적용" 설계를 뒤집는다 |
| **D11** | 읽을 스프레드시트는 **audition(「문제 검토」) 유지** | C3으로 시트 동일성까지 확인됐다. 그림 폴더는 어느 시트를 읽든 같은 Drive라 무관 |
| **D12** | figure 라우트는 **`verifyUid` + 허용목록 + 폴더 ID 고정 + 파일명 화이트리스트** | 무인증이면 Drive 폴더 전체가 노출된다(61a D1과 같은 이유). 화이트리스트에서 `'`를 배제해 N-10의 이스케이프 항목을 없앤다 |
| **D13** | E에서 사라진 파일명은 **B열을 읽어 복구**(문제 탭 끝에 image 블록 + 경고) | 라우트가 이미 A1:P 전량을 보내므로 **서버 변경 0**. `SHEET_COL`에 `problem: 1`만 추가하고 `EXPECTED_HEADERS`에는 넣지 않는다(헤더 라벨 미확인 — Y5 "기대값 미확정 키는 통과") |
| **D14** | 품질 낮은 조각 그림도 **전부 가져오고 경고만**(그림 ≥3개 배지), 삭제는 편집창에서 | 무엇이 진짜 그림인지 Mathory가 추측하지 않는다. 근본 대책은 GAS 쪽(J열 `diagram_boxes` 크기 필터)이며 후속 검토(P5) |

### 3-2. 신규 결정 (D15~D20)

| # | 확정 | 기각한 대안 · 근거 |
|---|---|---|
| **D15** | **`autoWrapBareNumbers`·`autoWrapBareLetters`의 보호 목록에 LaTeX 제어열을 추가한다.** 제어열 본체는 `(?<!\\)\\[A-Za-z]+\*?`, 뒤따르는 중괄호 인자는 **`lib/latexScan.ts`의 `readGroup`으로 균형 스캔**해 함께 보호. 회귀 하니스 **`npm run test:proofread` 신설**(`tsc lib/proofread.ts lib/latexScan.ts` 2파일 단독 컴파일 — N-1 구성) | 기각 (b) 가져오기 경로 전용 마스킹 = 같은 규칙의 **사본**이라 "두 곳에서 하면 규칙이 갈린다"를 정면으로 어긴다. 기각 (c) D9 기본 OFF = D8이 주는 실익(`x^2→x^{2}` · 조사 공백)을 통째로 버린다. ⚠ **중괄호를 정규식 `\{[^}]*\}`으로 자르지 말 것** — 개선묶음 M1 W2가 정확히 그 실패의 기록이다 |
| **D16** | 미리보기 그림은 **행을 펼칠 때 그 행만**, 저장 시 **전건**. 동시성은 `SAVE_CONCURRENCY 4` 전례 | 기각 (a) 진입 시 전건 = C9. 렌더되는 것은 펼친 1행뿐인데 수백 장을 받는다. 기각 (c) 파일명만 = D7 위반 |
| **D17** | 문항 단위 **`figName → {blob, url}` 맵**으로 재사용 | N-7. 문제와 해설이 같은 그림을 가리키는 것이 정상 케이스다 — 매번 새로 받으면 Storage에 두 객체가 남는다 |
| **D18** | 미리보기 모달의 블록 분기를 **셋으로**(`choices` / `image` / 그 외). image는 `TabBody`의 마크업·`imageTreatmentStyle`을 그대로 쓴다 | 기각 (b) raw 통과 = C6. ⚠ **"렌더 5곳"에 여섯 번째를 만드는 것이 아니다** — 모달은 미리보기 전용이고 `imageTreatmentStyle`을 공유하므로 사본이 아니다 |
| **D19** | C1의 검증 손실은 **이번 Phase 범위 밖**. v1 §4의 "의도한 방향" 문장은 **삭제**하고 손실로 기록. `verifyBlocksOf`의 `[그림]` 자리표시자는 **61f 후보** | 기각 (b) `hasImages` 프롬프트 배선 = 61b의 "n=10 표본으로 판본을 가리지 말 것"에 걸린다(효과 측정에 30~50건 필요). 기각 (c) 즉시 자리표시자 = `verifyCharCountOf`의 **서버 셈법과 어긋나** "클라는 보내는데 서버가 400"이 된다(verifyFlow.ts:44). 서버·클라를 함께 고쳐야 해 이번 범위에 과하다. ⚠ **문장을 안 지우면 훗날 "이미 처리됨"으로 읽힌다** |
| **D20** | figure 라우트가 **자기 JWT 싱글턴(`drive.readonly` 단독)** 을 갖는다 | 기각 (b) 공용 JWT 스코프 확장 = C4. 시트 라우트의 "부를 수 없다" 잠금이 함께 느슨해지고 수정 파일도 는다. (a)면 시트 라우트 **변경 0** |

### 3-3. 확정에서 나온 구현 계약 (구현자가 지킬 것)

1. **`stemHash`는 `normalizeText(E)` 직후 값**이다. 그림 분할도 자동 수정도 그 앞에 오지 않는다(N-4).
2. **자동 수정 순서는 `rowToDraft` → 그림 분할 → `autoFix` → `toPersistedBlock`.**
   `autoFix`가 `\[→$$`·`tabular→표`를 만들고 `toPersistedBlock`이 `$$` 앞뒤 빈 줄을 소유한다 —
   순서를 뒤집으면 새로 생긴 `$$`가 정규화를 못 받는다.
3. **자동 수정 호출부는 `SheetImportModal`** 이다. `lib/sheetImport.ts`는 **import 0 규약**이라
   `proofread`를 부를 수 없다(`npm run test:sheet`가 단독 컴파일한다).
4. **`choices` 블록에는 `skipJamoRefs: true`**, `image` 블록은 자동 수정 대상에서 제외
   — 편집창의 `AUTOFIX_EXCLUDED_TYPES`(`image·svg·ggb`)와 같은 규칙.
5. **미리보기와 저장은 여전히 같은 배열을 본다(Y1).** 유일한 차이는 `<img>`의 `src`뿐이다 —
   미리보기는 blob URL, 저장본은 Storage URL. 이 예외를 코드 주석으로 명시할 것.
6. **blob URL은 행 접힘·모달 닫힘에서 `revokeObjectURL`** (N-5).
7. **프록시 응답의 content-type을 `new File(...,{type})`에 실을 것** (N-9).

---

## 4. 영향 범위 (확정판)

| 구분 | 내용 |
|---|---|
| 신규 | `app/api/sheet-import/figure/route.ts`(자체 JWT · `verifyUid` · 화이트리스트 · 404) · `tests/proofread.test.mjs` |
| 수정 | `lib/sheetImport.ts`(`DraftBlock`에 image · `SHEET_COL.problem` · 분할) · `components/import/SheetImportModal.tsx`(프록시 fetch · 지연 로딩 · image 분기 · 업로드 · 자동 수정 토글) · **`lib/proofread.ts`(D15)** · `lib/latexScan.ts`(사용만, 무변경) · `package.json`(`test:proofread`) · `.env` 1개(`AUDITION_FIG_FOLDER_ID`) · `tests/sheetImport.test.mjs` 케이스 증설 |
| **0건** | `firestore.rules` · `storage.rules` · `toPersistedBlock` · 렌더 5곳 · **`app/api/sheet-import/route.ts`**(C4) · `app/api/verify/*` · GAS 두 저장소 · 기존 문항 · 마이그레이션 |
| ⚠ 알고 두는 손실 | 그림이 image 블록이 되면 `\includegraphics` 문자열이 `verifyBlocksOf`에서 사라져 **정밀 검증 모델이 그림의 존재를 모르게 된다**(C1). 61f 후보(D19) |
| 중복 검사 | `stemHash`는 E 원문(파일명 포함) 기준으로 **불변**. 자동 수정 토글에 영향받지 않는다(N-4) |

---

## 5. 작업 순서 · 검수 관문

0. **덕수 선행**
   - Google Cloud 콘솔 → 프로젝트 **mathory-d7d03** → API 및 서비스 → 라이브러리 → **Google Drive API 사용**
     (서비스 계정 + 폴더 공유로 읽으므로 OAuth 동의 화면·API 키 설정은 필요 없다)
   - Drive `PBMAI/IMAGE_FIG`(`1C1_6NTRHUPR2W1BqN4OrqTNhntsaPixX`) 우클릭 → 공유 →
     **`mathory-sheet-reader@mathory-d7d03.iam.gserviceaccount.com`을 뷰어로** 추가, 알림 해제
   - `AUDITION_FIG_FOLDER_ID` → `.env.local` + Vercel(Production·Preview)
   - (선택) GAS 패치 5(`mergeHeader_`·`mpf_repairHeaders`) push — v1 P1

1. **D15 먼저.** `lib/proofread.ts` 제어열 보호(`readGroup` 사용) + `npm run test:proofread` 신설.
   **관문**: C2의 두 입력이 **count=0**으로 통과할 것 · 기존 로직 검증 6종 262개 무회귀 ·
   N-2의 마커 6종이 여전히 안전할 것.

2. `lib/sheetImport.ts` 분할 + `SHEET_COL.problem` + 테스트.
   **관문**: 분할 전후 `stemHash` 동일(N-4) · 빈 조각 폐기 후 question 텍스트 0이면 경고(N-8) ·
   **O-1 실측**(F~J에 `includegraphics`가 있는가)으로 D3′ (i)의 채택 여부를 확정.

3. figure 프록시 라우트(D20 · D12).
   **관문**: `연구실모의6회(260824)_문제_1공통07_fig1.jpg` 200 · 없는 이름 404 · 토큰 없이 401 ·
   화이트리스트 밖 이름 400 · 동명 2건에서 최신 선택(N-6).
   *403이면 폴더 공유 누락, `accessNotConfigured`면 Drive API 미활성화.*

4. 미리보기 — 펼침 시 지연 로딩(D16) · image 분기(D18) · 자동 수정 배지(D9).
   **관문(검은 관문)**: ① 실데이터 그림 문항 5건 이상에서 **미리보기 그림 = 저장 후 그림**
   (흑백·multiply·폭까지 일치) ② 선택지 뒤 꼬리 그림 1건(1공통13 — D13 복구 경로 포함)
   ③ 자동 수정 ON/OFF를 토글해도 **중복 배지가 변하지 않을 것**(N-4 회귀)
   ④ 파일 미발견 문항에서 `\includegraphics{…}` 리터럴이 **원형 그대로** 남을 것(D5×D15 교차).

5. 저장 — 업로드 → URL → 블록 치환, 실패 시 D7 롤백.
   **관문**: 같은 파일명이 문제·해설에 함께 있는 문항에서 Storage 객체가 **1개**일 것(D17).

6. 결과 요약 · 문서화 — v3 실행판을 `docs/phasedocs/`에 등록하고 CLAUDE.md·roadmap 포인터 갱신
   (작업 규칙 7 — 옮기지 않으면 phaseSketch 정리 때 이 Phase의 유일한 사양이 사라진다).

---

## 6. 착수 전 확인 (열린 항목)

| # | 항목 | 확인 방법 | 결정에 미치는 영향 |
|---|---|---|---|
| **O-1** | 선택지 셀(F~J) 안에 `\includegraphics`가 실제로 있는가 | Data_DS·Stack의 F~J 전량 검색 | **0건이면 D3′ (i)을 구현하지 않는다.** 2단계의 관문 |
| O-2 | Data_DS **B열의 헤더 라벨** | 시트 1행 B열 | `EXPECTED_HEADERS`에 넣을지(현재는 넣지 않기로 확정) |
| O-3 | 그림이 든 문항의 건수 분포(Data_DS 39행 vs Stack 전량) | `includegraphics` 행 수 집계 | D16 지연 로딩의 체감 이득 확인용 — 결정은 바뀌지 않는다 |
| O-4 | v1 §1-1(GAS G1~G10) — CLI 미검증 | web Claude 재확인 또는 GAS 저장소 clone | D1·D13의 전제 |
| O-5 | v1 §1-3(S1~S7) 실물 — CLI 미검증 | 3단계의 200 응답으로 S1·S3이 사실상 함께 검증된다 | — |

---

*v2 = CLI 교차검토 **확정판**. 정정 9 · 신규 실측 10 · 확정 결정 20.*
*v1을 인용하기 전에 §1(C1~C9)을 볼 것 — 특히 §4 "부수 효과"(C1)와 §4 "0건" 목록(C2·C4)은 뒤집혔다.*
*구현 착수는 §5의 순서를 지킬 것 — **D15가 1번인 것은 편의가 아니라 D5·D9의 선행 조건**이다.*
