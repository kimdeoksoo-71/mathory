'use client';

/**
 * SymbolSettingsModal — 수식 기호 설정 모달 (계획서 §2~3)
 *
 * 이번 단계: 1단계(프리셋 선택)만. 2단계(세부 편집: 그룹/카탈로그)는 후속.
 * 로그인 필요(Firestore 저장). 비로그인 시 안내.
 */

import { useEffect } from 'react';
import { PRESETS, buildPresetConfig, presetPreviewIds } from '../../../lib/toolbar-defaults';
import { symbolPreviewHtml } from '../../../lib/katex-render';
import { ALL_SYMBOLS } from '../../../lib/math-symbols';
import type { PresetId, ToolbarConfig } from '../../../types/toolbar-config';

interface Props {
  open: boolean;
  onClose: () => void;
  isLoggedIn: boolean;
  config: ToolbarConfig | null;
  onApplyPreset: (presetId: PresetId) => Promise<void> | void;
}

const byId = new Map(ALL_SYMBOLS.map((s) => [s.id, s]));

function previewHtml(presetId: PresetId): string {
  return presetPreviewIds(presetId, 8)
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((s) => symbolPreviewHtml(s!))
    .join('<span style="opacity:.3;margin:0 2px"> </span>');
}

export default function SymbolSettingsModal({ open, onClose, isLoggedIn, config, onApplyPreset }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 100%)', maxHeight: '85vh', overflowY: 'auto',
          background: '#fff', borderRadius: 12, padding: 20,
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
          fontFamily: 'var(--font-ui, sans-serif)',
        }}
      >
        {/* 헤더 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>수식 기호 설정</h2>
          <div style={{ flex: 1 }} />
          <button
            type="button" onClick={onClose} aria-label="닫기"
            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: '#888', lineHeight: 1 }}
          >×</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: '#777' }}>
          프리셋을 고르면 학습 단계에 맞는 기호 그룹이 즉시 적용됩니다.
        </p>

        {!isLoggedIn ? (
          <div style={{
            padding: '28px 16px', textAlign: 'center', color: '#666', fontSize: 14,
            background: '#faf9f7', borderRadius: 8, border: '1px dashed #e0ddd7',
          }}>
            기호 커스터마이징은 <b>로그인</b> 후 이용할 수 있습니다.<br />
            <span style={{ fontSize: 12, color: '#999' }}>로그인하면 프리셋·그룹 설정이 계정에 저장됩니다.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PRESETS.map((p) => {
              const count = buildPresetConfig(p.id).groups.reduce((n, g) => n + g.symbolIds.length, 0);
              const current = config?.preset === p.id;
              return (
                <div
                  key={p.id}
                  style={{
                    border: current ? '1.5px solid #B8845C' : '1px solid #e5e2dc',
                    borderRadius: 10, padding: '12px 14px',
                    background: current ? 'rgba(184,132,92,0.06)' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</span>
                    {current && (
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: '#fff', background: '#B8845C',
                        borderRadius: 10, padding: '1px 8px',
                      }}>현재</span>
                    )}
                    <span style={{ fontSize: 12, color: '#aaa' }}>{count}개 기호</span>
                    <div style={{ flex: 1 }} />
                    <button
                      type="button"
                      onClick={() => { void Promise.resolve(onApplyPreset(p.id)).then(onClose); }}
                      style={{
                        padding: '5px 12px', borderRadius: 6, border: 'none',
                        background: '#B8845C', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {current ? '다시 적용' : '이 프리셋으로 설정'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>{p.desc}</div>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 16, color: '#333', flexWrap: 'wrap' }}
                    dangerouslySetInnerHTML={{ __html: previewHtml(p.id) }}
                  />
                </div>
              );
            })}

            <div style={{
              marginTop: 6, paddingTop: 12, borderTop: '1px solid #eee',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <button
                type="button" disabled
                title="다음 업데이트에서 제공됩니다"
                style={{
                  padding: '6px 12px', borderRadius: 6, border: '1px solid #e0ddd7',
                  background: '#f5f3f0', color: '#bbb', fontSize: 12, cursor: 'not-allowed',
                }}
              >
                직접 편집 →
              </button>
              <span style={{ fontSize: 11, color: '#aaa' }}>그룹·기호 세부 편집은 준비 중입니다.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
