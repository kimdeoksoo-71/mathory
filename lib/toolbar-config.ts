/**
 * lib/toolbar-config.ts — 사용자 수식 툴바 설정 Firestore CRUD (계획서 §5-1)
 *
 * 문서: users/{uid}/toolbar_config/default
 * 기본값(프리셋)은 코드(lib/toolbar-defaults.ts)에 있고, 사용자가 적용/편집한 것만 저장한다.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { ToolbarConfig } from '../types/toolbar-config';

function ref(uid: string) {
  return doc(db, 'users', uid, 'toolbar_config', 'default');
}

/** 저장된 설정 로드. 없으면(미커스터마이징) null → 호출측에서 기본 7탭 폴백. */
export async function getToolbarConfig(uid: string): Promise<ToolbarConfig | null> {
  const snap = await getDoc(ref(uid));
  if (!snap.exists()) return null;
  return snap.data() as ToolbarConfig;
}

export async function saveToolbarConfig(uid: string, config: ToolbarConfig): Promise<void> {
  await setDoc(ref(uid), { ...config, updatedAt: serverTimestamp() });
}
