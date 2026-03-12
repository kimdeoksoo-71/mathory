/**
 * 한국어 맞춤법 검사 — CodeMirror 연동
 *
 * 비수식 영역의 텍스트를 추출하여 부산대 맞춤법 검사기 API를 호출하고,
 * 오류 위치를 파란색 점선 밑줄 진단(Diagnostic)으로 반환합니다.
 *
 * - CodeMirror의 linter() 인프라를 사용
 * - 수식($, $$) 내부는 검사 대상에서 제외
 * - 마크다운 문법 요소(#, *, >, 등)도 제외
 * - 디바운스(1.5초)로 API 호출 빈도 제한
 */

import { Diagnostic } from '@codemirror/lint';

interface SpellError {
  orgStr: string;
  candWord: string;
  help: string;
  start: number;
  end: number;
  errorType: number;
}

// ── 비수식 텍스트 영역 추출 ──────────────────────────────────
interface TextSegment {
  text: string;
  offset: number; // 원본 문서 내 시작 위치
}

function extractNonMathText(doc: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let i = 0;
  let segStart = 0;

  while (i < doc.length) {
    // $$ 블록 수식 건너뛰기
    if (doc[i] === '$' && doc[i + 1] === '$') {
      if (i > segStart) {
        segments.push({ text: doc.substring(segStart, i), offset: segStart });
      }
      const closeIdx = doc.indexOf('$$', i + 2);
      if (closeIdx === -1) {
        segStart = doc.length;
        break;
      }
      i = closeIdx + 2;
      segStart = i;
      continue;
    }

    // $ 인라인 수식 건너뛰기
    if (doc[i] === '$' && (i === 0 || doc[i - 1] !== '\\')) {
      if (i > segStart) {
        segments.push({ text: doc.substring(segStart, i), offset: segStart });
      }
      let closeIdx = -1;
      for (let j = i + 1; j < doc.length; j++) {
        if (doc[j] === '$' && doc[j - 1] !== '\\' && (j + 1 >= doc.length || doc[j + 1] !== '$')) {
          closeIdx = j;
          break;
        }
        if (doc[j] === '\n' && j + 1 < doc.length && doc[j + 1] === '\n') break;
      }

      if (closeIdx !== -1) {
        i = closeIdx + 1;
      } else {
        i++;
      }
      segStart = i;
      continue;
    }

    i++;
  }

  if (segStart < doc.length) {
    segments.push({ text: doc.substring(segStart), offset: segStart });
  }

  return segments;
}

// ── 마크다운 문법 요소 제거 (검사 대상 제외) ──────────────────
function stripMarkdownSyntax(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')     // 제목
    .replace(/\*\*([^*]*)\*\*/g, '$1') // 볼드
    .replace(/\*([^*]*)\*/g, '$1')     // 이탤릭
    .replace(/~~([^~]*)~~/g, '$1')     // 취소선
    .replace(/`[^`]*`/g, '')           // 인라인 코드
    .replace(/^\s*[-*+]\s+/gm, '')     // 리스트
    .replace(/^\s*\d+\.\s+/gm, '')     // 번호 리스트
    .replace(/^\s*>\s*/gm, '')         // 인용
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')  // 이미지
    .replace(/<[^>]*>/g, '');          // HTML 태그
}

// ── 텍스트 세그먼트를 결합하여 API 호출용 텍스트 생성 ──────────
function buildPlainText(segments: TextSegment[]): string {
  return segments.map(s => stripMarkdownSyntax(s.text)).join(' ');
}

// ── 오류 위치를 원본 문서 좌표로 변환 ──────────────────────────
function mapErrorToDocPosition(
  error: SpellError,
  plainText: string,
  segments: TextSegment[],
  doc: string
): { from: number; to: number } | null {
  // plainText 내에서 orgStr의 위치를 찾기
  const errWord = error.orgStr;
  if (!errWord) return null;

  // plainText에서 해당 단어의 모든 출현 위치 찾기
  let searchFrom = 0;
  const candidates: number[] = [];

  while (searchFrom < plainText.length) {
    const idx = plainText.indexOf(errWord, searchFrom);
    if (idx === -1) break;
    candidates.push(idx);
    searchFrom = idx + 1;
  }

  if (candidates.length === 0) return null;

  // 원본 문서에서 해당 단어를 찾아 매핑
  for (const seg of segments) {
    const idx = seg.text.indexOf(errWord);
    if (idx !== -1) {
      return {
        from: seg.offset + idx,
        to: seg.offset + idx + errWord.length,
      };
    }
  }

  // 매핑 실패 시 전체 문서에서 직접 검색
  const directIdx = doc.indexOf(errWord);
  if (directIdx !== -1) {
    return { from: directIdx, to: directIdx + errWord.length };
  }

  return null;
}

// ── API 호출 ──────────────────────────────────
async function callSpellCheckAPI(text: string): Promise<SpellError[]> {
  try {
    const response = await fetch('/api/spellcheck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) return [];

    const data = await response.json();
    return data.errors || [];
  } catch {
    return [];
  }
}

// ── 메인 맞춤법 검사 함수 ──────────────────────────────────
export async function checkSpelling(doc: string): Promise<Diagnostic[]> {
  const segments = extractNonMathText(doc);
  if (segments.length === 0) return [];

  const plainText = buildPlainText(segments);

  // 검사할 텍스트가 너무 짧으면 건너뛰기
  const trimmed = plainText.trim();
  if (trimmed.length < 2) return [];

  const errors = await callSpellCheckAPI(trimmed);
  if (errors.length === 0) return [];

  const diagnostics: Diagnostic[] = [];

  for (const error of errors) {
    const pos = mapErrorToDocPosition(error, trimmed, segments, doc);
    if (!pos) continue;

    const suggestions = error.candWord
      ? error.candWord.split('|').slice(0, 3).join(', ')
      : '';

    // correctMethod: 1=띄어쓰기(참고), 2=맞춤법/오용어, 3=띄어쓰기(권장), 4+=기타
    const typeLabels: Record<number, string> = {
      1: '띄어쓰기',
      2: '맞춤법',
      3: '띄어쓰기',
      4: '표현 개선',
      5: '문법',
      6: '표준어',
      7: '통계 교정',
    };
    const typeLabel = typeLabels[error.errorType] || '맞춤법';

    diagnostics.push({
      from: pos.from,
      to: pos.to,
      severity: 'info',
      source: 'spelling',
      message: suggestions
        ? `${typeLabel}: "${error.orgStr}" → ${suggestions}`
        : `${typeLabel}: ${error.help || error.orgStr}`,
    });
  }

  return diagnostics;
}
