/**
 * Phase 28 — OCR(Mathpix) 유틸리티
 *
 * - 클라이언트 파일 검증 / 다운스케일 / data URL 변환
 * - Mathpix `latex_styled` 응답 → mathory 문법($...$, $$...$$)으로 정규화
 * - `autoFixDeterministicIssues`로 중괄호·조사 공백 자동 교정
 */

import { autoFixDeterministicIssues } from './proofread';

export const OCR_MAX_BYTES = 5 * 1024 * 1024;
export const OCR_MAX_DIM = 2000;
export const OCR_ACCEPT = 'image/png,image/jpeg,image/webp';

/**
 * Mathpix 텍스트 인식 언어 힌트.
 * 절대다수 사용자가 한국인이므로 현재는 `['ko']` 기본값.
 * 추후 사용자별 로케일 설정이 생기면 이 상수 대신 설정값을 주입하도록 교체.
 */
export const OCR_LANGUAGES: string[] = ['ko'];

/** 파일 사전 검증. 문제 있으면 오류 메시지, 없으면 null. */
export function validateOcrFile(file: File): string | null {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    return '지원하지 않는 이미지 형식입니다. PNG, JPG, WEBP만 업로드해 주세요.';
  }
  if (file.size > OCR_MAX_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return `이미지 크기는 5MB 이하여야 합니다. (현재 ${mb}MB)`;
  }
  return null;
}

/** 2000px 초과 시 다운스케일한 data URL. 이내면 원본 data URL. */
export async function toDataUrl(file: File): Promise<string> {
  const img = await loadImage(file);
  const max = Math.max(img.width, img.height);
  if (max <= OCR_MAX_DIM) return fileToDataUrl(file);

  const scale = OCR_MAX_DIM / max;
  const dw = Math.round(img.width * scale);
  const dh = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = dw;
  canvas.height = dh;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 컨텍스트 생성 실패');
  ctx.drawImage(img, 0, 0, dw, dh);
  return canvas.toDataURL('image/png');
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result as string);
    fr.onerror = () => reject(new Error('파일 읽기 실패'));
    fr.readAsDataURL(file);
  });
}

/**
 * Mathpix `text` 결과(수식+텍스트 혼합, `$`/`$$` 구분자 포함)를 mathory 문법으로 정규화하고 교정.
 *
 * 1) 예외적으로 남을 수 있는 `\[..\]` / `\(..\)` → `$$..$$` / `$..$` 로 강제 치환
 * 2) 디스플레이 수식 `$$...$$`는 Markdown 블록 수식 렌더링을 위해 항상
 *    `\n\n$$\n<content>\n$$\n\n` 형태로 강제 정규화 (구분자와 내용 사이 개행 필수)
 * 3) `autoFixDeterministicIssues`로 ^/_ 한 글자 중괄호 래핑 + 인라인수식-조사 공백 제거
 */
export function normalizeAndFix(raw: string): string {
  let s = raw.trim();

  s = s.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
  s = s.replace(/\\\(/g, '$').replace(/\\\)/g, '$');

  // $$...$$ 블록을 찾아 앞뒤 개행 + 내부 개행 강제
  s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_m, inner) => {
    return `\n\n$$\n${inner.trim()}\n$$\n\n`;
  });
  // 과도한 연속 개행 축소
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();

  const { fixed } = autoFixDeterministicIssues(s);
  return fixed;
}
