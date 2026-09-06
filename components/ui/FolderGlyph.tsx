'use client';

/**
 * M5 D5 — 폴더 아이콘 렌더 한 벌. 폴더를 그리는 8곳(Sidebar 행·FolderMoveMenu ·
 * ListView 폴더 행 · FolderView 머리·하위 칩 · FolderPathBar · SheetImportModal ·
 * FolderPickerDialog)이 전부 이것을 쓴다 — 삼항식 사본을 만들지 말 것.
 *
 * 규칙은 lib/folderIcon.ts(import 0 · test:foldericon)가 소유한다:
 * - `Folder.icon`이 Phosphor 이름이면 카탈로그 자산(PhAsset · CSS mask · 활성만 bold),
 *   옛 유니코드 값·빈 값이면 기본 아이콘(인라인 path — 최상위 folder / 하위 folder-simple /
 *   펼침 folder-open, 활성이면 bold 도안).
 * - `active`·`expanded`는 Sidebar 행만 넘긴다(다른 자리는 폴더·크기만).
 */

import { Folder } from '../../types/problem';
import { isRoot } from '../../lib/folder-tree';
import { resolveFolderGlyph } from '../../lib/folderIcon';
import { PH } from './phosphorPaths';
import { PhAsset, PhIcon } from './Icons';

const INLINE_KEYS = {
  folder: { regular: PH.folder, bold: PH.folderBold },
  folderSimple: { regular: PH.folderSimple, bold: PH.folderSimpleBold },
  folderOpen: { regular: PH.folderOpen, bold: PH.folderOpenBold },
} as const;

export default function FolderGlyph({ folder, size = 14, active, expanded }: {
  folder: Folder; size?: number; active?: boolean; expanded?: boolean;
}) {
  const spec = resolveFolderGlyph({ icon: folder.icon, isRoot: isRoot(folder), expanded, active });
  if (spec.kind === 'asset') {
    return <PhAsset name={spec.name} weight={spec.weight} size={size} title={folder.name} />;
  }
  return <PhIcon d={INLINE_KEYS[spec.key][spec.bold ? 'bold' : 'regular']} size={size} />;
}
