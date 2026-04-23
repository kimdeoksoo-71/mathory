/**
 * Phase 28 — Mathpix OCR 프록시
 *
 * 입력: { src: string }  ← base64 data URL
 * 출력: { text: string, confidence?: number } | { error: string }
 *
 * Mathpix `text` 포맷으로 수식 + 일반 텍스트를 함께 반환.
 * 인라인/디스플레이 수식 구분자는 mathory 규칙(`$`, `$$`)으로 지정.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const appId = process.env.MATHPIX_APP_ID;
    const appKey = process.env.MATHPIX_APP_KEY;
    if (!appId || !appKey) {
      return NextResponse.json(
        { error: 'Mathpix 환경변수(MATHPIX_APP_ID, MATHPIX_APP_KEY)가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const body = (await req.json()) as { src?: string; languages?: string[] };
    if (!body.src || typeof body.src !== 'string') {
      return NextResponse.json({ error: '이미지 데이터(src)가 없습니다.' }, { status: 400 });
    }

    // NOTE(언어 힌트): Mathpix `/v3/text`는 언어/로케일 파라미터를 공식 지원하지 않음.
    // `alphabets_allowed`로 알파벳을 제한하면 인식률 자체가 급락하므로 전달하지 않는다.
    // 텍스트 언어 편향은 Mathpix 대시보드의 계정 단위 Preferred Language로 조정 권장.
    // (`body.languages`는 호환성 위해 받되 현재는 사용하지 않음)

    const resp = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'app_id': appId,
        'app_key': appKey,
      },
      body: JSON.stringify({
        src: body.src,
        formats: ['text'],
        math_inline_delimiters: ['$', '$'],
        math_display_delimiters: ['$$', '$$'],
        rm_spaces: true,
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      return NextResponse.json(
        { error: `Mathpix API 오류 (${resp.status}): ${txt.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = await resp.json();
    if (data.error) {
      return NextResponse.json({ error: `Mathpix: ${data.error}` }, { status: 502 });
    }

    const text: string = (data.text || '').trim();
    if (!text) {
      return NextResponse.json({ error: '인식된 내용이 없습니다.' }, { status: 422 });
    }

    return NextResponse.json({ text, confidence: data.confidence });
  } catch (err: any) {
    console.error('[ocr] error:', err);
    return NextResponse.json(
      { error: err?.message || 'OCR 처리 실패' },
      { status: 500 }
    );
  }
}
