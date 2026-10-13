// Mathory 내보내기 — Typst 0.14.2에서 검증 · 글꼴: Noto Serif KR(또는 Noto Serif CJK KR) · New Computer Modern Math
#import "/public/typst/packages/preview/mitex/0.2.7/lib.typ": mitex, mi
#set page(paper: "a3", margin: (top: 30mm, bottom: 30mm, x: 20mm), columns: 2)
#set columns(gutter: 10mm)
#set text(font: ("Noto Serif KR", "Noto Serif CJK KR"), size: 10pt, lang: "ko")
#set par(leading: 0.97em, spacing: 0.97em + 6pt, justify: false)
#set block(spacing: 0.97em + 6pt)
#set smartquote(enabled: false)
#show regex("[^\s]*\p{Hangul}[^\s]*"): it => box(it)
#show regex("[①-⑳]"): set text(size: 0.88em)
#show math.equation: set text(font: ("New Computer Modern Math", "Noto Serif KR"))
#show math.equation.where(block: false): box
#set math.cases(gap: 1em)
#set math.mat(row-gap: 1em)
#show math.equation.where(block: true): set align(left)
#show math.equation.where(block: true): set block(above: 20.7pt, below: 20.7pt)
#show math.equation.where(block: true): it => pad(left: 2em, it)
#show heading: set text(weight: 600)
#show heading.where(level: 1): set text(size: 13pt)
#show heading.where(level: 2): set text(size: 12pt)
#show heading.where(level: 3): set text(size: 11pt)
#let coach-icon = box(image(bytes("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 256 256\"><path fill=\"black\" d=\"M88,104a8,8,0,0,1,8-8h64a8,8,0,0,1,0,16H96A8,8,0,0,1,88,104Zm8,40h64a8,8,0,0,0,0-16H96a8,8,0,0,0,0,16ZM232,56V184a16,16,0,0,1-16,16H155.57l-13.68,23.94a16,16,0,0,1-27.78,0L100.43,200H40a16,16,0,0,1-16-16V56A16,16,0,0,1,40,40H216A16,16,0,0,1,232,56Zm-16,0H40V184h65.07a8,8,0,0,1,7,4l16,28,16-28a8,8,0,0,1,7-4H216Z\"/></svg>"), format: "svg", height: 1.1em), baseline: 0.15em)
#let math-fail(src, block: false) = { let b = box(stroke: 0.3mm, inset: (x: 2pt, y: 1pt), text(size: 0.85em, raw(src))); if block { pad(left: 2em, [⚠ #b]) } else { [⚠#b] } }
#let ph-box(label) = block(width: 100%, height: 3em, stroke: (paint: luma(150), thickness: 0.5pt, dash: "dashed"), align(center + horizon, text(fill: luma(90), label)))

#block(width: 100%, inset: (bottom: 3pt), stroke: (bottom: 0.15mm + rgb("#999999")), below: 17.7pt)[#text(size: 12pt, weight: 600)[문제]]

함수 #mi("\\displaystyle f(x)=\\frac{x^2+1}{x}");에 대하여 다음 조건을 만족시키는 실수 #mi("\\displaystyle a");의 값을 구하시오\. \[4점\]

#block(width: 100%, stroke: 0.3mm, inset: (x: 8pt, y: 6pt), above: 21.7pt, below: 21.7pt, breakable: true)[
#grid(columns: (2.5em, 1fr), [#text(weight: 600)[(가)]], [#mi("\\displaystyle \\lim_{x \\to 0+} f(x) = \\infty");])

#grid(columns: (2.5em, 1fr), [#text(weight: 600)[(나)]], [모든 실수 #mi("\\displaystyle x");에 대하여 #mi("\\displaystyle f(x) \\ge 2");이다\.])
]

#block(width: 100%, stroke: 0.3mm, inset: (x: 8pt, y: 6pt), above: 21.7pt, below: 21.7pt, breakable: true)[
#grid(columns: (2.5em, 1fr), [#text(weight: 600)[ㄱ\.]], [#mi("\\displaystyle f(1)=2");])

#grid(columns: (2.5em, 1fr), [#text(weight: 600)[ㄴ\.]], [#mi("\\displaystyle f");는 연속이다\.])

#grid(columns: (2.5em, 1fr), [#text(weight: 600)[ㄷ\.]], [\[그림3\]을 참고하라\.])
]

#align(center, image("/.test-build/export-fig/fig.png", width: 270pt))

