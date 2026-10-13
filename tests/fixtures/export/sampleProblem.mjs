/**
 * Phase 70 — 내보내기 고정 표본. IR·LaTeX·Typst 테스트가 같은 표본을 쓴다.
 * 백슬래시가 많아 JSON 대신 String.raw를 쓰는 .mjs로 둔다.
 *
 * 덮는 것: 17종 중 실사용 갈래 전부 · 마커 3종 · 텍스트/수식 \tag · rows(bare \\) · 표 · 그림 3종 ·
 * mathory-graph · 레거시 타입 · 미지 타입 · 경우 라벨(이어짓기·하위·제목 리셋) · C1 참조 · \ref · Fig.N
 */
const R = String.raw;

export const sampleProblem = {
  title: '표본 문항: 미적분 #21',
  locale: 'ko',
  tabs: [
    {
      id: 'question', label: '문제',
      blocks: [
        { id: 'q1', type: 'text', raw_text: R`함수 $f(x)=\frac{x^2+1}{x}$에 대하여 다음 조건을 만족시키는 실수 $a$의 값을 구하시오. [4점]` },
        { id: 'q2', type: 'gana', raw_text: R`(가) $\lim_{x \to 0+} f(x) = \infty$
(나) 모든 실수 $x$에 대하여 $f(x) \ge 2$이다.` },
        { id: 'q3', type: 'roman', raw_text: R`ㄱ. $f(1)=2$
ㄴ. $f$는 연속이다.
ㄷ. Fig.3을 참고하라.` },
        { id: 'q4', type: 'image', raw_text: '<img src="https://example.com/fig1.png" alt="그래프" width="400" />', imageWidth: 360, imageGray: true },
        { id: 'q5', type: 'choices', raw_text: R`① $1$
② $\sqrt{3}$
③ $\dfrac{3}{8}$
④
⑤ $-\dfrac{3\sqrt{10}}{10}$` },
      ],
    },
    {
      id: 'solution', label: '풀이',
      blocks: [
        { id: 's1', type: 'heading', raw_text: '## STEP 1' },
        { id: 's2', type: 'text', raw_text: R`$$
f(x) = x + \frac{1}{x} \tag{1}
$$

산술·기하평균에 의하여 $f(x) \ge 2$이다. \tag{2}` },
        { id: 's3', type: 'case', raw_text: R`$x>0$인 경우
$$
\begin{cases} x+1 & (x<1) \\ x^2 & (x \ge 1) \end{cases}
$$` },
        { id: 's4', type: 'text', raw_text: '<img src="https://example.com/fig1.png" alt="" width="300" />' },
        { id: 's5', type: 'case', raw_text: '\n이어서 C1에서 구한 값을 \\ref{1}에 대입한다.' },
        { id: 's6', type: 'subcase', raw_text: R`$x=1$일 때
값은 $\ref{2}$와 같다.` },
        { id: 's7', type: 'coach_important', raw_text: R`$x>0$ 조건을 빠뜨리지 말 것.` },
        { id: 's8', type: 'callout', raw_text: R`$a=1$
$b=2$
$c=3$` },
        { id: 's9', type: 'math_block', raw_text: R`$$
a = 1 \\
b = 2 \\
$$` },
        { id: 's10', type: 'text', raw_text: R`| $x$ | 1 | 2 |
|:---|:---:|---:|
| $P(X=x)$ | $\frac{1}{3}$ | $\frac{2}{3}$ |` },
        { id: 's11', type: 'text', raw_text: '```mathory-graph\n{"fn":"x^2"}\n```' },
        { id: 's12', type: 'svg', raw_text: 'https://example.com/a.svg', svg_height: 240 },
        { id: 's13', type: 'ggb', raw_text: 'https://example.com/a.ggb' },
        { id: 's14', type: 'heading', raw_text: '## STEP 2' },
        { id: 's15', type: 'case', raw_text: '새 구간의 첫 경우' },
        { id: 's16', type: 'future_type', raw_text: '미래의 블록' },
        { id: 's17', type: 'list', raw_text: '- 첫째\n- 둘째\n\n① 하나\n② 둘' },
      ],
    },
  ],
};
