/**
 * Phase 61f — 그림 첨부의 순수 로직 (정밀 검증 · agent 토론 공용).
 *
 * ⚠️ 이 파일에 **import 문을 두지 말 것.** `npm run test:verify`가 tsc로 단독 컴파일한다.
 * ⚠️ 클라이언트(`lib/verifyFlow.ts` · `CommentPanel.tsx`)는 이 파일에서
 *    `FIG_PLACEHOLDER` · `imageSrcOf` · `scanImgTags`만 import한다 —
 *    프롬프트 전문(prompts.ts)이 클라 번들에 실리지 않게 하는 61b 규약과 같은 이유다.
 *
 * ## 슬롯 모델 (계획서 §2-1)
 * - **슬롯** = 최종 프롬프트 문자열에 남은 자리표시자 하나. URL 하나 또는 null(svg·ggb).
 * - **k(그림 번호)는 슬롯 등장 순서로 부여**하되, 같은 URL은 같은 k를 받고 한 번만 내려받는다
 *   (GAS `iv_collectFigRefs_`의 seen[] 등가). null 슬롯은 서로 다른 슬롯이다.
 * - **번호 매기기는 프롬프트 문자열이 확정된 뒤**(자르기 포함) 한 번에 한다(D19).
 *
 * ## 자리표시자가 `[그림]`이 아니라 `⟦그림⟧`인 이유 (구현 확정)
 * 본문에는 `[그림]`·`[그림1]`이 자연 발생한다 — 전처리의 `Fig.N → [그림N]` 변환 산물과
 * "위 [그림] 참조" 류 서술. 토론 경로는 조립된 문자열에서 자리표시자를 **스캔**하므로
 * 자연 문자열과 충돌하면 번호가 밀린다. `⟦⟧`는 이 저장소의 기계 삽입 표식 관례다
 * (proofread `⟦M0⟧` 마스킹 — M1 W2). 모델이 보는 최종형은 계획대로 `[그림 k]`다.
 */

/** 전송용 자리표시자. 렌더(`numberFigures`)가 전부 `[그림 k]` 계열로 바꾼다 — 모델에 새지 않는다. */
export const FIG_PLACEHOLDER = '⟦그림⟧';

/** 요청당 상한 (GAS 패치 13 등가 — 행당 8장·4MB·16MB보다 한 단 보수적) */
export const FIG_LIMITS = {
  maxCount: 6,
  maxBytes: 4 * 1024 * 1024,
  maxTotalBytes: 12 * 1024 * 1024,
} as const;

/** 최소공통분모 — gif는 Gemini inline이 받지 않는다(Claude·OpenAI는 받지만 뺀다).
 *  실전 값은 png·jpeg 둘뿐이다: `uploadImage`가 canvas로 재인코딩한다(webp는 리사이즈 실패 폴백 전용). */
export const FIG_MIME_OK = ['image/png', 'image/jpeg', 'image/webp'] as const;

/** 슬롯 하나의 최종 상태. `k`는 1-based 그림 번호. `reason`은 `ok:false`일 때만 있다.
 *  ⚠ 판별 유니온이 아니라 단일 인터페이스다 — 이 하니스는 tsconfig 없이 tsc를 돌려
 *    strict가 꺼져 있고, 그 모드에서는 `if (s.ok)` 판별 좁히기가 일어나지 않는다. */
export interface SlotStatus { k: number; ok: boolean; reason?: string }

/* ═══ 추출 ═══ */

const IMG_TAG_RE = /<img\b[^>]*>/gi;
const SRC_ATTR_RE = /\bsrc\s*=\s*"([^"]*)"/i;

/** image 블록 raw_text(`<img src="…">`)에서 src 하나를 뽑는다. 없으면 ''. */
export function imageSrcOf(rawText: string): string {
  const tag = String(rawText ?? '').match(IMG_TAG_RE)?.[0] ?? '';
  return tag.match(SRC_ATTR_RE)?.[1]?.trim() ?? '';
}

/** 텍스트 속 `<img src="…">` 태그를 등장 순서로. src가 없는 태그는 그림이 아니므로 건너뛴다. */
export function scanImgTags(text: string): { src: string; index: number; length: number }[] {
  const out: { src: string; index: number; length: number }[] = [];
  const re = new RegExp(IMG_TAG_RE.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text ?? ''))) !== null) {
    const src = m[0].match(SRC_ATTR_RE)?.[1]?.trim();
    if (src) out.push({ src, index: m.index, length: m[0].length });
  }
  return out;
}

