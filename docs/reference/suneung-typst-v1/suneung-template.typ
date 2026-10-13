// ═══════════════════════════════════════════════════════════════════════
//  suneung-template.typ — 대학수학능력시험(수학 영역) 문제지 양식 · Typst 템플릿
//
//  근거: 2026학년도 수능 수학 영역 문제지(2511) PDF 실측(pt → mm 환산)
//    · 용지 A3 세로 297×420mm — KICE 배포 PDF 기준(덕수 확정 2026-10-13). 실제 시험지는 B4~A3 사이로 축소 인쇄되지만
//      Mathory는 인쇄·활용이 편한 A 계열 용지를 기준으로 한다 · 본문 좌우 여백 31mm · 머리글 괘선 52mm(표지면 77mm)
//    · 2단, 단 간격 11mm, 가운데 세로 괘선 · 본문 하단 376.5mm
//    · 본문 11.5pt 명조(행간 20.2pt) · 문항 번호 13pt 고딕 굵게 · 선택지 5등분(첫 칸 들여쓰기 4mm)
//    · 바닥글: 쪽 번호 상자(18×7.8mm, 사선) + 저작권 문구 10pt(오른쪽 25.4mm)
//
//  Typst 0.12 이상 (place(scope: "parent", float: true) 사용). 0.13~0.15에서 확인.
//  글꼴: Noto Serif KR(본문·번호) · Noto Sans KR(머리글) — 시스템 설치(없으면 Noto … CJK KR) · 수식 New Computer Modern Math(Typst 내장)
//        typst compile sample.typ
//        수식은 Typst 기본 New Computer Modern Math(컴파일러 내장 — 설치 불필요).
//
//  사용법 (sample.typ 참조):
//    #import "suneung-template.typ": *
//    #show: exam.with(year: "2026학년도", form: "홀수형", period: "제 2 교시",
//                      notice: "이 문제지에 관한 저작권은 ○○○에 있습니다.")
//    #exam-section(elective: none)[            // 표지면(공통)
//      #section-label[5지선다형]
//      #problem(1, points: 2)[ $x^2 + 1 = 5$ 일 때, 양수 $x$의 값은? ][
//        #choices[$1$][$sqrt(2)$][$2$][$2 sqrt(2)$][$4$] ]
//      ...
//    ]
//    #exam-section(elective: "확률과 통계")[ ... ]   // 선택과목 표지면
// ═══════════════════════════════════════════════════════════════════════

// ── 치수 (실측값, 필요하면 여기만 고친다) ────────────────────────────────
#let SIDE-MARGIN   = 31mm      // 좌우 여백
#let HEAD-RULE-Y   = 52mm      // 머리글 괘선(일반면) — 용지 상단 기준
#let COVER-RULE-Y  = 77mm      // 머리글 괘선(표지면)
#let BODY-TOP      = 56mm      // 본문 시작(일반면)
#let BODY-BOTTOM   = 376.5mm   // 본문 끝(세로 괘선 끝)
#let GUTTER        = 11mm      // 단 간격
#let RULE-W        = 0.4mm     // 머리글 괘선 굵기
#let COL-RULE-W    = 0.3mm     // 세로 괘선 굵기
#let BOX-STROKE    = 0.13mm    // 상자·쪽 번호 상자 선 굵기
#let INDENT        = 4mm       // 문항 본문 이어지는 줄·선택지 들여쓰기 (11.3pt)

#let BODY-SIZE     = 11.5pt
#let BODY-PITCH    = 20.2pt    // 행 간격(baseline 간)
#let NUM-SIZE      = 13pt
#let LABEL-SIZE    = 15pt      // '5지선다형' 상자 글자
#let NOTE-SIZE     = 11pt      // 확인 사항 글자

// ═══ 글꼴 원칙 (2026-10-13 덕수) ═══
//   1. 글꼴 개수는 최소화한다 → 한글 2가족(Noto Serif KR · Noto Sans KR) + 수식 1(New Computer Modern Math)
//   2. 1을 지키는 선에서 원본에 가장 가깝게 — 본문·문항 번호 = 명조(원본 신명 중명조·한양견명조 자리),
//      머리글·형 상자·'5지선다형' = 고딕(원본 견고딕·태고딕 자리)
//   3. 장평은 고려하지 않는다
//   4. 자간은 원본 실측에 맞춘다(TRACKING)
//   (검토 후 기각: 함초롬바탕 — 조판 품질 조악 · KoPub 바탕 · STIX Two Math — Word·SAT 인상)
#let SERIF  = ("Noto Serif KR", "Noto Serif CJK KR")
#let GOTHIC = ("Noto Sans KR", "Noto Sans CJK KR")
#let MATH   = ("New Computer Modern Math",)

