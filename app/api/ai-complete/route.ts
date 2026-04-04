import { NextRequest, NextResponse } from 'next/server';
import { getAIProvider } from '../../../lib/ai-provider';

interface AICompleteRequest {
  questionContext: string;
  previousBlocks: string[];
  currentText: string;
}

const SYSTEM_PROMPT = `당신은 한국 고등학교 수학 풀이에서 수식 입력을 대신해주는 도우미입니다.
설명과 서술은 사람이 직접 씁니다. 당신의 역할은 사람이 시작한 문장의 수식 부분을 완성하는 것뿐입니다.

핵심 규칙:
1. 현재 문장 한두 줄만 완성하세요. 문단을 만들지 마세요. 여러 문장을 쓰지 마세요.
2. 최종 답을 구하지 마세요. 현재 단계의 중간 결과만 구하세요.
3. 장황한 설명을 쓰지 마세요. 수식 전개를 간결하게 제시하세요.
4. 수식의 전개 과정은 단계별로 생략 없이 보여주세요. 결과값만 덜렁 제시하면 안 됩니다.
5. 이어쓴 부분만 반환하세요. 사용자가 이미 쓴 텍스트를 반복하지 마세요.

수식 전개 순서 (반드시 이 순서를 지키세요):
1단계. 문자식 — 공식을 문자 그대로 전개하고 정리한다. 이것이 풀이의 핵심이다.
2단계. 숫자 대입 — 문자식에 구체적인 값을 대입한다.
3단계. 계산 결과 — 숫자 대입 후 계산은 최종 답 포함 최대 2단계만. 중간 산술 과정은 과감히 생략한다.

⚠️ 절대 규칙: 숫자를 대입한 식을 쓰기 전에 반드시 숫자 대입 전의 문자식을 먼저 써야 합니다.
문자식 없이 숫자만 대입된 식을 바로 쓰는 것은 금지입니다.
문자식은 절대 생략할 수 없습니다. 풀이에서 가장 중요한 부분입니다.
숫자 대입 이후의 계산은 부차적입니다. 대입식 → 최종 결과, 최대 2개의 등호만 허용합니다.

수식 표기:
- 곱셈 기호는 \\cdot이 아니라 반드시 \\times를 사용하세요.
- 번분수(분수 안에 분수)에서는 반드시 \\dfrac를 사용하세요. \\frac 금지.

형식:
- KaTeX 호환 LaTeX (인라인: $...$, 디스플레이: $$...$$)
- "생각:", "풀이:", "답:", "따라서 답은" 같은 메타 레이블이나 결론 문구 금지
- \\tag{}, \\ref{} 등 Mathory 전용 매크로 사용 금지

예시 — 사용자가 "코사인법칙에 의하여"라고 쓰면:
좋은 응답: ", $\\cos A = \\dfrac{AB^2+CA^2-BC^2}{2 \\times AB \\times CA} = \\dfrac{9+49-25}{42} = \\dfrac{11}{14}$이므로"
  → 문자식(1개) + 대입(1개) + 결과(1개). 숫자 대입 후 등호 2개로 끝.
나쁜 응답: "$= \\dfrac{9+49-25}{42} = \\dfrac{33}{42} = \\dfrac{33 \\div 3}{42 \\div 3} = \\dfrac{11}{14}$"
  → 문자식 없음, 숫자 계산 등호 4개. 이렇게 쓰면 안 됨.`;

export async function POST(req: NextRequest) {
  try {
    const body: AICompleteRequest = await req.json();

    if (!body.currentText?.trim()) {
      return NextResponse.json(
        { error: '완성할 텍스트가 없습니다' },
        { status: 400 }
      );
    }

    const previousContext = body.previousBlocks?.length
      ? body.previousBlocks.join('\n\n')
      : '없음';

    const userPrompt = `[문제]
${body.questionContext || '없음'}

[이전 풀이]
${previousContext}

[현재 텍스트 — 이어서 완성]
${body.currentText}`;

    const provider = getAIProvider();
    let completion = await provider.complete(SYSTEM_PROMPT, userPrompt);
    completion = completion.trim();

    // "생각: ..." 등 메타 텍스트 블록 제거
    completion = completion.replace(/^생각:.*?\n\n/s, '');

    // AI가 기존 텍스트를 반복한 경우 접두사 제거
    const currentTrimmed = body.currentText.trim();
    if (completion.startsWith(currentTrimmed)) {
      completion = completion.slice(currentTrimmed.length);
    }
    completion = completion.trim();

    return NextResponse.json({ completion });
  } catch (error: any) {
    console.error('[ai-complete] Error:', error);

    if (error.message?.includes('API_KEY') || error.message?.includes('환경변수')) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다' }, { status: 500 });
    }

    return NextResponse.json(
      { error: error.message || 'AI 완성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
