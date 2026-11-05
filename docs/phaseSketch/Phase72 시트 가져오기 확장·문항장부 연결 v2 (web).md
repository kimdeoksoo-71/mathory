# Phase 72 — 시트 가져오기 원본 확장('Latex 변환') + 문항장부 ID 연결 구현 계획서 v2 (web 교차검토판)

> 보관용 사본. 덕수가 웹 Claude 검토로 만든 v2 원문(2026-11-05). CLI v3가 이 문서를 재대조했다 — 정정·보완·추가 결정은 **v3 부록 B**에 있다. 아래 본문은 수정하지 않았다.

작성일: 2026-11-05 · 작성: web v2(레포 4개 실측 재대조) · 기준 커밋: mathory **`20783a8`**(= `4b1228a` + 계획서 v1 커밋 1개 — 범위 안 파일 전부 **불변**, 아래 행 번호는 그대로 유효) · `gas-project-latex-convert` **`3cc4694`** · `gas-project-problem-ledger` **`90c88cf`** · `gas-project-audition` **`98b7f54`**
계보: 덕수 질문 1~3 → 연구 `2026-11-05 문항장부↔Latex변환 Data_DS 연결 연구.md` → 덕수 결정 §2 → CLI v1 → **web v2**(정정 E1~E9 · 보완 B1~B9 · 결정 Q1~Q8 전항 권장안 확정, 2026-11-05) → CLI 착수

## 부록 A. v1 → v2 변경 요지

### A-1. 정정 (E)
| # | v1 자리 | 문제 | v2 |
|---|---|---|---|
| E1 | D6 · §5-3 | `jangbuSet.has(cells[11])`가 `source`와 무관하게 돈다 | `source !== 'latex'`인데 `jangbuIds`가 오면 400. `jangbu_id` 저장은 latex일 때만 |
| E2 | V3 | 합격 기준 모순(색인 대상은 4490~6304뿐) | 고유 ID 1,444 기준 · 미매칭 사유별 집계 |
| E3 | D8 · §5-1 | `cropNormKey_`(시트 매칭키)와 파일키를 섞음 | 이식 대상은 `cropKeyAliases_[0]` + 뒤 부분 정규화 |
| E4 | §5-8 | 테스트 H2·H3가 이미 있다 | HL1·HL2 |
| E5 | D1 · §5-3 | `readEnv(source)`는 body 파싱 전에 불린다 | 공통 4종 필수 + 시트 ID 둘 선택, body 뒤 판정 |
| E6 | D3 | 근거 보강 | 문제 검토 A~K는 Latex 변환 A~K의 복사본(`Pipelineverify.gs:794→:819`) |
| E7 | §1-1 · §1-2 | A 있고 E 빈 행 가능 | Q2 배지 + 기본 체크 해제(→ v3 R1에서 철회 권장) |
| E8 | §5-6 | `file: undefined` 대입은 Firestore가 거부 | 조건부 스프레드 · 테스트 I1 |
| E9 | §1-1 | `sloution_note`/`solution_note` 혼재 | 키 `solution_note`(기대값 `sloution_note`) |

### A-2. 보완 (B)
B1 NFC · B2 백필 모호 키·락 · B3 2층 X1 개수 셀 · B4 `import_source` 소비처 0 · B5 CLAUDE.md 환경변수 5종 · B6 `A1:P` 유지 · B7 2~4489행 "형식 아님" · B8 서버는 invalid 버리고 진행 · B9 `buildImportSource` 순수 함수

### A-3. 결정 Q1~Q8 — 덕수 "모두 권장안대로"(2026-11-05)
Q1 `^[DS]\d{4,5}$` · Q2 E 빈 행 배지+체크 해제 · Q3 모호 키 보고만 · Q4 교차 중복 표본 5건 사전 대조 · Q5 `file`은 latex만 기록 · Q6 `JB_OVERWRITE` 속성 · Q7 `pl_stageSend_` 자동 채움은 범위 밖 · Q8 응답은 `unmatched`만

(본문 §0~§9는 v3가 전부 이어받아 갱신했으므로 여기서는 생략 — 원문 전체는 덕수 보관 `Phase72-sheet-import-expansion-jangbu-link-v2.md`.)