// 자간: 원본 본문 한글 글자 간격 0.918em(실측, 453쌍 중앙값) − Noto Serif KR 한글 폭 0.966em
#let TRACKING = -0.048em
// 어절 간격: 원본 0.429em(실측)에 맞춘 공백 배율(실측 보정값)
#let WORD-SPACING = 168%

// 머리글·라벨(고딕)의 자간·어절 간격 — 본문 보정값(TRACKING·WORD-SPACING)을 물려받지 않게 따로 둔다
#let HEAD-TRACKING = -0.040em   // 시험명 줄 폭 원본 312.2pt에 맞춤(실측)
#let HEAD-SPACING  = 100%

// 굵기 — 본문·번호는 명조, 머리글은 고딕(원본보다 2단계 가볍게 — 덕수 확정)
#let W-BODY  = 400   // 본문
#let W-NUM   = 700   // 문항 번호 (명조 Bold)
#let W-TITLE = 500   // "수학 영역" (고딕 Medium)
#let W-BADGE = 400   // 홀수형 상자 · 교시 알약 (고딕 Regular)
#let W-EXAM  = 350   // "2026학년도 대학수학능력시험 문제지" (고딕 DemiLight)
#let W-LABEL = 700   // '5지선다형' · '단답형' (고딕 Bold)

// ── 내부 상태 ────────────────────────────────────────────────────────────
#let _subject = state("suneung-subject", "수학 영역")

// 섹션 표지면 쪽 번호 목록 (표지 float 안의 <suneung-cover> 라벨)
#let _cover-pages() = query(<suneung-cover>).map(m => m.location().page())
// 이 쪽이 속한 섹션의 표지면 쪽 번호 (없으면 1)
#let _section-start(here) = {
  let before = _cover-pages().filter(p => p <= here)
  if before.len() == 0 { 1 } else { before.last() }
}

// 이 쪽이 섹션 표지면인가 (표지 float 안에 심은 <suneung-cover> 라벨로 판정)
#let _is-cover() = {
  _cover-pages().contains(counter(page).get().first())
}

// 둥근 모서리 작은 상자: 홀수형/짝수형 (일반면 머리글용, 21×10.5mm)
#let _form-badge(form) = box(
  // (머리글 자간은 _page-header의 set text가 정한다)
  width: 21mm, height: 10.5mm, stroke: 0.5mm, radius: 1.2mm,
  align(center + horizon, text(font: GOTHIC, weight: W-BADGE, size: 20.5pt, form)),
)

// ── 머리글(일반면) ─────────────────────────────────────────────────────
//  홀수 쪽: [형] … 수학 영역 … [큰 쪽 번호]   /  짝수 쪽: [큰 쪽 번호] … 수학 영역 … [형]
//  큰 쪽 번호는 "섹션 안에서의 쪽수"(원본: 선택과목 표지면이 다시 1부터)
#let _page-header(form) = context {
  let page-no = counter(page).get().first()
  let local-no = page-no - _section-start(page-no) + 1
  let big = text(font: SERIF, size: 33pt, str(local-no))
  let title = text(font: GOTHIC, weight: W-TITLE, size: 28pt, _subject.get())
  let cover = _is-cover()
  set text(tracking: HEAD-TRACKING, spacing: HEAD-SPACING)
  // 표지면: 가운데 제목·형 상자는 본문 float가 그린다. 여기서는 큰 쪽 번호만.
  let left-item  = if cover { none } else if calc.odd(page-no) { _form-badge(form) } else { big }
  let right-item = if calc.odd(page-no) { big } else if cover { none } else { _form-badge(form) }
  let mid = if cover { none } else { title }
  set text(top-edge: "ascender", bottom-edge: "descender")
  block(width: 100%, height: 100%, {
    place(left + bottom, dy: -1.2mm, left-item)
    place(center + bottom, dy: -1.6mm, mid)
    place(right + bottom, dy: -1.2mm, right-item)
    if not cover {
      place(bottom, line(length: 100%, stroke: RULE-W + black))
    }
  })
}

