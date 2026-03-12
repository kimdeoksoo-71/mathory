/**
 * 맞춤법 검사 API 프록시
 *
 * 부산대 맞춤법 검사기(현 바른한글, nara-speller.co.kr)를 프록시하여
 * CORS 문제를 우회하고 정규화된 JSON 응답을 반환합니다.
 *
 * 엔드포인트 우선순위:
 *  1차: http://164.125.7.61/speller/results (IP 직접 접속 — 더 안정적)
 *  2차: https://nara-speller.co.kr/results  (도메인)
 */

import { NextRequest, NextResponse } from 'next/server';

interface SpellError {
  orgStr: string;      // 원문(틀린 단어)
  candWord: string;    // 교정 후보 (공백 구분)
  help: string;        // 설명
  start: number;       // 원문 내 시작 위치
  end: number;         // 원문 내 끝 위치
  errorType: number;   // correctMethod (1~7)
}

interface SpellResult {
  errors: SpellError[];
}

// ── 엔드포인트 목록 (순서대로 시도) ──
const ENDPOINTS = [
  'http://164.125.7.61/speller/results',
  'https://nara-speller.co.kr/results',
];

async function tryFetch(url: string, text: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://nara-speller.co.kr/speller/',
      },
      body: new URLSearchParams({ text1: text }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ errors: [] });
    }

    // 개행문자 처리 (부산대 검사기 요구사항)
    const prepared = text.slice(0, 500).replace(/\n/g, '\r\n');

    // 엔드포인트 순차 시도
    let html: string | null = null;
    for (const endpoint of ENDPOINTS) {
      html = await tryFetch(endpoint, prepared);
      if (html) break;
    }

    if (!html) {
      console.error('맞춤법 검사기: 모든 엔드포인트 연결 실패');
      return NextResponse.json({ errors: [] });
    }

    // ── 응답 HTML에서 data = [...] 추출 ──
    // 형식: data = [{str: "...", errInfo: [...]}];
    const startMarker = 'data = [';
    const startIdx = html.indexOf(startMarker);
    if (startIdx === -1) {
      return NextResponse.json({ errors: [] });
    }

    const jsonStart = startIdx + startMarker.length - 1; // '[' 포함
    const endIdx = html.indexOf('];', jsonStart);
    if (endIdx === -1) {
      return NextResponse.json({ errors: [] });
    }

    const jsonStr = html.substring(jsonStart, endIdx + 1);

    let parsed: any[];
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('맞춤법 검사 결과 파싱 실패');
      return NextResponse.json({ errors: [] });
    }

    const errors: SpellError[] = [];

    for (const item of parsed) {
      if (item.errInfo && Array.isArray(item.errInfo)) {
        for (const err of item.errInfo) {
          errors.push({
            orgStr: err.orgStr || '',
            candWord: err.candWord || '',
            help: err.help || '',
            start: typeof err.start === 'number' ? err.start : 0,
            end: typeof err.end === 'number' ? err.end : 0,
            errorType: typeof err.correctMethod === 'number' ? err.correctMethod : 0,
          });
        }
      }
    }

    return NextResponse.json({ errors } satisfies SpellResult);
  } catch (error: any) {
    if (error?.name !== 'AbortError') {
      console.error('맞춤법 검사 오류:', error?.message);
    }
    return NextResponse.json({ errors: [] });
  }
}
