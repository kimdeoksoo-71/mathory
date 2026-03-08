/**
 * LaTeX 수식 자동완성 사전
 *
 * CodeMirror 6의 @codemirror/autocomplete와 연동하여
 * $ 또는 $$ 내부에서 \ 입력 시 자동완성 드롭다운을 표시합니다.
 */

export interface LatexCompletionItem {
  /** 매칭 라벨 (예: '\\frac') */
  label: string;
  /** 설명 (예: '분수') */
  detail: string;
  /** 삽입될 텍스트 (예: '\\frac{}{}') */
  template: string;
  /** {} 개수 (Tab stop 활성화 판단용) */
  braceCount: number;
  /** 카테고리 (정렬/필터용) */
  category: string;
  /** 정렬 우선순위 (낮을수록 위에 표시) */
  boost: number;
}

export const LATEX_COMPLETIONS: LatexCompletionItem[] = [
  // ═══ 기본 (분수, 루트, 첨자) ═══
  { label: '\\frac', detail: '분수', template: '\\frac{}{}', braceCount: 2, category: '기본', boost: 99 },
  { label: '\\dfrac', detail: '큰 분수', template: '\\dfrac{}{}', braceCount: 2, category: '기본', boost: 98 },
  { label: '\\sqrt', detail: '제곱근', template: '\\sqrt{}', braceCount: 1, category: '기본', boost: 97 },

  // ═══ 미적분 ═══
  { label: '\\int', detail: '적분', template: '\\int_{}^{} ', braceCount: 2, category: '미적분', boost: 95 },
  { label: '\\iint', detail: '이중적분', template: '\\iint ', braceCount: 0, category: '미적분', boost: 85 },
  { label: '\\iiint', detail: '삼중적분', template: '\\iiint ', braceCount: 0, category: '미적분', boost: 84 },
  { label: '\\oint', detail: '선적분', template: '\\oint ', braceCount: 0, category: '미적분', boost: 83 },
  { label: '\\sum', detail: '합', template: '\\sum_{}^{} ', braceCount: 2, category: '미적분', boost: 94 },
  { label: '\\prod', detail: '곱', template: '\\prod_{}^{} ', braceCount: 2, category: '미적분', boost: 90 },
  { label: '\\lim', detail: '극한', template: '\\lim_{} ', braceCount: 1, category: '미적분', boost: 93 },
  { label: '\\partial', detail: '편미분', template: '\\partial ', braceCount: 0, category: '미적분', boost: 88 },
  { label: '\\nabla', detail: '나블라', template: '\\nabla ', braceCount: 0, category: '미적분', boost: 82 },

  // ═══ 삼각함수 ═══
  { label: '\\sin', detail: '사인', template: '\\sin ', braceCount: 0, category: '함수', boost: 92 },
  { label: '\\cos', detail: '코사인', template: '\\cos ', braceCount: 0, category: '함수', boost: 91 },
  { label: '\\tan', detail: '탄젠트', template: '\\tan ', braceCount: 0, category: '함수', boost: 90 },
  { label: '\\csc', detail: '코시컨트', template: '\\csc ', braceCount: 0, category: '함수', boost: 80 },
  { label: '\\sec', detail: '시컨트', template: '\\sec ', braceCount: 0, category: '함수', boost: 80 },
  { label: '\\cot', detail: '코탄젠트', template: '\\cot ', braceCount: 0, category: '함수', boost: 80 },
  { label: '\\arcsin', detail: '아크사인', template: '\\arcsin ', braceCount: 0, category: '함수', boost: 75 },
  { label: '\\arccos', detail: '아크코사인', template: '\\arccos ', braceCount: 0, category: '함수', boost: 75 },
  { label: '\\arctan', detail: '아크탄젠트', template: '\\arctan ', braceCount: 0, category: '함수', boost: 75 },

  // ═══ 로그/지수 ═══
  { label: '\\log', detail: '로그', template: '\\log ', braceCount: 0, category: '함수', boost: 92 },
  { label: '\\ln', detail: '자연로그', template: '\\ln ', braceCount: 0, category: '함수', boost: 91 },
  { label: '\\exp', detail: '지수함수', template: '\\exp ', braceCount: 0, category: '함수', boost: 85 },
  { label: '\\log_', detail: '밑이 있는 로그', template: '\\log_{} ', braceCount: 1, category: '함수', boost: 90 },
  { label: '\\min', detail: '최솟값', template: '\\min ', braceCount: 0, category: '함수', boost: 80 },
  { label: '\\max', detail: '최댓값', template: '\\max ', braceCount: 0, category: '함수', boost: 80 },
  { label: '\\det', detail: '행렬식', template: '\\det ', braceCount: 0, category: '함수', boost: 70 },
  { label: '\\gcd', detail: '최대공약수', template: '\\gcd ', braceCount: 0, category: '함수', boost: 70 },

  // ═══ 관계 연산자 ═══
  { label: '\\leq', detail: '≤ 이하', template: '\\leq ', braceCount: 0, category: '관계', boost: 92 },
  { label: '\\geq', detail: '≥ 이상', template: '\\geq ', braceCount: 0, category: '관계', boost: 92 },
  { label: '\\neq', detail: '≠ 같지 않음', template: '\\neq ', braceCount: 0, category: '관계', boost: 91 },
  { label: '\\approx', detail: '≈ 근사', template: '\\approx ', braceCount: 0, category: '관계', boost: 85 },
  { label: '\\equiv', detail: '≡ 합동', template: '\\equiv ', braceCount: 0, category: '관계', boost: 84 },
  { label: '\\sim', detail: '∼ 유사', template: '\\sim ', braceCount: 0, category: '관계', boost: 83 },
  { label: '\\propto', detail: '∝ 비례', template: '\\propto ', braceCount: 0, category: '관계', boost: 75 },
  { label: '\\subset', detail: '⊂ 부분집합', template: '\\subset ', braceCount: 0, category: '관계', boost: 82 },
  { label: '\\supset', detail: '⊃ 상위집합', template: '\\supset ', braceCount: 0, category: '관계', boost: 80 },
  { label: '\\subseteq', detail: '⊆ 부분집합(같음포함)', template: '\\subseteq ', braceCount: 0, category: '관계', boost: 81 },
  { label: '\\supseteq', detail: '⊇ 상위집합(같음포함)', template: '\\supseteq ', braceCount: 0, category: '관계', boost: 79 },
  { label: '\\in', detail: '∈ 원소', template: '\\in ', braceCount: 0, category: '관계', boost: 90 },
  { label: '\\notin', detail: '∉ 원소 아님', template: '\\notin ', braceCount: 0, category: '관계', boost: 85 },
  { label: '\\perp', detail: '⊥ 수직', template: '\\perp ', braceCount: 0, category: '관계', boost: 80 },
  { label: '\\parallel', detail: '∥ 평행', template: '\\parallel ', braceCount: 0, category: '관계', boost: 80 },

  // ═══ 이항 연산자 ═══
  { label: '\\times', detail: '× 곱하기', template: '\\times ', braceCount: 0, category: '연산', boost: 92 },
  { label: '\\div', detail: '÷ 나누기', template: '\\div ', braceCount: 0, category: '연산', boost: 88 },
  { label: '\\cdot', detail: '· 가운뎃점', template: '\\cdot ', braceCount: 0, category: '연산', boost: 90 },
  { label: '\\pm', detail: '± 플마', template: '\\pm ', braceCount: 0, category: '연산', boost: 88 },
  { label: '\\mp', detail: '∓ 마플', template: '\\mp ', braceCount: 0, category: '연산', boost: 75 },
  { label: '\\cap', detail: '∩ 교집합', template: '\\cap ', braceCount: 0, category: '연산', boost: 82 },
  { label: '\\cup', detail: '∪ 합집합', template: '\\cup ', braceCount: 0, category: '연산', boost: 82 },
  { label: '\\setminus', detail: '∖ 차집합', template: '\\setminus ', braceCount: 0, category: '연산', boost: 78 },
  { label: '\\circ', detail: '∘ 합성', template: '\\circ ', braceCount: 0, category: '연산', boost: 78 },

  // ═══ 화살표 ═══
  { label: '\\to', detail: '→ 화살표', template: '\\to ', braceCount: 0, category: '화살표', boost: 93 },
  { label: '\\rightarrow', detail: '→ 오른쪽', template: '\\rightarrow ', braceCount: 0, category: '화살표', boost: 88 },
  { label: '\\leftarrow', detail: '← 왼쪽', template: '\\leftarrow ', braceCount: 0, category: '화살표', boost: 85 },
  { label: '\\Rightarrow', detail: '⇒ 이중 오른쪽', template: '\\Rightarrow ', braceCount: 0, category: '화살표', boost: 90 },
  { label: '\\Leftarrow', detail: '⇐ 이중 왼쪽', template: '\\Leftarrow ', braceCount: 0, category: '화살표', boost: 82 },
  { label: '\\leftrightarrow', detail: '↔ 양쪽', template: '\\leftrightarrow ', braceCount: 0, category: '화살표', boost: 80 },
  { label: '\\Leftrightarrow', detail: '⇔ 이중 양쪽', template: '\\Leftrightarrow ', braceCount: 0, category: '화살표', boost: 85 },

  // ═══ 그리스 소문자 ═══
  { label: '\\alpha', detail: 'α 알파', template: '\\alpha ', braceCount: 0, category: '그리스', boost: 95 },
  { label: '\\beta', detail: 'β 베타', template: '\\beta ', braceCount: 0, category: '그리스', boost: 94 },
  { label: '\\gamma', detail: 'γ 감마', template: '\\gamma ', braceCount: 0, category: '그리스', boost: 93 },
  { label: '\\delta', detail: 'δ 델타', template: '\\delta ', braceCount: 0, category: '그리스', boost: 92 },
  { label: '\\epsilon', detail: 'ε 엡실론', template: '\\epsilon ', braceCount: 0, category: '그리스', boost: 91 },
  { label: '\\varepsilon', detail: 'ε 엡실론(var)', template: '\\varepsilon ', braceCount: 0, category: '그리스', boost: 88 },
  { label: '\\zeta', detail: 'ζ 제타', template: '\\zeta ', braceCount: 0, category: '그리스', boost: 70 },
  { label: '\\eta', detail: 'η 에타', template: '\\eta ', braceCount: 0, category: '그리스', boost: 75 },
  { label: '\\theta', detail: 'θ 세타', template: '\\theta ', braceCount: 0, category: '그리스', boost: 90 },
  { label: '\\iota', detail: 'ι 이오타', template: '\\iota ', braceCount: 0, category: '그리스', boost: 60 },
  { label: '\\kappa', detail: 'κ 카파', template: '\\kappa ', braceCount: 0, category: '그리스', boost: 65 },
  { label: '\\lambda', detail: 'λ 람다', template: '\\lambda ', braceCount: 0, category: '그리스', boost: 88 },
  { label: '\\mu', detail: 'μ 뮤', template: '\\mu ', braceCount: 0, category: '그리스', boost: 85 },
  { label: '\\nu', detail: 'ν 뉴', template: '\\nu ', braceCount: 0, category: '그리스', boost: 70 },
  { label: '\\xi', detail: 'ξ 크시', template: '\\xi ', braceCount: 0, category: '그리스', boost: 70 },
  { label: '\\pi', detail: 'π 파이', template: '\\pi ', braceCount: 0, category: '그리스', boost: 92 },
  { label: '\\rho', detail: 'ρ 로', template: '\\rho ', braceCount: 0, category: '그리스', boost: 75 },
  { label: '\\sigma', detail: 'σ 시그마', template: '\\sigma ', braceCount: 0, category: '그리스', boost: 88 },
  { label: '\\tau', detail: 'τ 타우', template: '\\tau ', braceCount: 0, category: '그리스', boost: 75 },
  { label: '\\phi', detail: 'φ 파이', template: '\\phi ', braceCount: 0, category: '그리스', boost: 85 },
  { label: '\\varphi', detail: 'φ 파이(var)', template: '\\varphi ', braceCount: 0, category: '그리스', boost: 80 },
  { label: '\\chi', detail: 'χ 카이', template: '\\chi ', braceCount: 0, category: '그리스', boost: 70 },
  { label: '\\psi', detail: 'ψ 프사이', template: '\\psi ', braceCount: 0, category: '그리스', boost: 80 },
  { label: '\\omega', detail: 'ω 오메가', template: '\\omega ', braceCount: 0, category: '그리스', boost: 85 },

  // ═══ 그리스 대문자 ═══
  { label: '\\Gamma', detail: 'Γ 감마', template: '\\Gamma ', braceCount: 0, category: '그리스', boost: 80 },
  { label: '\\Delta', detail: 'Δ 델타', template: '\\Delta ', braceCount: 0, category: '그리스', boost: 82 },
  { label: '\\Theta', detail: 'Θ 세타', template: '\\Theta ', braceCount: 0, category: '그리스', boost: 78 },
  { label: '\\Lambda', detail: 'Λ 람다', template: '\\Lambda ', braceCount: 0, category: '그리스', boost: 76 },
  { label: '\\Pi', detail: 'Π 파이', template: '\\Pi ', braceCount: 0, category: '그리스', boost: 78 },
  { label: '\\Sigma', detail: 'Σ 시그마', template: '\\Sigma ', braceCount: 0, category: '그리스', boost: 80 },
  { label: '\\Phi', detail: 'Φ 파이', template: '\\Phi ', braceCount: 0, category: '그리스', boost: 76 },
  { label: '\\Psi', detail: 'Ψ 프사이', template: '\\Psi ', braceCount: 0, category: '그리스', boost: 74 },
  { label: '\\Omega', detail: 'Ω 오메가', template: '\\Omega ', braceCount: 0, category: '그리스', boost: 78 },

  // ═══ 장식 ═══
  { label: '\\overline', detail: '윗줄', template: '\\overline{}', braceCount: 1, category: '장식', boost: 90 },
  { label: '\\underline', detail: '밑줄', template: '\\underline{}', braceCount: 1, category: '장식', boost: 85 },
  { label: '\\vec', detail: '벡터', template: '\\vec{}', braceCount: 1, category: '장식', boost: 92 },
  { label: '\\hat', detail: '해트', template: '\\hat{}', braceCount: 1, category: '장식', boost: 85 },
  { label: '\\bar', detail: '바', template: '\\bar{}', braceCount: 1, category: '장식', boost: 85 },
  { label: '\\dot', detail: '도트', template: '\\dot{}', braceCount: 1, category: '장식', boost: 80 },
  { label: '\\ddot', detail: '더블도트', template: '\\ddot{}', braceCount: 1, category: '장식', boost: 75 },
  { label: '\\tilde', detail: '틸드', template: '\\tilde{}', braceCount: 1, category: '장식', boost: 78 },
  { label: '\\widehat', detail: '넓은 해트', template: '\\widehat{}', braceCount: 1, category: '장식', boost: 72 },
  { label: '\\widetilde', detail: '넓은 틸드', template: '\\widetilde{}', braceCount: 1, category: '장식', boost: 70 },
  { label: '\\overrightarrow', detail: '벡터 화살표', template: '\\overrightarrow{}', braceCount: 1, category: '장식', boost: 82 },
  { label: '\\overbrace', detail: '위 중괄호', template: '\\overbrace{}', braceCount: 1, category: '장식', boost: 70 },
  { label: '\\underbrace', detail: '아래 중괄호', template: '\\underbrace{}', braceCount: 1, category: '장식', boost: 70 },

  // ═══ 괄호 ═══
  { label: '\\left(', detail: '큰 괄호 ()', template: '\\left( \\right)', braceCount: 0, category: '괄호', boost: 92 },
  { label: '\\left[', detail: '큰 대괄호 []', template: '\\left[ \\right]', braceCount: 0, category: '괄호', boost: 88 },
  { label: '\\left\\{', detail: '큰 중괄호 {}', template: '\\left\\{ \\right\\}', braceCount: 0, category: '괄호', boost: 85 },
  { label: '\\left|', detail: '큰 절댓값 ||', template: '\\left| \\right|', braceCount: 0, category: '괄호', boost: 88 },
  { label: '\\left\\|', detail: '큰 이중선 ‖‖', template: '\\left\\| \\right\\|', braceCount: 0, category: '괄호', boost: 75 },
  { label: '\\left.', detail: '한쪽 괄호', template: '\\left. \\right|', braceCount: 0, category: '괄호', boost: 70 },

  // ═══ 환경 ═══
  { label: '\\begin{cases}', detail: '조건 함수', template: '\\begin{cases}\n & \\\\\\\\\n & \n\\end{cases}', braceCount: 0, category: '환경', boost: 92 },
  { label: '\\begin{pmatrix}', detail: '소괄호 행렬', template: '\\begin{pmatrix}\n & \\\\\\\\\n & \n\\end{pmatrix}', braceCount: 0, category: '환경', boost: 88 },
  { label: '\\begin{bmatrix}', detail: '대괄호 행렬', template: '\\begin{bmatrix}\n & \\\\\\\\\n & \n\\end{bmatrix}', braceCount: 0, category: '환경', boost: 85 },
  { label: '\\begin{vmatrix}', detail: '행렬식', template: '\\begin{vmatrix}\n & \\\\\\\\\n & \n\\end{vmatrix}', braceCount: 0, category: '환경', boost: 82 },
  { label: '\\begin{aligned}', detail: '정렬 수식', template: '\\begin{aligned}\n & \\\\\\\\\n & \n\\end{aligned}', braceCount: 0, category: '환경', boost: 90 },
  { label: '\\begin{array}', detail: '배열', template: '\\begin{array}{}\n & \\\\\\\\\n & \n\\end{array}', braceCount: 1, category: '환경', boost: 80 },

  // ═══ 텍스트/서식 ═══
  { label: '\\text', detail: '텍스트', template: '\\text{}', braceCount: 1, category: '서식', boost: 92 },
  { label: '\\mathrm', detail: '로만체', template: '\\mathrm{}', braceCount: 1, category: '서식', boost: 90 },
  { label: '\\mathbf', detail: '볼드체', template: '\\mathbf{}', braceCount: 1, category: '서식', boost: 82 },
  { label: '\\mathcal', detail: '캘리그래피', template: '\\mathcal{}', braceCount: 1, category: '서식', boost: 75 },
  { label: '\\mathbb', detail: '칠판 볼드', template: '\\mathbb{}', braceCount: 1, category: '서식', boost: 80 },
  { label: '\\boldsymbol', detail: '볼드 기호', template: '\\boldsymbol{}', braceCount: 1, category: '서식', boost: 72 },

  // ═══ 기타 기호 ═══
  { label: '\\infty', detail: '∞ 무한대', template: '\\infty ', braceCount: 0, category: '기호', boost: 95 },
  { label: '\\forall', detail: '∀ 모든', template: '\\forall ', braceCount: 0, category: '기호', boost: 80 },
  { label: '\\exists', detail: '∃ 존재', template: '\\exists ', braceCount: 0, category: '기호', boost: 80 },
  { label: '\\emptyset', detail: '∅ 공집합', template: '\\emptyset ', braceCount: 0, category: '기호', boost: 82 },
  { label: '\\angle', detail: '∠ 각도', template: '\\angle ', braceCount: 0, category: '기호', boost: 85 },
  { label: '\\triangle', detail: '△ 삼각형', template: '\\triangle ', braceCount: 0, category: '기호', boost: 85 },
  { label: '\\therefore', detail: '∴ 따라서', template: '\\therefore ', braceCount: 0, category: '기호', boost: 82 },
  { label: '\\because', detail: '∵ 왜냐하면', template: '\\because ', braceCount: 0, category: '기호', boost: 80 },
  { label: '\\cdots', detail: '⋯ 가운데 점', template: '\\cdots ', braceCount: 0, category: '기호', boost: 82 },
  { label: '\\ldots', detail: '… 바닥 점', template: '\\ldots ', braceCount: 0, category: '기호', boost: 80 },
  { label: '\\vdots', detail: '⋮ 세로 점', template: '\\vdots ', braceCount: 0, category: '기호', boost: 75 },
  { label: '\\ddots', detail: '⋱ 대각 점', template: '\\ddots ', braceCount: 0, category: '기호', boost: 72 },
  { label: '\\prime', detail: '′ 프라임', template: '\\prime ', braceCount: 0, category: '기호', boost: 78 },
  { label: '\\neg', detail: '¬ 부정', template: '\\neg ', braceCount: 0, category: '기호', boost: 70 },
  { label: '\\star', detail: '⋆ 별', template: '\\star ', braceCount: 0, category: '기호', boost: 65 },

  // ═══ 공백 ═══
  { label: '\\quad', detail: '큰 공백', template: '\\quad ', braceCount: 0, category: '공백', boost: 80 },
  { label: '\\qquad', detail: '아주 큰 공백', template: '\\qquad ', braceCount: 0, category: '공백', boost: 75 },

  // ═══ 순열/조합 ═══
  { label: '\\mathrm{P}', detail: '순열 P', template: '{}_{}\\ \\mathrm{P}_{}', braceCount: 3, category: '순열조합', boost: 88 },
  { label: '\\mathrm{C}', detail: '조합 C', template: '{}_{}\\ \\mathrm{C}_{}', braceCount: 3, category: '순열조합', boost: 88 },
  { label: '\\mathrm{H}', detail: '중복조합 H', template: '{}_{}\\ \\mathrm{H}_{}', braceCount: 3, category: '순열조합', boost: 85 },
  { label: '\\Pi_r', detail: '중복순열 Π', template: '{}_{}\\ \\Pi_{}', braceCount: 3, category: '순열조합', boost: 85 },

  // ═══ displaystyle ═══
  { label: '\\displaystyle', detail: '큰 수식 스타일', template: '\\displaystyle ', braceCount: 0, category: '서식', boost: 70 },
];


/**
 * 커서가 수식 모드 ($...$ 또는 $$...$$) 내부에 있는지 판별합니다.
 */
export function isInsideMath(doc: string, pos: number): boolean {
  let inDisplay = false;
  let inInline = false;
  let i = 0;

  while (i < pos) {
    // 이스케이프 처리 (\$)
    if (doc[i] === '\\' && i + 1 < doc.length && doc[i + 1] === '$') {
      i += 2;
      continue;
    }

    // $$ (display math)
    if (doc[i] === '$' && i + 1 < doc.length && doc[i + 1] === '$') {
      if (inDisplay) {
        inDisplay = false;
      } else if (!inInline) {
        inDisplay = true;
      }
      i += 2;
      continue;
    }

    // $ (inline math)
    if (doc[i] === '$') {
      if (!inDisplay) {
        inInline = !inInline;
      }
      i += 1;
      continue;
    }

    i++;
  }

  return inInline || inDisplay;
}