// ── 바닥글: 쪽 번호 상자(사선) + 저작권 문구 ──────────────────────────────
#let _page-footer(notice) = context {
  let page-no = counter(page).get().first()
  let total = counter(page).final().first()
  let w = 18mm; let h = 7.8mm
  place(center + top, dy: 1.6mm,
    box(width: w, height: h, stroke: BOX-STROKE + black, {
      place(line(start: (0mm, h), end: (w, 0mm), stroke: BOX-STROKE + black))
      place(top + left, dx: 1.5mm, dy: 0.6mm, text(font: SERIF, size: 12pt, str(page-no)))
      place(bottom + right, dx: -1.5mm, dy: -0.6mm, text(font: SERIF, size: 12pt, str(total)))
    }))
  if notice != none {
    place(right + top, dx: SIDE-MARGIN - 25.4mm, dy: 9.5mm,
      text(font: GOTHIC, size: 10pt, fill: rgb("#2a4bd7"), notice))
  }
}

// ── 세로 괘선(단 사이) — 표지면은 표지 괘선부터, 일반면은 머리글 괘선부터 ──
#let _column-rule() = context {
  let y0 = if _is-cover() { COVER-RULE-Y } else { HEAD-RULE-Y }
  place(top + left, dx: 50%, dy: y0,
    line(angle: 90deg, length: BODY-BOTTOM - y0, stroke: COL-RULE-W + black))
}

// ═══ 문서 템플릿 ═══════════════════════════════════════════════════════
//  year     : "2026학년도"          — 표지면 첫 줄 "{year} 대학수학능력시험 문제지"
//  exam     : "대학수학능력시험 문제지" — 모의평가면 "전국연합학력평가 문제지" 등으로
//  subject  : "수학 영역"
//  period   : "제 2 교시"
//  form     : "홀수형" | "짝수형"
//  notice   : 바닥글 저작권 문구 (none이면 생략)
#let exam(
  year: "2026학년도",
  exam: "대학수학능력시험 문제지",
  subject: "수학 영역",
  period: "제 2 교시",
  form: "홀수형",
  notice: none,
  body,
) = {
  set document(title: year + " " + exam + " " + subject)
  set text(font: SERIF, weight: W-BODY, size: BODY-SIZE, lang: "ko", region: "KR",
    tracking: TRACKING, spacing: WORD-SPACING,
    top-edge: "ascender", bottom-edge: "descender")
  // 행 간격 20.2pt(원본 실측) = 글줄 상자(Noto Serif KR ascender+descender) + leading
  // 글꼴을 바꾸면 이 값을 다시 잰다 (pdfplumber로 연속 두 줄의 top 차이가 20.2pt가 되게)
  set par(leading: 0.69em, spacing: 0.69em, justify: false, first-line-indent: 0pt)
  set page(
    paper: "a3",
    margin: (left: SIDE-MARGIN, right: SIDE-MARGIN, top: BODY-TOP, bottom: 420mm - BODY-BOTTOM),
    columns: 2,
    header: _page-header(form),
    header-ascent: BODY-TOP - HEAD-RULE-Y,
    footer: _page-footer(notice),
    footer-descent: 0mm,
    background: _column-rule(),
  )
  set columns(gutter: GUTTER)
  // 수식: 본문과 같은 크기, 인라인에서도 display 꼴(수능 관례 — 분수·시그마를 줄이지 않는다)
  show math.equation: set text(font: MATH, size: BODY-SIZE)
  // box = 인라인 수식 안에서 줄을 끊지 않는다. 뒤 0.14em = 원본의 "수식↔조사" 간격(실측 1.4~1.7pt) — 조사는 수식에 붙여 쓴다($f(x)$에)
  show math.equation.where(block: false): it => box(math.display(it)) + h(0.14em)
  show math.equation.where(block: true): set align(left)
  // cases: 원본(HWP)은 행 사이가 넓다 — 기본 0.2em → 1em (실측 비교 2026-10-13)
  set math.cases(gap: 1em)
  set math.equation(numbering: none)
  // 한글 어절 단위 줄바꿈(= CSS word-break: keep-all). Typst 기본은 음절 사이에서도 끊는다 →
  // 한글이 든 어절(앞뒤 문장부호 포함)을 box로 묶어 어절 사이 공백에서만 줄이 바뀌게 한다.
  show regex("[^\s]*\p{Hangul}[^\s]*"): it => box(it)
  _subject.update(subject)
  body
}

