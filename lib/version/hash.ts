import type { VersionContent } from '../../types/version';
import { canonicalizeTab } from './canonicalize';

/** Phase 55 — SHA-256 (Web Crypto). 브라우저 보안 컨텍스트(localhost/https)에서 동작. */
export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPerTab(content: VersionContent): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const t of content.tabs) out[t.key] = await sha256(canonicalizeTab(t));
  return out;
}
