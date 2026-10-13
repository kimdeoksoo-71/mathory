# suneung-typst — 수능 수학 영역 문제지 Typst 템플릿

2026학년도 수능 수학 영역 문제지(2511) PDF를 실측해 만든 양식입니다. Typst 0.12 이상(0.13~0.15 확인).

> **Mathory 레포 참고본(Phase 70 N3′, 2026-10-13)** — 시험지 조립 Phase(D5)의 출발점이다. 런타임·빌드는 이 폴더를 읽지 않는다.
> 레포에는 템플릿 본체와 이 README만 둔다. 사용 예(`sample.typ`)·결과(`sample.pdf`)는 **실제 수능 문항**이고 비교 이미지
> (`compare-*.png`)는 **KICE 원본 지면 캡처**라 공개 레포에 넣지 않았다 — 원본 판은 `docs/phaseSketch/suneung-template-v1/`
> (로컬 작업물) · 이전 판은 `docs/phaseSketch/_archive/Phase70/`.
> ⚠ 엔진: 템플릿은 Typst **0.15.0**으로 만들었다. Mathory 브라우저 엔진(typst.ts 0.7.0)은 **0.14.2**이고, 거기서 컴파일은
> 되지만 선택지 숫자가 ①보다 약 3pt 뜬다(Phase 70 v4 부록 I-5). 또 선택지가 한 칸 안 baseline 배치라 분수 선택지의 라벨이
> 내려앉는다(개선묶음 M2 B 결함) — D5 착수 때 Phase 70 D29(라벨·내용 2칸 grid `align: horizon`)로 바꾼다.

## 파일
- `suneung-template.typ` — 템플릿 본체 (치수 상수 · `exam` · `exam-section` · 구성 요소)

## 컴파일
```
typst compile 문서.typ
# 한글 = Noto Serif KR · Noto Sans KR (시스템 설치 — 없으면 Noto Serif/Sans CJK KR로 찾는다)
# 수식 = New Computer Modern Math (Typst 내장)
```

## 구조
```typst
#import "suneung-template.typ": *
#show: exam.with(year: "2026학년도", form: "홀수형", period: "제 2 교시", notice: "…저작권 문구…")

#exam-section(elective: none)[                 // 표지면(양 단을 가로지르는 큰 머리글) + 공통 문항
  #section-label[5지선다형]
  #problem(1, points: 2)[ 본문 ][ #choices[①][②][③][④][⑤] ]
  #v(1fr)                                       // 한 단에 두 문항을 고정 배치할 때(원본과 같은 모양)
  #problem(2, points: 2)[ … ][ … ]
  #v(1fr)
  #next-column()
  …
  #section-label[단답형]
  #problem(16, points: 3)[ … ]                  // 단답형은 꼬리 없이
  #notice-box[…][…]                             // 단 맨 아래 '확인 사항' 상자
]
#exam-section(elective: "확률과 통계")[ … ]     // 선택과목 표지면 — 큰 쪽 번호가 1부터 다시
```

구성 요소: `section-label` · `problem(num, points:, points-newline:, slot:)` · `choices(..., cols:)` ·
`eq(tag:)[$ … $]`(독립행 수식, 오른쪽 ⋯⋯ ㉠) · `cond-box[…]` + `cond-item[(가)][…]`(조건 상자) ·
`blank[가]`(빈칸 상자) · `notice-box` · `next-column()`.

## 실측값 (템플릿 상단 상수)
- A3 세로 · 좌우 여백 31mm · 머리글 괘선 52mm(표지면 77mm) · 본문 끝 376.5mm · 단 간격 11mm
- 본문 11.5pt 명조, 행 간격 20.2pt · 문항 번호 13pt 명조 굵게 · 둘째 줄부터 4mm 들여쓰기
- 선택지 5등분(1~3개는 3등분) · 조건 상자 선 0.13mm · 쪽 번호 상자 18×7.8mm(사선)

## 알고 두는 것
- 한글은 **어절 단위로만 줄이 바뀐다**(`show regex: box`) — Typst 기본은 음절 사이에서도 끊는다.
- 인라인 수식은 display 꼴 + 줄바꿈 금지(수능 관례, Mathory 인쇄 규약과 같음).
- 그림(그래프)은 `#image("…")` 또는 `cetz`로 — 템플릿은 자리만 잡는다.
- 글꼴 원칙(덕수 2026-10-13): ① 글꼴 개수 최소화 ② 그 안에서 원본에 가장 가깝게 ③ 장평은 고려하지 않음 ④ 자간은 원본 실측에 맞춤
  → 명조 Noto Serif KR(본문·문항 번호 Bold) · 고딕 Noto Sans KR(머리글, 원본보다 2단계 가볍게) · 수식 New Computer Modern Math
  (검토 후 기각: 함초롬바탕 — 조판 품질 조악 · KoPub 바탕 · STIX Two Math — Word·SAT 인상)
- 자간·간격은 원본 PDF 실측값에 맞춘 것이다: 본문 한글 글자 간격 0.918em(`TRACKING −0.048em`) · 어절 간격 0.43em(`WORD-SPACING 168%`)
  · 행 간격 20.2pt · 머리글 자간 `HEAD-TRACKING −0.04em`(시험명 줄 폭 312pt).
  글꼴을 바꾸면 이 값들을 다시 잰다(연속 한글 글자 x 간격 · 어절 사이 간격 · 연속 두 줄 top 차이).
- 조사는 수식에 붙여 쓴다(`$f(x)$에`) — 템플릿이 수식 뒤에 0.14em을 둔다(원본 실측).