#block(above: 15.7pt, below: 15.7pt, grid(columns: (1fr,) * 5, column-gutter: 8pt, row-gutter: 0.8em, grid(columns: (auto, 1fr), column-gutter: 0.5em, align: horizon, [①], [#mi("\\displaystyle 1");]), grid(columns: (auto, 1fr), column-gutter: 0.5em, align: horizon, [②], [#mi("\\displaystyle \\sqrt{3}");]), grid(columns: (auto, 1fr), column-gutter: 0.5em, align: horizon, [③], [#mi("\\displaystyle \\dfrac{3}{8}");]), grid(columns: (auto, 1fr), column-gutter: 0.5em, align: horizon, [⑤], [#mi("\\displaystyle -\\dfrac{3\\sqrt{10}}{10}");])))

#colbreak()
#block(width: 100%, inset: (bottom: 3pt), stroke: (bottom: 0.15mm + rgb("#999999")), below: 17.7pt)[#text(size: 12pt, weight: 600)[풀이]]

#heading(level: 2, outlined: false)[STEP 1]

#grid(columns: (1fr, auto), align: (left + horizon, right + horizon), [#mitex("f(x) = x + \\frac{1}{x}")], [(1)])

#grid(columns: (1fr, auto), align: (left + horizon, right + horizon), [산술·기하평균에 의하여 #mi("\\displaystyle f(x) \\ge 2");이다\.], [(2)])

#block(width: 100%, above: 20.7pt, below: 20.7pt, breakable: true)[
#place(top + left, dx: -1.42em, dy: 0.16em, circle(radius: 0.22em, fill: black))#text(weight: 600)[C1. #mi("\\displaystyle x>0");인 경우]

#mitex("\\begin{cases} x+1 \\quad & (x<1) \\\\ x^2 \\quad & (x \\ge 1) \\end{cases}")
]

#box(image("/.test-build/export-fig/fig.png", width: 225pt));

#block(width: 100%, above: 20.7pt, below: 20.7pt, breakable: true)[
이어서 #text(weight: 600)[C1];에서 구한 값을 (1)에 대입한다\.
]

#block(width: 100%, above: 20.7pt, below: 20.7pt, breakable: true)[
#place(top + left, dx: -1.33em, dy: 0.25em, circle(radius: 0.13em, fill: black))#text(weight: 600)[C1a. #mi("\\displaystyle x=1");일 때]

값은 #mi("\\displaystyle \\text{(2)}");와 같다\.
]

#block(width: 100%, stroke: (left: 0.3mm), inset: (left: 1em, y: 4pt), above: 20.7pt, below: 20.7pt, breakable: true)[
#coach-icon #text(weight: 700)[Tip]

#mi("\\displaystyle x>0"); 조건을 빠뜨리지 말 것\.
]

#block(above: 20.7pt, below: 20.7pt, pad(left: 2em)[
#mi("\\displaystyle a=1");

#mi("\\displaystyle b=2");

#mi("\\displaystyle c=3");
])

#mitex("\\begin{array}{l}\\displaystyle a = 1 \\\\ \\displaystyle b = 2\\end{array}")

#block(above: 15.7pt, below: 15.7pt, text(size: 9.5pt, table(columns: (1fr,) * 3, align: (left, center, right), stroke: 0.2mm, inset: (x: 6pt, y: 3pt),
  table.header(table.cell(fill: rgb("#f5f5f5"))[#text(weight: 600)[#mi("\\displaystyle x");]], table.cell(fill: rgb("#f5f5f5"))[#text(weight: 600)[1]], table.cell(fill: rgb("#f5f5f5"))[#text(weight: 600)[2]]),
  [#mi("\\displaystyle P(X=x)");], [#mi("\\displaystyle \\frac{1}{3}");], [#mi("\\displaystyle \\frac{2}{3}");],
)))

#ph-box[그래프 — 화면에서 확인]

#align(center, image("/.test-build/export-fig/fig.png", width: 100%, height: 180pt, fit: "contain"))

#ph-box[GeoGebra — 화면에서 확인]

#v(1em)
#heading(level: 2, outlined: false)[STEP 2]

#block(width: 100%, above: 20.7pt, below: 20.7pt, breakable: true)[
#place(top + left, dx: -1.42em, dy: 0.16em, circle(radius: 0.22em, fill: black))#text(weight: 600)[C1. 새 구간의 첫 경우]
]

미래의 블록

#list(marker: ([•], [◦]), indent: 1em, body-indent: 0.4em, [첫째], [둘째])

#pad(left: 1em, grid(columns: (2em, 1fr), [#text(weight: 600)[①]], [하나]))

#pad(left: 1em, grid(columns: (2em, 1fr), [#text(weight: 600)[②]], [둘]))