/* ═══ D2 화이트리스트 ═══ */

/**
 * 자기 버킷 Firebase Storage 다운로드 URL + `problems/` 경로만 통과.
 *
 * ⚠️ discuss 라우트는 **무인증**이라 이 관문이 SSRF의 유일한 방어다 — 넓히지 말 것.
 *    접두 고정이라 `…googleapis.com.evil.com`·userinfo 트릭(`…com@evil.com`)이 전부 탈락한다.
 *    소문자 비교는 `%2F`/`%2f` 케이스 흡수용이고, 버킷명은 GCS 규약상 항상 소문자다.
 */
export function isOwnStorageUrl(url: string, bucket: string): boolean {
  if (!bucket) return false;
  const prefix = `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/problems%2f`.toLowerCase();
  return String(url ?? '').toLowerCase().startsWith(prefix);
}

/* ═══ 슬롯 계획 ═══ */

export interface SlotPlan {
  /** 슬롯 i → k (1-based). 같은 URL은 첫 등장 슬롯의 k를 공유한다. */
  slotToK: number[];
  /** 내려받을 대상 — 화이트리스트·장수 상한 통과분. **k 오름차순**(= 첨부 순서 = 꼬리말 순서). */
  fetchTargets: { k: number; url: string }[];
  /** fetch 전에 이미 탈락한 k → 사유 (null 슬롯 · 화이트리스트 · 장수 상한) */
  preRejected: Map<number, string>;
  /** 서로 다른 그림 수 = 최대 k */
  figureCount: number;
}

/** k 부여만 따로 — `allMissingFigures`와 규칙이 갈리면 같은 토론에서 모델마다 번호가 다르게 보인다. */
function assignKs(slots: (string | null)[]): { slotToK: number[]; kToUrl: Map<number, string | null> } {
  const slotToK: number[] = [];
  const urlToK = new Map<string, number>();
  const kToUrl = new Map<number, string | null>();
  let nextK = 1;
  for (const s of slots) {
    if (s !== null && urlToK.has(s)) { slotToK.push(urlToK.get(s)!); continue; }
    const k = nextK++;
    if (s !== null) urlToK.set(s, k);
    kToUrl.set(k, s);
    slotToK.push(k);
  }
  return { slotToK, kToUrl };
}

/**
 * 슬롯 배열 → 내려받기 계획.
 *
 * @param priority 슬롯 i의 우선순위(작을수록 먼저 살아남는다). **장수 상한에서만** 쓰인다 —
 *   k(번호)는 언제나 등장 순서다. 토론의 D12(문항 → 현재 메시지 → 히스토리)가 등장 순서
 *   (문항 → 히스토리 → 메시지)와 **다르기 때문에** 축을 분리했다. 생략하면 등장 순서.
 */
export function planSlots(
  slots: (string | null)[],
  bucket: string,
  nullReason: string,
  priority?: number[],
): SlotPlan {
  const { slotToK, kToUrl } = assignKs(slots);
  const preRejected = new Map<number, string>();

  // k별 최선 우선순위 (같은 URL이 여러 슬롯에 있으면 가장 앞선 것)
  const kPri = new Map<number, number>();
  slotToK.forEach((k, i) => {
    const p = priority?.[i] ?? i;
    if (!kPri.has(k) || p < kPri.get(k)!) kPri.set(k, p);
  });

  const candidates: { k: number; url: string }[] = [];
  for (const [k, url] of kToUrl) {
    if (url === null) { preRejected.set(k, nullReason); continue; }
    if (!isOwnStorageUrl(url, bucket)) { preRejected.set(k, '허용되지 않는 그림 주소'); continue; }
    candidates.push({ k, url });
  }

  // 장수 상한: 우선순위로 살아남을 것을 고르고, 첨부 순서 자체는 k 오름차순으로 되돌린다.
  candidates.sort((a, b) => (kPri.get(a.k)! - kPri.get(b.k)!) || (a.k - b.k));
  const kept = candidates.slice(0, FIG_LIMITS.maxCount);
  for (const c of candidates.slice(FIG_LIMITS.maxCount)) {
    preRejected.set(c.k, `요청당 ${FIG_LIMITS.maxCount}장 상한 초과`);
  }
  kept.sort((a, b) => a.k - b.k);

  return { slotToK, fetchTargets: kept, preRejected, figureCount: kToUrl.size };
}

