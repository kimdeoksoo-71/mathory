# Phase 61e-2차 — 그림 링크 이관(패치 11) 대응 구현 계획서 v2 (최신 레포 재검토판)

> 작성: web(Claude) 2026-09-03 오후 · 저본: v1(같은 날 오전) · 계보: v1(web 초안) → **v2(web — GAS 두 레포 재검토 반영)** → v3(CLI 실측 교차검토 예정)
> v1 이후 변한 것: **gas-project-audition `8ebb218`(09-03 14:07, 패치 13)**. gas-project-latex-convert는 `7719d12`에서 변화 없음. mathory `466d347` 불변.
> ⚠ GAS 레포는 CLI가 볼 수 없으므로(관례) §1·§2의 GAS 사실은 이 문서가 원천이다. CLI 교차검토는 §4(Mathory 구현 사양)에 집중할 것.

---

## 0. 한 줄 요약

**v1의 원인 분석과 해결 사양은 그대로 유효하다 — 구현 사양 변경 0.** 오늘 오후의 audition 패치 13은 오히려 v1의 방향을 강화한다: GAS 검증기 스스로 `![파일명](Drive링크)`와 구형 `\includegraphics{파일명}`을 **둘 다** 인식하는 이중 형식 대응을 넣었다(D21′와 같은 판단). 새로 반영할 것은 사실 갱신 4건(U1~U4)과 운영 결정 2건(D27·D28)이며, 코드가 바뀌는 곳은 v1 §3과 동일하게 `lib/sheetImport.ts` · 모달 폴백 1곳 · 프록시 NFC/NFD 검색뿐이다.

---

## 1. 원인 요약 (v1 §2 불변 — 재검토로 재확인)

Phase 61e(08-30)는 "그림 = `\includegraphics{파일명}`" 계약 위에 구현됐다. GAS **패치 11**(09-01, latex-convert `e57d036`)이 Data_Latex→Data_DS 이관 시 이 태그를 **`![파일명](Drive링크)`**(N열 뷰 URL)로 치환하면서 계약이 바뀌었고, Mathory 분할기는 `![…](…)`을 의도적으로 경계에서 제외(61e D21)했으므로 그림 블록이 만들어지지 않는다 — 본문에 비공개 Drive 뷰 URL이 텍스트로 남아 "주소만 붙는" 증상. 되돌릴 수 없다: audition 검증(패치 12·13)이 이 형식으로 그림을 내려받아 Gemini에 첨부한다. **해법 = Mathory가 두 형식 모두를 그림 경계로 인식**(상세 사양 §4).

## 2. v1 이후 GAS 변경 실측 (U1~U7)

### 2-1. audition `8ebb218` — 패치 13 (2026-09-03 14:07)

| # | 사실 | 위치 | Mathory 함의 |
|---|---|---|---|
| **U1** | 검증 그림 첨부 강화: 행당 **8장**·장당 4MB·요청 합계 16MB 상한, mime 화이트리스트(jpeg/png/gif/webp), 첨부 못 한 그림은 프롬프트 꼬리말 `[그림: 이름 — 사유]`로 고지. **구형 `\includegraphics{파일명}`도 Drive 폴더(`FIG_FOLDER_PATH`, 기본 PBMAI/IMAGE_FIG) 이름 검색으로 인식** | `Itemverification.gs` VCONFIG v7, `iv_collectFigRefs_`(reLink+reTag 이중 스캔), `iv_findFigIdByName_` | **D21′(a) 강화** — GAS 검증기도 이중 형식을 공식 계약으로 삼았다. Mathory만 한쪽을 보면 안 된다는 판단이 GAS 쪽에서 독립적으로 재현됨 |
| **U2** | **Data_DS 열 확장**: Y(25) = `fig_info` 신설(행별 그림 첨부/누락 내역, 헤더 자동 생성). Stack의 세트명/문항그룹은 Y/Z → **AD/AE(30/31)** 이동, `Movetostack` v4는 **A~AC 29열** 이관(1회성 마이그레이션 메뉴 `mts_migrateSetCols` 포함). StatCalc도 AD/AE 참조 | `Itemverification.gs COL_FIG_INFO:25`, `Movetostack.gs` v4, `MainMenu.gs` | **Mathory 영향 0** — 가져오기는 `A1:P`(16열)만 읽는다. 단 향후 읽기 범위를 넓힐 일이 있으면 Y=fig_info임을 기억(D28) |
| **U3** | **이관이 자동화됐다**: `Pipelineverify.pv_load_`가 Latex변환 파일을 `openById`로 열어 Data_DS **A~K**를 키워드 검색으로 긁어 온 뒤, 문제검토 Data_DS를 **A~AC 전체 클리어 후 채운다**(E 빈 행은 "정규화 필요"로 제외). 61e G10의 "수동 이관" 서술은 이제 옛말 | `Pipelineverify.gs:474-520` | **Data_DS는 이제 "마지막 검증 실행분"만 담는 휘발 작업셋**이고 누적은 Stack이다 → 가져오기 운영 안내(D27) |
| **U4** | audition `normalizeProblem.gs`가 latex-convert HEAD와 **바이트 단위 동일**(diff 0) — 61e v3에서 지적한 구판 사본 불일치(P3) 해소 | 양 레포 diff | 두 스프레드시트 어느 쪽에서 정규화가 돌아도 결과 동일 — E/B의 그림 표기 전제가 하나로 통일됨 |

