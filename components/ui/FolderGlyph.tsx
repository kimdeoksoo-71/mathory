'use client';

/**
 * M5 D5 — 폴더 아이콘 렌더 한 벌. 폴더를 그리는 8곳(Sidebar 행·FolderMoveMenu ·
 * ListView 폴더 행 · FolderView 머리·하위 칩 · FolderPathBar · SheetImportModal ·
 * FolderPickerDialog)이 전부 이것을 쓴다 — 삼항식 사본을 만들지 말 것.
 *
 * 규칙은 lib/folderIcon.ts(import 0 · test:foldericon)가 소유한다:
 * - `Folder.icon`이 Phosphor 이름이면 카탈로그 자산(PhAsset · CSS mask · regular),
 *   옛 유니코드 값·빈 값이면 기본 아이콘(인라인 path — 최상위 folder / 하위 folder-simple /
 *   펼침 folder-open).
 * - `expanded`는 Sidebar 행만 넘긴다(다른 자리는 폴더·크기만).
 * - M6 D23 — 활성 bold 도안·`active` prop은 폐기. 활성 강조는 행 배경·글자 700만.
 */

import { Folder } from '../../types/problem';
import { isRoot } from '../../lib/folder-tree';
import { resolveFolderGlyph } from '../../lib/folderIcon';
import { PH } from './phosphorPaths';
import { PhAsset, PhIcon } from './Icons';

const INLINE_KEYS = {
  folder: PH.folder,
  folderSimple: PH.folderSimple,
  folderOpen: PH.folderOpen,
} as const;

export default function FolderGlyph({ folder, size = 14, expanded }: {
  folder: Folder; size?: number; expanded?: boolean;
}) {
  const spec = resolveFolderGlyph({ icon: folder.icon, isRoot: isRoot(folder), expanded });
  if (spec.kind === 'asset') {
    return <PhAsset name={spec.name} size={size} title={folder.name} />;
  }
  return <PhIcon d={INLINE_KEYS[spec.key]} size={size} />;
}