/* ═══ 결과 메타 (fetch 없이도 만들 수 있는 부분) ═══ */

export interface FigMeta {
  /** 첨부에 성공한 그림 번호 — **첨부 순서 그대로**(k 오름차순). 꼬리말이 이 순서를 말한다. */
  attachedKs: number[];
  missing: { k: number; reason: string }[];
  /** 슬롯 i의 최종 상태 — `numberFigures`에 그대로 넣는다. */
  slotStatuses: SlotStatus[];
}

/** k별 결과 → 슬롯별 상태·꼬리말 재료. `fetchFigures`(서버)와 `allMissingFigures`가 공유한다. */
export function buildFigMeta(
  slotToK: number[],
  okKs: number[],
  rejected: Map<number, string>,
): FigMeta {
  const ok = new Set(okKs);
  const missingByK = new Map<number, string>();
  for (const k of new Set(slotToK)) {
    if (!ok.has(k)) missingByK.set(k, rejected.get(k) ?? '첨부 실패');
  }
  return {
    attachedKs: [...ok].sort((a, b) => a - b),
    missing: [...missingByK.entries()].sort((a, b) => a[0] - b[0]).map(([k, reason]) => ({ k, reason })),
    slotStatuses: slotToK.map((k) => (ok.has(k) ? { k, ok: true } : { k, ok: false, reason: missingByK.get(k)! })),
  };
}

/** vision 미지원 provider(D13) 등 — 전 슬롯을 같은 사유로 누락 처리. **k 부여 규칙은 planSlots와 동일**해야
 *  같은 토론에서 모델마다 그림 번호가 어긋나지 않는다(assignKs 공유가 그 보장이다). */
export function allMissingFigures(slots: (string | null)[], reason: string): FigMeta {
  const { slotToK, kToUrl } = assignKs(slots);
  const rejected = new Map<number, string>();
  for (const k of kToUrl.keys()) rejected.set(k, reason);
  return buildFigMeta(slotToK, [], rejected);
}

/* ═══ 렌더 ═══ */

/** i번째 자리표시자를 슬롯 상태대로. statuses가 모자라면 `[그림 — 첨부되지 않음: 참조 없음]` —
 *  전송용 표식(`⟦그림⟧`)은 어떤 경우에도 모델에 새지 않는다. */
export function figureLabel(s: SlotStatus | undefined): string {
  if (!s) return '[그림 — 첨부되지 않음: 참조 없음]';
  if (s.ok) return `[그림 ${s.k}]`;
  return `[그림 ${s.k} — 첨부되지 않음: ${s.reason ?? '첨부 실패'}]`;
}

export function numberFigures(text: string, statuses: SlotStatus[]): string {
  const parts = String(text ?? '').split(FIG_PLACEHOLDER);
  let out = parts[0];
  for (let i = 1; i < parts.length; i++) {
    out += figureLabel(statuses[i - 1]) + parts[i];
  }
  return out;
}

/** 텍스트의 자리표시자 개수 — D19(자르기 뒤 살아남은 슬롯만 유지)의 클라 판정용. */
export function countPlaceholders(text: string): number {
  return String(text ?? '').split(FIG_PLACEHOLDER).length - 1;
}

/** GAS `iv_imageNote_` 이식. 그림이 하나도 없으면 ''(그림 없는 요청 = 프롬프트 불변, D10).
 *  첨부가 k 오름차순이므로 "첨부 순서 = 나열 순서"가 성립한다 — 모델이 k ↔ 이미지를 잇는 유일한 단서다. */
export function buildImageNote(attachedKs: number[], missing: { k: number; reason: string }[]): string {
  if (attachedKs.length === 0 && missing.length === 0) return '';
  const lines: string[] = [];
  if (attachedKs.length > 0) {
    lines.push(`(참고: 이 요청에 이미지 ${attachedKs.length}장이 첨부되어 있습니다 — 첨부 순서대로 ${
      attachedKs.map((k) => `[그림 ${k}]`).join(', ')} 입니다.)`);
  }
  if (missing.length > 0) {
    lines.push(`(첨부되지 않은 그림: ${missing.map((m) => `[그림 ${m.k} — ${m.reason}]`).join(', ')})`);
  }
  return '\n\n' + lines.join('\n');
}