// ═══ 섹션(표지면) ════════════════════════════════════════════════════════
//  새 쪽에서 시작하고, 그 쪽 상단에 양 단을 가로지르는 큰 머리글을 그린다.
//  elective: none(공통) | "확률과 통계" | "미적분" | "기하"
#let exam-section(elective: none, year: auto, exam: auto, period: auto, form: auto, body) = {
  pagebreak(weak: true)
  // 표지 머리글 — 세로 괘선 계산(_is-cover)이 이 라벨을 본다
  place(top + center, scope: "parent", float: true, clearance: 0mm, {
    [#metadata(none) <suneung-cover>]
    context {
      let subj = _subject.get()
      let title-line = if year == auto { "2026학년도 대학수학능력시험 문제지" } else { year + " " + (if exam == auto { "대학수학능력시험 문제지" } else { exam }) }
      let per = if period == auto { "제 2 교시" } else { period }
      let frm = if form == auto { "홀수형" } else { form }
      let subject-text = if elective == none { subj } else { subj + "(" + elective + ")" }
      // float 안의 좌표는 본문 상단(BODY-TOP)이 0 — 용지 기준 위치를 BODY-TOP만큼 당긴다
      let y(mm) = mm - BODY-TOP
      block(width: 100%, height: COVER-RULE-Y - BODY-TOP + 4mm, {
        set text(top-edge: "ascender", bottom-edge: "descender", tracking: HEAD-TRACKING, spacing: HEAD-SPACING)
        // 1행: 시험명 (21pt 고딕 굵게, 가운데, 글자 위 ≈ 42mm)
        place(top + center, dy: y(41.5mm),
          text(font: GOTHIC, weight: W-EXAM, size: 21pt, title-line))
        // 2행: 영역명 (≈40pt 고딕 Black, 가운데, 글자 위 ≈ 56mm)
        place(top + center, dy: y(if elective == none { 55.5mm } else { 57.5mm }),
          text(font: GOTHIC, weight: W-TITLE, size: if elective == none { 40pt } else { 32pt }, subject-text))
        // 교시 알약 (좌, 32×11mm, 22pt)
        place(top + left, dy: y(56mm),
          box(width: 32mm, height: 11mm, stroke: 0.5mm, radius: 5.5mm,
            align(center + horizon, text(font: GOTHIC, weight: W-BADGE, size: 22pt, per))))
        // 형 상자 (우, 28.5×15.5mm, 28pt)
        place(top + right, dy: y(58.5mm),
          box(width: 28.5mm, height: 15.5mm, stroke: 0.6mm, radius: 1.5mm,
            align(center + horizon, text(font: GOTHIC, weight: W-BADGE, size: 28pt, frm))))
        // 표지 괘선 (77mm)
        place(top + left, dy: y(COVER-RULE-Y), line(length: 100%, stroke: RULE-W + black))
      })
    }
  })
  body
}

// ═══ 구성 요소 ═════════════════════════════════════════════════════════

// '5지선다형' · '단답형' 상자 — 단 왼쪽 위. 상자 39×8.3mm 꼴(글자에 맞춰 늘어남)
#let section-label(body) = {
  v(0.5mm)
  box(stroke: BOX-STROKE + black, inset: (x: 7.4mm, y: 2.2mm),
    text(font: GOTHIC, weight: W-LABEL, size: LABEL-SIZE, tracking: HEAD-TRACKING, spacing: HEAD-SPACING, body))
  v(6.5mm)
}

