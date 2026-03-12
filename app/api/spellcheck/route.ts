/**
 * 맞춤법 검사 API 프록시
 *
 * 여러 맞춤법 검사 엔드포인트를 순차적으로 시도합니다.
 * - 1차: 부산대 (nara-speller.co.kr)
 * - 2차: 부산대 IP 직접 접속
 * - 3차: 부산대 구 도메인
 *
 * 모든 엔드포인트 실패 시 빈 결과를 반환합니다 (다른 기능에 영향 없음).
 */

import { NextRequest, NextResponse } from 'next/server';

interface SpellError {
  orgStr: string;
  candWord: string;
  help: string;
  start: number;
  end: number;
  errorType: number;
}

// ── 엔드포인트 목록 (순서대로 시도) ──
const ENDPOINTS = [
  { url: 'https://nara-speller.co.kr/results', label: 'nara-speller (HTTPS)' },
  { url: 'http://nara-speller.co.kr/results', label: 'nara-speller (HTTP)' },
  { url: 'http://164.125.7.61/speller/results', label: '부산대 IP' },
  { url: 'http://speller.cs.pusan.ac.kr/results', label: '부산대 도메인' },
];

// ── HTML에서 data 추출 ──
function parseResponse(html: string): SpellError[] {
  const startMarker = 'data = [';
  const startIdx = html.indexOf(startMarker);
  if (startIdx === -1) return [];

  const jsonStart = startIdx + startMarker.length - 1;
  const endIdx = html.indexOf('];', jsonStart);
  if (endIdx === -1) return [];

  try {
    const parsed = JSON.parse(html.substring(jsonStart, endIdx + 1));
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
    return errors;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ errors: [] });
    }

    const prepared = text.slice(0, 500).replace(/\n/g, '\r\n');

    // 각 엔드포인트를 순차 시도
    for (const endpoint of ENDPOINTS) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
            'Referer': endpoint.url.replace('/results', '/'),
          },
          body: new URLSearchParams({ text1: prepared }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          console.log(`[맞춤법] ${endpoint.label}: HTTP ${response.status}`);
          continue;
        }

        const html = await response.text();
        const errors = parseResponse(html);

        // 파싱 성공 시 반환 (errors가 빈 배열이어도 파싱 자체는 성공)
        if (html.includes('data =')) {
          console.log(`[맞춤법] ${endpoint.label}: 성공 (${errors.length}개 오류 발견)`);
          return NextResponse.json({ errors });
        }

        console.log(`[맞춤법] ${endpoint.label}: 응답은 받았으나 data 없음`);
      } catch (err: any) {
        const reason = err?.name === 'AbortError' ? '시간초과' : (err?.cause?.code || err?.message || '연결 실패');
        console.log(`[맞춤법] ${endpoint.label}: ${reason}`);
      }
    }

    console.log('[맞춤법] 모든 엔드포인트 실패 — 빈 결과 반환');
    return NextResponse.json({ errors: [] });
  } catch (error: any) {
    console.error('[맞춤법] 요청 처리 오류:', error?.message);
    return NextResponse.json({ errors: [] });
  }
}
