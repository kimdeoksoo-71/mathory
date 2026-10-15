/**
 * Phase 71 T22″ — HWPX 전용 zip. 한글이 저장하는 모양을 따른다(템플릿 실측):
 *   항목 순서는 호출자가 정한다(§1-2: mimetype → version.xml → header → masterpage0 → BinData → section0 → …)
 *   `mimetype`·`version.xml`·그림은 stored, 나머지 deflate · mtime 전부 1980-01-01.
 * ⚠ `assets.zipFiles`(전 항목 level 6 · mtime 현재)를 쓰지 말 것 — mimetype이 압축되면 HWPX 규약 위반, 바이트도 매번 달라진다.
 * ⚠ fflate는 DOS 시각을 **로컬 시각** getter로 만들고 1980 미만이면 예외 → `new Date(1980, 0, 1)`(로컬). `Date.UTC`는 쓰지 말 것.
 */
import { zipSync, strToU8 } from 'fflate';

export const ZIP_MTIME = new Date(1980, 0, 1);

export function isStored(name: string): boolean {
  return name === 'mimetype' || name === 'version.xml' || /\.(png|jpe?g|gif|bmp)$/i.test(name);
}

/** [이름, 내용] 순서대로 — 객체 키 순서에 기대지 않는다 */
export function zipHwpx(entries: [string, Uint8Array | string][]): Uint8Array {
  if (entries[0]?.[0] !== 'mimetype') throw new Error('HWPX zip의 첫 항목은 mimetype이어야 한다');
  const input: Record<string, [Uint8Array, { level: 0 | 6; mtime: Date }]> = {};
  for (const [name, data] of entries) {
    if (name in input) throw new Error(`zip 항목 중복: ${name}`);
    input[name] = [typeof data === 'string' ? strToU8(data) : data, { level: isStored(name) ? 0 : 6, mtime: ZIP_MTIME }];
  }
  return zipSync(input, { mtime: ZIP_MTIME });
}