### 2-2. latex-convert — 변화 없음 (v1 실측 유지)

| # | 사실 |
|---|---|
| U5 | HEAD `7719d12` 그대로. 패치 11(`dlds_embedFigLinks_` — 링크 못 찾은 태그는 `\includegraphics` 유지), NFC 정규화(`nfc_`), `findPdf_` NFC/NFD 이중 검색 — v1 §2-2 R1~R10 전부 유효 |
| U6 | P2 여전히 열림: `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 미등록 (그림 추출 수동 재시도 메뉴 없음) |
| U7 | 데이터 흐름 확정판: **Latex변환.Data_DS(A~K, B·C·E에 `![이름](링크)` 또는 잔존 `\includegraphics`) → [pv_load 자동] → 문제검토.Data_DS(검증이 N~X·Y 채움) → [Movetostack] → Stack(A~AC + AD/AE)**. Mathory는 문제검토의 Data_DS/Stack `A1:P`를 읽는다 — 그림 표기는 어느 단계에서도 변형되지 않고 B·C·E에 그대로 흐른다 |

## 3. 결정사항

### 3-1. v1 결정 재확정 (변경 없음)

| # | 결정 | v2 비고 |
|---|---|---|
| **D21′** | `\includegraphics{파일명}` + `![파일명](Drive링크)` **두 형식 모두** 그림 경계 | U1이 독립적으로 같은 설계를 채택 — 확신 상향 |
| **D22** | alt(파일명) 기반 이름 검색 유지 + 프록시 **NFC/NFD 변형 검색** 추가 | GAS도 `findPdf_`·패치 13 이름 검색을 쓴다. fileId 직접 fetch는 후속 유보 그대로 |
| **D23** | 미발견 폴백은 고정 문자열 대신 **매치 원문(`origText`) 복원** | 불변 |
| **D24** | 파일명 규격(`*_figN.ext`) 아닌 alt의 Drive 링크는 경계로 안 삼고 경고 | 불변 |
| **D25** | Drive 뷰 링크 직접 `<img src>` 사용 — **기각 확정** | 불변 |
| **D26** | 검증 손실(61e C1)은 GAS 패치 12·13이 해결 — Mathory 61f 자리표시자 우선순위 하향 | U1(누락 고지·Y열 기록)로 더 견고해짐 |

### 3-2. v2 신규 결정 (권장안 첫 번째)

| # | 결정 | 선택지 | 권장 · 근거 |
|---|---|---|---|
| **D27** | Data_DS가 휘발 작업셋이 된 것(U3)의 가져오기 운영 | (a) **코드 변경 0 — 마법사 시트 선택 안내문만 갱신**: "Data_DS = 마지막 검증 실행분 / Stack = 누적" (기본 선택은 이미 Stack) (b) Data_DS 라디오 제거 | **(a)**. 검증 직후 그 세트만 바로 가져오는 흐름에 Data_DS가 여전히 유용하다. (b)는 기능 상실 |
| **D28** | 새 Y열 `fig_info`(U2) 활용 | (a) **읽지 않는다 — 읽기 범위 `A1:P` 유지** (b) 범위를 `A1:Y`로 넓혀 fig_info를 경고 배지에 표시 | **(a)**. fig_info는 "검증 요청에 뭐가 첨부됐나"의 기록이지 원본 그림의 존재 증명이 아니다. Mathory는 자체 이름 대조(미발견 경고)를 이미 하므로 중복 신호고, 범위 확장은 61a 계약(A1:P) 변경이다 |

## 4. Mathory 구현 사양 (v1 §3 그대로 — 요약 재수록)

1. **`lib/sheetImport.ts`** — `INCLUDEGRAPHICS_RE`에 더해 `DRIVE_IMG_RE = /!\[([^\]\n]+)\]\(\s*(https?:\/\/(?:drive|docs)\.google\.com\/[^)\s]+)\s*\)/` 를 도입, 두 정규식을 **인덱스 순 통합 스캔**으로 돌려 경계 생성. `![alt](…)`는 alt가 `_fig\d+\.(jpe?g|png|gif|webp)$` 규격일 때만 image 블록(figName=alt), 아니면 경고(D24). image 블록에 **`origText`**(매치 원문) 보존. `scanFigureNames`(B열 복구)·선택지 경고(D3′) 탐지도 동일 이중 스캔. `stemHash`는 `normalizeText(E)` 분할 전 값 — 불변(61e N-4). 비-Drive URL은 현행 경고 유지, 문구만 정비.
2. **`SheetImportModal.tsx`** — 미발견·실패 폴백을 `\includegraphics{figName}` 고정에서 **`origText` 복원**으로(1곳). 나머지(지연 로딩·업로드·롤백 deleteObject·자동 수정 토글) 불변.
3. **`figure/route.ts`** — 이름 검색을 NFC·NFD 두 변형으로 시도(중복 제거, 첫 적중 사용). 화이트리스트·폴더 고정·인증 불변.
4. **테스트 증설** — 패치 11 형식 분할 / 두 형식 공존(한 셀) / 규격 외 alt 경고·비분할 / 비-Drive URL 경고·비분할 / B열 복구 신형식 / `origText` 보존 / 기존 케이스 무회귀.

## 5. 작업 순서 · 검수 관문 (v1 §7 개정)

1. `lib/sheetImport.ts` 통합 스캔 + 테스트 — 관문: §4-4 전부 통과·무회귀.
2. 모달 폴백 `origText` + 프록시 NFC/NFD — 관문: 한글 파일명 실물 1건이 어느 정규형으로도 200.
3. **실데이터 검수 관문**: ① 문제검토 Data_DS(검증 직후 신형식) 그림 문항 5건 이상 — 미리보기 그림 실물 = 저장 후 렌더(흑백 multiply·폭) ② **Stack의 08-30 구형 세트 1건**(`\includegraphics` 잔존) — 구형 경로 무회귀 ③ 한 셀에 두 형식 공존 행(패치 11이 링크 못 찾은 태그를 남긴 행) 1건 ④ 자동 수정 ON/OFF 토글에 중복 배지 불변.
4. **운영(덕수)**: 이미 "주소만 붙은" 채 가져온 문항은 배포 후 같은 행 재가져오기로 교체(기존 것 삭제/휴지통). E 원문이 달라져 중복 배지가 안 뜰 수 있음. 마법사 안내문 갱신(D27).
5. 문서화: 완료 후 결과 문서 등록, roadmap·CLAUDE.md 갱신 + 재발 방지 각서 1줄(그림 표기 계약이 바뀌면 `splitFigures`·`scanFigureNames`·폴백이 같이 움직인다).

## 6. 열린 항목

| # | 항목 | 상태 |
|---|---|---|
| P2 | latex-convert `MainMenu.gs`에 `mpf_runRange`/`mpf_stop` 등록 | 열림(U6) — GAS, 이번 구현과 무관 |
| P5 | J열 `diagram_boxes` 크기 필터(조각 그림 근본 대책) | 후속 |
| — | Stack 기존 행 Y/Z→AD/AE 마이그레이션 실행(`mts_migrateSetCols` 1회) | 덕수 — Mathory와 무관하나 통계·이관 정합에 필요 |

---

*v2 — GAS 최신(latex-convert `7719d12` · audition `8ebb218`) 재검토 반영. 구현 사양은 v1과 동일, 사실 갱신 U1~U7 + 결정 D27·D28 추가. 다음 단계: CLI 교차검토(v3)는 §4 사양의 mathory `466d347` 대비 실측 확인에 집중.*
