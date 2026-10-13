/**
 * Phase 70 §3-5 · E9 — Overleaf에서 열기.
 *
 * Overleaf `/docs`는 `snip_uri`에 **data URL(base64)** 을 받고, 그것이 zip이면 여러 파일을 한 번에 연다
 * (overleaf.com/devs 원문 — v2·v3 확인). 그래서 그림 유무와 관계없이 **항상 zip 한 갈래**다:
 * main.tex + figures/. Storage URL을 넘기지 않으므로 svg 래스터·토큰 만료·외부 URL 문제가 없다.
 *
 * ⚠ 브라우저 전용. 새 탭으로 폼을 POST한다. 그림을 받는 동안(await) 클릭의 사용자 활성이 끊겨 팝업이 막힐 수 있다 →
 *   클릭 처리기에서 **먼저** `reserveOverleafWindow()`로 빈 창을 열고, 준비가 끝나면 그 창 이름으로 POST한다.
 * ⚠ 크기 상한은 문서에 없다(페이지 설정의 maxUploadSize 50MB만 보인다) — P0-5에서 확인.
 */

export const OVERLEAF_DOCS_URL = 'https://www.overleaf.com/docs';

/** 큰 바이트 배열 → base64 (String.fromCharCode 인자 한도를 피해 조각으로) */
export function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)));
  }
  return btoa(bin);
}

export const OVERLEAF_WINDOW = 'mathory-overleaf';

/** 클릭 처리기 안에서 동기로 부른다 — 팝업이 막히면 null(그때는 _blank로 시도) */
export function reserveOverleafWindow(): Window | null {
  try {
    return window.open('about:blank', OVERLEAF_WINDOW);
  } catch {
    return null;
  }
}

export function openInOverleaf(zipBytes: Uint8Array, target: string = '_blank'): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = OVERLEAF_DOCS_URL;
  form.target = target;
  form.style.display = 'none';
  const field = (name: string, value: string) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  };
  field('snip_uri', `data:application/zip;base64,${toBase64(zipBytes)}`);
  field('engine', 'xelatex');
  field('main_document', 'main.tex');
  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}
