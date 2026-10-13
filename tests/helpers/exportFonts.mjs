/**
 * Phase 70 테스트 전용 — Noto Serif KR(Regular·Bold)를 `.test-build/fonts/`에 받아 둔다.
 *
 * 글꼴은 레포에 커밋하지 않는다(Q13). 브라우저(70b compile.ts)와 **같은 고정 커밋·같은 SHA-256**을 쓴다
 * (v4 §1-7 L3). 받지 못하면 null — 호출부는 실제 컴파일 검사만 이유를 출력하고 건너뛴다.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const NOTO_COMMIT = '9b0f1436e455d902de067a2501422e5dc71ad16b';
export const NOTO_FILES = {
  'NotoSerifKR-Regular.otf': '5ea012e15cb7eacc1f680aee1703f3b164791b1443ea3e52b65080cca5d179cf',
  'NotoSerifKR-Bold.otf': '263408609ef416d597718ea91055379867d3e7086fa32f049996995d4e715e55',
};
const BASE = `https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@${NOTO_COMMIT}/Serif/SubsetOTF/KR/`;

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

export async function ensureExportFonts() {
  const dir = fileURLToPath(new URL('../../.test-build/fonts/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  for (const [name, hash] of Object.entries(NOTO_FILES)) {
    const file = dir + name;
    if (existsSync(file) && sha256(readFileSync(file)) === hash) continue;
    try {
      const res = await fetch(BASE + name);
      if (!res.ok) return { dir: null, reason: `${name} HTTP ${res.status}` };
      const buf = Buffer.from(await res.arrayBuffer());
      if (sha256(buf) !== hash) return { dir: null, reason: `${name} SHA-256 불일치` };
      writeFileSync(file, buf);
    } catch (e) {
      return { dir: null, reason: `${name} 내려받기 실패(${e?.message ?? e})` };
    }
  }
  return { dir, reason: null };
}
