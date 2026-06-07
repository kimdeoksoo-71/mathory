/**
 * Phase 27 — 한글 맞춤법 / 띄어쓰기 교정 API
 *
 * 입력: { blocks: [{ id, masked }] }   ← 수식이 ⟦M0⟧, ⟦M1⟧... 로 마스킹된 상태
 * 출력: { results: { [blockId]: { status, issues, error? } } }
 *
 * Gemini Flash + responseSchema(JSON 모드)로 안정적인 구조화 출력 강제.
 * (이전: Claude Haiku 4.5 + tool_use → Gemini로 전환)
 */

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

interface ReqBlock { id: string; masked: string; }
interface ProofreadRequest { blocks: ReqBlock[]; }

const MODEL = process.env.GEMINI_PROOFREAD_MODEL || 'gemini-2.5-flash';

const SYSTEM_PROMPT = `당신은 한국어 수학 문제집의 보수적인 교정자입니다. **확실한 오류만** 보고하고, 의심스러우면 침묵하세요.

⚠️ 최우선 규칙 — **오탐(false positive)이 누락보다 훨씬 나쁩니다**:
- 국립국어원 표준국어대사전과 한글맞춤법 통일안에 비추어 **100% 명백한 오류**만 보고하세요.
- 90% 미만의 확신이면 보고 금지.
- 띄어쓰기는 한국어에서 허용 범위가 넓습니다. 보조용언·관용표현·전문용어 등은 붙여쓰기/띄어쓰기가 모두 허용되는 경우가 많으니, **표준이 명확하지 않으면 보고하지 마세요**.
- 수학·과학 전문용어("함수값"/"함숫값", "방정식" 등 표기 변형, 외래어)는 표준이 모호하면 **보고하지 마세요**.

보고 금지 패턴 (이 경우는 절대 issue로 만들지 마세요):
1. 의미가 통하고 자주 쓰이는 표현 (예: "다음과같이" → "다음과 같이"는 띄어쓰기 정도 모호하니 보고 X)
2. 문체/스타일 선호 (격식체↔구어체, 종결어미 선택 등)
3. 외래어 표기법 변형 (단, 명백한 오타는 보고)
4. 의도적으로 짧게 쓴 문장 부호 생략
5. 수식 외 기호 (괄호, 점 등) 사용법

규칙:
1. ⟦M0⟧, ⟦M1⟧ 같은 토큰은 수식·마커 자리표시자입니다. 절대 수정 금지, 원형 유지.
2. 마크다운 기호(#, *, -, > 등)는 유지.
3. 각 오류 형식:
   - kind: "spelling" (오/탈자) | "spacing" (띄어쓰기) | "other"
   - original: 원문에서 발췌한 짧은 스니펫 (앞뒤 1~2단어 포함)
   - suggestion: 수정안
   - reason: 한 줄 설명 (왜 명백한 오류인지)
4. 수식-조사 공백 오류는 다른 시스템에서 처리하므로 여기서는 보고하지 마세요.
5. **오류가 없으면 빈 배열을 반환하세요. 이게 정상이고 흔한 결과입니다.**

판단 절차 (각 의심 후보에 대해):
1) 표준국어대사전에 명확히 등재된 정답이 있는가? → 없으면 보고 X
2) 다른 해석 여지가 있는가? → 있으면 보고 X
3) 위 "보고 금지 패턴"에 해당하는가? → 해당하면 보고 X
4) 위 셋 다 통과한 경우에만 보고.

지정된 JSON 스키마(results 배열, 각 항목 block_id + issues)를 정확히 따라 반환하세요.`;

const RESPONSE_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    results: {
      type: SchemaType.ARRAY,
      description: '입력 블록 순서대로 교정 결과 배열',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          block_id: { type: SchemaType.STRING },
          issues: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                kind: { type: SchemaType.STRING, enum: ['spelling', 'spacing', 'other'] },
                original: { type: SchemaType.STRING },
                suggestion: { type: SchemaType.STRING },
                reason: { type: SchemaType.STRING },
              },
              required: ['kind', 'original', 'suggestion', 'reason'],
            },
          },
        },
        required: ['block_id', 'issues'],
      },
    },
  },
  required: ['results'],
};

interface IssueRaw {
  kind?: string;
  original?: string;
  suggestion?: string;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다' },
        { status: 500 }
      );
    }

    const body: ProofreadRequest = await req.json();
    if (!body.blocks?.length) {
      return NextResponse.json({ results: {} });
    }

    const userPrompt = body.blocks
      .map((b) => `[BLOCK ${b.id}]\n${b.masked}`)
      .join('\n\n---\n\n');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: MODEL,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        responseMimeType: 'application/json',
        // SDK 타입이 보수적이라 any 캐스트
        responseSchema: RESPONSE_SCHEMA as unknown as Parameters<typeof genAI.getGenerativeModel>[0]['generationConfig'] extends infer T ? T : never,
        maxOutputTokens: 4096,
        // 보수적 판단을 위해 temperature 낮춤 (기본 1.0 → 0.2)
        temperature: 0.2,
      } as Parameters<typeof genAI.getGenerativeModel>[0]['generationConfig'],
    });

    const apiResult = await model.generateContent(userPrompt);
    const text = apiResult.response.text();

    let parsed: { results?: Array<{ block_id: string; issues: IssueRaw[] }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error('[proofread] JSON parse 실패. raw:', text.slice(0, 200));
      return NextResponse.json(
        { error: 'AI 응답이 유효한 JSON이 아닙니다' },
        { status: 502 }
      );
    }

    // 응답 정규화: 입력 블록 ID 모두 채우기
    const results: Record<string, { status: 'ok' | 'failed'; issues: IssueRaw[] }> = {};
    for (const b of body.blocks) {
      const found = parsed.results?.find((r) => r.block_id === b.id);
      results[b.id] = {
        status: 'ok',
        issues: found?.issues || [],
      };
    }

    return NextResponse.json({ results });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '교정 중 오류가 발생했습니다';
    console.error('[proofread] Error:', error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
