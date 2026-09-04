/**
 * Phase 61f — Storage 그림을 받아 base64 이미지 파트로 (서버 전용).
 *
 * `/api/verify`와 `/api/discuss` **두 라우트가 이 한 함수를 쓴다** — 갈리면 검증과 토론의
 * 그림 계약(k 번호·누락 사유·상한)이 서로 어긋난다.
 *
 * ⚠️ `lib/verify/` 밖에 두는 이유: `fetch`·`AbortSignal`을 쓰므로 import 0 tsc 하니스에
 *    넣을 수 없다(61b `verifyFlow`·61d `batchVerify`와 같은 규약). 순수 판정(화이트리스트·
 *    슬롯 계획·번호)은 전부 `lib/verify/figures.ts`에 있고 그쪽이 테스트를 받는다.
 *
 * ⚠️ **어떤 실패도 던지지 않는다**(D6) — 항목별 `{ok:false, reason}`으로 돌려주고 호출부는
 *    텍스트만으로 계속한다. Storage 일시 장애가 일괄 검증 전건·토론 전 모델을 죽이면 안 된다.
 *
 * ⚠️ 크로스 요청 캐시를 두지 말 것(D18) — 토론은 모델 수만큼 별도 요청이라 같은 그림을
 *    여러 번 받지만, 람다 인스턴스가 갈리면 적중률이 낮고 신선도·메모리 위험 대비 이득이 작다.
 */

import { FIG_LIMITS, FIG_MIME_OK, planSlots, buildFigMeta, type FigMeta } from './verify/figures';
import type { ImagePart } from './verify/providerParams';

export interface FigureSet extends FigMeta {
  /** k 오름차순 — `buildImageNote`의 "첨부 순서 = 그림 번호 순" 약속이 이 정렬이다. */
  parts: ImagePart[];
}

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchFigures(
  slots: (string | null)[],
  bucket: string,
  nullReason = 'SVG/GeoGebra',
  priority?: number[],
): Promise<FigureSet> {
  const plan = planSlots(slots, bucket, nullReason, priority);

  const outcomes = await Promise.all(plan.fetchTargets.map(async (t) => {
    try {
      const res = await fetch(t.url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), cache: 'no-store' });
      if (!res.ok) return { k: t.k, reason: `받지 못했습니다 (HTTP ${res.status})` };
      // `image/jpeg; charset=…` 류 꼬리는 떼고 본다. 실전 값은 png/jpeg 둘뿐이다(uploadImage가 재인코딩).
      const mime = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
      if (!(FIG_MIME_OK as readonly string[]).includes(mime)) {
        return { k: t.k, reason: `지원되지 않는 형식(${mime || '알 수 없음'})` };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > FIG_LIMITS.maxBytes) {
        return { k: t.k, reason: `장당 ${Math.floor(FIG_LIMITS.maxBytes / 1024 / 1024)}MB 초과` };
      }
      return { k: t.k, size: buf.byteLength, part: { mimeType: mime, data: Buffer.from(buf).toString('base64') } };
    } catch {
      return { k: t.k, reason: '받는 중 오류(시간 초과 포함)' };
    }
  }));

  // 합계 상한은 k 오름차순으로 결정적이게 적용한다 (fetchTargets가 이미 k 오름차순)
  const rejected = new Map(plan.preRejected);
  const okKs: number[] = [];
  const parts: ImagePart[] = [];
  let total = 0;
  for (const o of outcomes) {
    if (!o.part) { rejected.set(o.k, o.reason ?? '첨부 실패'); continue; }
    if (total + (o.size ?? 0) > FIG_LIMITS.maxTotalBytes) { rejected.set(o.k, '요청 용량 한도 초과'); continue; }
    total += o.size ?? 0;
    okKs.push(o.k);
    parts.push(o.part);
  }

  return { ...buildFigMeta(plan.slotToK, okKs, rejected), parts };
}
