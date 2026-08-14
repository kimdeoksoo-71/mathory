'use client';

import EditorPreview from '../editor/EditorPreview';
import ChoicesBlock from '../editor/ChoicesBlock';
import { Block } from '../../types/problem';
import { imageTreatmentStyle } from '../../lib/imageTreatment';

const BORDERED_TYPES: Set<string> = new Set(['gana', 'roman', 'box']);

/**
 * 공개 뷰어용 탭 본문 렌더러 (Phase 50 /shared, Phase 51 /p 공통).
 * EditorPreview borderless + ChoicesBlock + 이미지 treatment 패턴.
 */
export default function ProblemTabContent({ blocks }: { blocks: Block[] }) {
  const sorted = [...blocks].sort((a, b) => a.order - b.order);
  return (
    <div>
      {sorted.map((block, i) => {
        const headingTopPad = block.type === 'heading' && i !== 0 ? '1.5em' : undefined;

        if (block.type === 'image') {
          const src = block.raw_text.match(/src="([^"]+)"/)?.[1] || '';
          return (
            <div key={block.id} style={{ textAlign: 'center', margin: '0.8em 0' }}>
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" style={{
                  width: block.imageWidth || 400, maxWidth: '90%', height: 'auto',
                  ...imageTreatmentStyle(block),
                }} />
              ) : (
                <span style={{ color: '#888', fontSize: 12 }}>(이미지 없음)</span>
              )}
            </div>
          );
        }

        if (BORDERED_TYPES.has(block.type)) {
          return (
            <div key={block.id} style={{
              border: '1.5px solid var(--text-muted, #888)',
              borderRadius: 0, padding: '12px 16px', margin: '1.2em 0',
            }}>
              <EditorPreview content={block.raw_text} borderless locale="ko" />
            </div>
          );
        }

        if (block.type === 'callout') {
          /* Phase 57: 강조문 — 테두리 없이 display 수식과 같은 들여쓰기·상하 여백 */
          return (
            <div key={block.id} className="callout-block">
              <EditorPreview content={block.raw_text} borderless locale="ko" />
            </div>
          );
        }

        if (block.type === 'choices') {
          return (
            <div key={block.id}>
              <ChoicesBlock rawText={block.raw_text} locale="ko" />
            </div>
          );
        }

        return (
          <div key={block.id} style={{ paddingTop: headingTopPad }}>
            <EditorPreview content={block.raw_text} borderless locale="ko" />
          </div>
        );
      })}
    </div>
  );
}