// 문항
//   problem(번호, points: 3, slot: none)[문항 본문][선택지 등 꼬리]
//   · 번호 13pt 고딕 굵게 + 2.75mm 띄고 본문, 둘째 줄부터 4mm 들여쓰기
//   · points: 2 | 3 | 4 → 본문 끝에 " [n점]" (줄이 넘치면 다음 줄 — 오른쪽 정렬은 points-newline: true)
//   · slot: 단 높이에 대한 비율(50% 등)을 주면 그 높이를 차지한다(원본처럼 한 단에 두 문항을 고정 배치할 때).
//           none이면 자연 흐름 + 아래 여백 gap
//   · gap: 문항 뒤 여백 (slot이 none일 때)
#let problem(num, points: none, points-newline: false, slot: none, gap: 14mm, body, ..tail) = {
  let pts = if points == none { none } else { [\[#(points)점\]] }
  // 문항 번호: 본문과 같은 명조, 굵게 (2026-10-13 덕수: 고딕 → 명조)
  let head = text(font: SERIF, weight: W-NUM, size: NUM-SIZE, [#num.])
  // 본문 전체를 4mm 들여쓰고, 첫 줄만 번호가 그 앞(단 왼쪽 끝)으로 나온다 — 원본의
  // "번호 → 2.75mm → 본문, 둘째 줄부터(문단이 바뀌어도) 4mm" 배치
  let content = {
    h(-INDENT)
    box(head)
    h(2.75mm)
    body
    if pts != none {
      if points-newline { linebreak(); h(1fr); box(pts) } else { sym.space.nobreak; box(pts) }
    }
  }
  let inner = pad(left: INDENT, {
    content
    for t in tail.pos() { t }
  })
  if slot == none {
    block(breakable: false, inner)
    v(gap)
  } else {
    block(width: 100%, height: slot, breakable: false, inner)
  }
}

// 선택지 ①~⑤ — 한 줄 5등분(1~3개면 3등분). cols로 강제(긴 선택지는 cols: 3 → 3+2 두 줄)
#let CIRCLED = ("①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩")
#let choices(..items, cols: auto, above: 5mm) = {
  let its = items.pos()
  let n = its.len()
  let c = if cols == auto { if n <= 3 { 3 } else { 5 } } else { cols }
  v(above)
  grid(
    columns: (1fr,) * c,
    row-gutter: 4.5mm,
    align: left + horizon,
    ..its.enumerate().map(((i, it)) => box({
      text(font: SERIF, size: BODY-SIZE, CIRCLED.at(i))
      h(2.1mm)
      it
    })),
  )
}

// 조건 상자 (문항 안의 「(가) … (나) …」 또는 「∙ a₁ = 7 …」 상자)
//   문항 본문 들여쓰기(4mm) 자리에서 단 오른쪽 끝까지. 안쪽 여백 3.5mm. (problem 본문 안에서 쓴다)
#let cond-box(inset: 3.5mm, above: 4.5mm, below: 4.5mm, body) = {
  v(above)
  block(width: 100%, stroke: BOX-STROKE + black, inset: inset, breakable: false, body)
  v(below)
}

// 조건 항목 줄 — "(가) …" · "(나) …" (내어쓰기) / 불릿은 cond-item[∙][…]
#let cond-item(label, body) = {
  block(spacing: 0.55em, grid(columns: (auto, 1fr), column-gutter: 1.5mm, label, body))
}

// 빈칸 상자 — (가) (나) (다)  (수식 안에서도 본문 명조로 보이게 글꼴을 고정한다)
#let blank(label) = box(stroke: BOX-STROKE + black, inset: (x: 1.4mm, y: 0.6mm), baseline: 25%,
  text(font: SERIF, weight: W-BODY, size: BODY-SIZE, [(#label)]))

// 독립행 수식 — 본문 들여쓰기에서 다시 9mm 들여쓴다(원본 실측). (problem 본문 안에서 쓴다)
//   tag: 오른쪽 끝 번호 — eq(tag: [⋯⋯ ㉠])[$ … $]  (세로는 수식 가운데에 맞춘다)
#let eq(body, tag: none, above: 2mm, below: 2mm) = {
  v(above)
  if tag == none {
    pad(left: 9mm, body)
  } else {
    grid(columns: (1fr, auto), align: (left + horizon, right + horizon),
      pad(left: 9mm, body), text(font: SERIF, size: BODY-SIZE, tag))
  }
  v(below)
}

// '확인 사항' 상자 — 단의 맨 아래에 붙는다 (섹션 마지막 쪽 오른쪽 단에서 호출)
#let notice-box(title: [\* 확인 사항], ..lines) = {
  place(bottom + left, float: true, clearance: 0mm,
    block(width: 100%, stroke: BOX-STROKE + black, inset: (x: 3.5mm, y: 2.5mm), {
      set text(font: GOTHIC, size: NOTE-SIZE, tracking: HEAD-TRACKING, spacing: HEAD-SPACING)
      set par(leading: 0.45em, hanging-indent: 4.3mm)
      title
      for l in lines.pos() { linebreak(); [◦ ]; l }
    }))
}

// 단 바꾸기(다음 문항을 다음 단 맨 위로)
#let next-column() = colbreak()
