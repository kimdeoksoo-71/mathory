/**
 * Phase 37: AI 모델 레지스트리
 * Firestore `ai_models` 컬렉션에서 활성화된 AI 모델 목록을 로드/캐시한다.
 *
 * - 컬렉션은 Firestore 콘솔에서 직접 관리 (CRUD UI는 추후 phase)
 * - 앱 시작 후 첫 호출 시 한 번 로드, 이후 메모리 캐시 (페이지 새로고침으로만 갱신)
 */

import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebase';
import type { AIModelConfig } from '../types/problem';
import { priceFor } from './aiPricing';

let cache: AIModelConfig[] | null = null;
let cachePromise: Promise<AIModelConfig[]> | null = null;

function mapDoc(id: string, data: Record<string, unknown>): AIModelConfig {
  return {
    modelId: id,
    displayName: String(data.displayName ?? id),
    nickname: String(data.nickname ?? '?'),
    provider: data.provider as AIModelConfig['provider'],
    apiModelName: String(data.apiModelName ?? id),
    enabled: data.enabled === true,
    maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : 1024,
    appendPrompt: String(data.appendPrompt ?? ''),
    order: typeof data.order === 'number' ? data.order : 999,
    // M5 D15 — 기본값을 ''로: '🤖'를 기본 채움하면 AIBrandIcon의 IconRobot 폴백이
    // 절대 발화하지 않는다(E1). 명시 저장된 avatarEmoji만 이모지로 남는다.
    avatarEmoji: String(data.avatarEmoji ?? ''),
    // M9 D15′ ② — 숫자 문자열(콘솔 입력 실수)은 살리고, 읽을 수 없거나 0이면 코드 표로 대체(warn 1회).
    //   옛 코드는 typeof number가 아니면 조용히 0 → 비용이 $0으로 찍혔다(66a E1/E2와 같은 함정).
    inputCostPerMillion: costField(id, 'inputCostPerMillion', data.inputCostPerMillion, priceFor(String(data.apiModelName ?? id))?.in),
    outputCostPerMillion: costField(id, 'outputCostPerMillion', data.outputCostPerMillion, priceFor(String(data.apiModelName ?? id))?.out),
  };
}

const warnedCost = new Set<string>();
function costField(id: string, field: string, v: unknown, fallback: number | undefined): number {
  const warnOnce = (msg: string) => {
    const k = `${id}:${field}`;
    if (warnedCost.has(k)) return;
    warnedCost.add(k);
    console.warn(`[ai_models] ${id}.${field} ${msg}`);
  };
  if (typeof v === 'number' && v > 0) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) && Number(v) > 0) {
    warnOnce('이 문자열이다 — 숫자로 읽었다(콘솔에서 number로 고칠 것)');
    return Number(v);
  }
  if (fallback !== undefined) {
    warnOnce(`누락·0·형식 오류 → 코드 표(lib/aiPricing) ${fallback} 사용`);
    return fallback;
  }
  if (v !== undefined) warnOnce('누락·형식 오류이고 코드 표에도 없다 → 0');
  return 0;
}

async function loadFromFirestore(): Promise<AIModelConfig[]> {
  const q = query(collection(db, 'ai_models'), orderBy('order', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d.id, d.data()));
}

/** 활성화된 AI 모델 목록 (캐시) */
export async function getEnabledModels(): Promise<AIModelConfig[]> {
  const all = await getAllModels();
  return all.filter((m) => m.enabled);
}

/** M9 D11′ — 이미 로드된 활성 모델을 동기로(없으면 []). 패널 재마운트의 첫 렌더가 AI 이름을 '?'로 그리지 않게 */
export function peekEnabledModels(): AIModelConfig[] {
  return cache ? cache.filter((m) => m.enabled) : [];
}

/** 모든 AI 모델 (캐시, enabled 무관) */
export async function getAllModels(): Promise<AIModelConfig[]> {
  if (cache) return cache;
  if (!cachePromise) {
    cachePromise = loadFromFirestore().then((list) => {
      cache = list;
      return list;
    });
  }
  return cachePromise;
}

/** 특정 모델 설정 조회 (캐시 우선, 미스 시 Firestore 단건 조회) */
export async function getModelConfig(modelId: string): Promise<AIModelConfig | null> {
  if (cache) {
    return cache.find((m) => m.modelId === modelId) ?? null;
  }
  const ref = doc(db, 'ai_models', modelId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return mapDoc(snap.id, snap.data());
}

/** 인간 사용자가 닉네임으로 사용할 수 없는 예약어 목록 */
export async function getReservedNicknames(): Promise<string[]> {
  const all = await getAllModels();
  return all.map((m) => m.nickname.trim()).filter(Boolean);
}

/** 캐시 무효화 (테스트/관리용) */
export function clearAIModelCache(): void {
  cache = null;
  cachePromise = null;
}
