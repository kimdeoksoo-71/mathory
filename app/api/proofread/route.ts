/**
 * Phase 27 — 한글 맞춤법 / 띄어쓰기 교정 API
 *
 * 입력: { blocks: [{ id, masked }] }   ← 수식이 ⟦M0⟧, ⟦M1⟧... 로 마스킹된 상태
 * 출력: { results: { [blockId]: { status, issues, error? } } }
 *
 * Claude Haiku 4.5 + tool_use 스키마로 안정적인 JSON 반환을 강제.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

interface ReqBlock { id: string; masked: string; }
interface ProofreadRequest { blocks: ReqBlock[]; }

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

const SYSTEM_PROMPT = `당신은 한국어 수학 문제집 교정자입니다. 입력된 각 블록 텍스트의 한글 맞춤법, 띄어쓰기, 오자/탈자를 검토합니다.

규칙:
1. ⟦M0⟧, ⟦M1⟧ 같은 토큰은 수식 또는 마커의 자리표시자입니다. 절대 수정하지 말고 원형 그대로 유지하세요.
2. 마크다운 기호(#, *, -, > 등)는 유지하세요.
3. 의심스럽지 않으면 보고하지 마세요. 확실한 오류만 지적하세요.
4. 각 오류에 대해:
   - kind: "spelling" (오/탈자) | "spacing" (띄어쓰기) | "other"
   - original: 원문에서 발췌한 짧은 스니펫(앞뒤 1~2단어 포함, 토큰 포함 가능)
   - suggestion: 수정안 (오류 부분만 교체)
   - reason: 한 줄 설명
5. 수식-조사 공백 오류는 다른 시스템에서 처리하므로 여기서는 보고하지 마세요.
6. 오류가 없으면 빈 배열을 반환하세요.

반드시 report_issues 도구를 호출해 결과를 반환하세요.`;

const TOOL_SCHEMA = {
  name: 'report_issues',
  description: '각 블록의 교정 결과를 보고합니다.',
  input_schema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        description: '입력 블록 순서대로 교정 결과 배열',
        items: {
          type: 'object',
          properties: {
            block_id: { type: 'string' },
            issues: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  kind: { type: 'string', enum: ['spelling', 'spacing', 'other'] },
                  original: { type: 'string' },
                  suggestion: { type: 'string' },
                  reason: { type: 'string' },
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
  },
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다' },
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

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [TOOL_SCHEMA],
      tool_choice: { type: 'tool', name: 'report_issues' },
      messages: [{ role: 'user', content: userPrompt }],
    });

    // tool_use 블록 추출
    const toolBlock = response.content.find((c) => c.type === 'tool_use');
    if (!toolBlock || toolBlock.type !== 'tool_use') {
      return NextResponse.json(
        { error: 'AI 응답에서 결과를 추출할 수 없습니다' },
        { status: 502 }
      );
    }

    const input = toolBlock.input as { results: Array<{ block_id: string; issues: any[] }> };

    // 응답 정규화: 입력 블록 ID 모두 채우기
    const results: Record<string, { status: 'ok' | 'failed'; issues: any[] }> = {};
    for (const b of body.blocks) {
      const found = input.results?.find((r) => r.block_id === b.id);
      results[b.id] = {
        status: 'ok',
        issues: found?.issues || [],
      };
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('[proofread] Error:', error);
    return NextResponse.json(
      { error: error.message || '교정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
