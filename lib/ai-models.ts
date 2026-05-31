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
    avatarEmoji: String(data.avatarEmoji ?? '🤖'),
    inputCostPerMillion:
      typeof data.inputCostPerMillion === 'number' ? data.inputCostPerMillion : 0,
    outputCostPerMillion:
      typeof data.outputCostPerMillion === 'number' ? data.outputCostPerMillion : 0,
  };
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
