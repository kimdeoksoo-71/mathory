# Phase 70 Stage 0 — 실측 기록

엔진: Typst 0.14.2(`@myriaddreamin/typst-ts-node-compiler` 0.7.0 — 브라우저 typst.ts와 같은 판) + mitex **0.2.7 배포판**(벤더링) · 글꼴 Noto Serif KR Subset OTF(커밋 `9b0f143`, SHA-256 검증)
도구: `npm run probe:export -- [--dump <경로>] [--sheets Stack | --no-sheets] [--limit N]` → 요약 + `.probe/export-stage0.json`

## P0-1 mitex 대응률

### (가) 시트 Stack 전량 — 2026-10-13
| 항목 | 값 |
|---|---|
| 문항(행) | 5,746 |
| 수식(발생) | 161,237 |
| 고유 수식 | 40,898 (수식 하나씩 컴파일 · 19.9초) |
| **성공률(발생 기준)** | **99.99%** |
| 실패 고유 | 9 (환경 정규화 전 10 — `gather*` 해소) |
| 실패 문항 | 8 (0.1%) |

- 판정: **mitex 확정**(D1 기준 ≥95%). tex2typst 대체·재시도 갈래(D28 뒤쪽)는 지금 필요 없다.
- ⚠ Data_DS는 처리 후 비워지는 시트라 0행이었다 — 기본 표본은 Stack.
- ⚠ 프로브 자가 점검: `\textcircled{1}`·`\foo` = 실패, `\displaystyle x^2` = 성공을 먼저 확인한다(전부 성공이면 프로브를 의심할 것 — 300행 시험이 100%였을 때 실제로 의심해 넣었다).

실패 9개 분류:
| 원인 | 수 | 성격 |
|---|---|---|
| `\begin{tabular}` 조각 · 산문이 `$$` 안으로 말려 들어감(`tabular`·`array`·wasm panic) | 4 | **원문 결함** — `$$` 짝이 어긋나 표·문장이 수식이 됐다. 화면 KaTeX도 깨진다 |
| "formula is not valid"(aligned·array 안 `\text { … }`·`\[` 잔재 등) | 4 | 대부분 원문 결함(`\text { - } \[` 등) — 개별 확인은 실물 단계에서 |
| unclosed delimiter(`\left[` 짝 없음) | 1 | 원문 결함 |
→ 남는 것은 D28(실패 수식만 원문 상자)이 처리한다.

### Mathory 행 환경(ROW_ENVS) 29종 — mitex 0.2.7 대응(구현 중 발견)
13종이 "unknown environment" → `typst.ts normalizeEnvsForMitex`가 동치 환경으로 바꾼다. `test:exporttypst` Y9가 29종 전부의 실제 컴파일을 고정한다.

| 원래 | 바꾼 것 | 알고 두는 손실 |
|---|---|---|
| `alignat`·`alignat*` | `alignedat` | — |
| `gather*` | `gathered` | — |
| `darray` | `array` | 칸 display 꼴 |
| `dcases`·`drcases` | `cases`·`rcases` | 칸 display 꼴 |
| `matrix*` 등 별표 행렬 `[r]` | 별표 없는 행렬 | 열 정렬 인수 |
| `Vmatrix` | `\left\| matrix \right\|` | — (mitex 구분자 버그 "expected exactly one character") |

### (나) Mathory 덤프 — 2026-10-13
덕수가 임시 덤프 페이지(`docs/phaseSketch/phase70-dump-page.tsx.txt` → `app/dev70-dump/page.tsx`)에서 내려받은 `mathory-dump.json`
(본인 문항 761개 · 휴지통 제외 · 커밋하지 않음 — `.gitignore`). `npm run probe:export -- --dump docs/phaseSketch/mathory-dump.json`

| 항목 | 첫 실행 | 빈 수식 처리 뒤 |
|---|---|---|
| 문항 | 761 | 761 |
| 수식(발생 · 고유) | 42,737 · 16,675 | 42,735 · 16,673 |
| 성공률 | 99.99% | **100%(반올림)** |
| 실패 고유 · 실패 문항 | 3 · 3 | **1 · 1** |

첫 실행 실패 3개:
| 원인 | 처리 |
|---|---|
| 빈 인라인 수식 → `\displaystyle `만 남음 → mitex "cannot calculate sum of empty array" **(문서 전체 실패)** | `typst.ts mathCall` — 내용이 `\displaystyle`뿐이면 수식을 내지 않는다(화면 KaTeX도 아무것도 안 그린다) |
| display 빈 행(`\\\\` 연속 — 원문 `=0 \\\\`) → `\displaystyle ` 행 → 같은 오류 | 빈 행은 `\displaystyle {}`(행은 화면처럼 남는다) · `test:exporttypst` Y10 |
| `$\mathrm{A}$$(e,~2e)$` — 두 수식이 붙어 마크다운이 하나(`\mathrm{A}$$(e,~2e)`)로 읽음(`검증\26K34_감수\26년K34회_2_4미적27`) | **원문 결함** — 화면도 수식 오류. PDF는 D28 원문 상자. 원문을 `$\mathrm{A}$ $(e,~2e)$`로 고치면 된다(M7 D1 — `$` 버튼은 인접 `$`에 공백을 붙인다) |

### 대표 13문항 (v4 §4-1) — 전부 실패 0
| 문항 | 수식 | 실패 |
|---|---|---|
| 26K32_1공통01 | 14 | 0 |
| 26K32_1공통04 | 20 | 0 |
| 26K32_1공통13 | 65 | 0 |
| 26K32_1공통15 | 102 | 0 |
| 26K32_1공통20 | 87 | 0 |
| 26K32_1공통22 | 130 | 0 |
| 26K32_3확통27 | 30 | 0 |
| 26K32_3확통28 | 149 | 0 |
| 26K32_3확통29 | 114 | 0 |
| 26K32_3확통30 | 111 | 0 |
| 26K32_4미적26 | 22 | 0 |
| 26K32_4미적29 | 94 | 0 |
| 26K32_5기하30 | 70 | 0 |

### 합계(시트 + 덤프, 빈 수식 처리 뒤)
6,507문항 · 수식 203,969(고유 50,677) · 실패 고유 10 · 실패 문항 9(0.1%) — 남은 10개는 전부 원문 결함 계열(위 표 · (가) 표).

## P0-8 기준선 간격 — 종료(v4 부록 I-3)
줄 16.99pt · 문단 22.99pt.

## 남은 항목
P0-2(브라우저 typst.ts — 70b) · P0-3(원문자 88% 체감) · P0-5(Overleaf 크기 상한) · P0-7(xetexko 어절 — 덕수 Overleaf) · P0-8′(블록 간격) · P0-9(상주 — `test:exportir`) · P0-10(cases 행간 실물) · P0-11(격리 비용 — 70b)
