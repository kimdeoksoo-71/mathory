'use client';

/**
 * UserGroupEditor — 2단계 좌측: 내 기호 그룹 (계획서 §4-3)
 *
 * 그룹 선택(카탈로그 추가 대상) · 추가(최대 12) · 이름변경 · 삭제(+Undo 5초) · ▲▼ 정렬 · 기호 × 제거.
 * 모든 변경은 onChange(next config)로 상위(draft)에 반영.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import SymbolCell from './SymbolCell';
import { ALL_SYMBOLS } from '../../../lib/math-symbols';
import type { ToolbarConfig, ToolbarGroup, MathSymbol } from '../../../types/toolbar-config';

const MAX_GROUPS = 12;
const byId = new Map<number, MathSymbol>(ALL_SYMBOLS.map((s) => [s.id, s]));

// 드래그 가능한 기호 셀
function SortableSymbol({ id, sym, onRemove }: { id: string; sym: MathSymbol; onRemove: (s: MathSymbol) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <SymbolCell sym={sym} onRemove={onRemove} />
    </div>
  );
}

interface Props {
  config: ToolbarConfig;
  selectedGroupId: string | null;
  onSelectGroup: (id: string) => void;
  onChange: (next: ToolbarConfig) => void;
}

function reorder(groups: ToolbarGroup[]): ToolbarGroup[] {
  return groups.map((g, i) => ({ ...g, order: i }));
}

export default function UserGroupEditor({ config, selectedGroupId, onSelectGroup, onChange }: Props) {
  const groups = useMemo(() => config.groups.slice().sort((a, b) => a.order - b.order), [config.groups]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleted, setDeleted] = useState<{ group: ToolbarGroup; index: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  const setGroups = (next: ToolbarGroup[]) => onChange({ ...config, groups: reorder(next), preset: null });

  const addGroup = () => {
    if (groups.length >= MAX_GROUPS) return;
    const id = `g_c_${Date.now()}`;
    setGroups([...groups, { id, name: '새 그룹', order: groups.length, symbolIds: [] }]);
    onSelectGroup(id);
    setEditingId(id);
    setEditingName('새 그룹');
  };

  const commitRename = () => {
    if (!editingId) return;
    const name = editingName.trim() || '새 그룹';
    setGroups(groups.map((g) => (g.id === editingId ? { ...g, name } : g)));
    setEditingId(null);
  };

  const deleteGroup = (g: ToolbarGroup) => {
    const index = groups.findIndex((x) => x.id === g.id);
    setGroups(groups.filter((x) => x.id !== g.id));
    setDeleted({ group: g, index });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setDeleted(null), 5000);
  };

  const undoDelete = () => {
    if (!deleted) return;
    const next = groups.slice();
    next.splice(Math.min(deleted.index, next.length), 0, deleted.group);
    setGroups(next);
    setDeleted(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= groups.length) return;
    const next = groups.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setGroups(next);
  };

  const removeSymbol = (groupId: string, symId: number) => {
    setGroups(groups.map((g) => (g.id === groupId ? { ...g, symbolIds: g.symbolIds.filter((id) => id !== symId) } : g)));
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleSymbolDragEnd = (groupId: string, e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const g = groups.find((x) => x.id === groupId);
    if (!g) return;
    const oldIndex = g.symbolIds.findIndex((id) => String(id) === active.id);
    const newIndex = g.symbolIds.findIndex((id) => String(id) === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const symbolIds = arrayMove(g.symbolIds, oldIndex, newIndex);
    setGroups(groups.map((x) => (x.id === groupId ? { ...x, symbolIds } : x)));
  };

  const iconBtn: React.CSSProperties = {
    width: 22, height: 22, border: '1px solid #e5e5e5', borderRadius: 4, background: '#fff',
    cursor: 'pointer', fontSize: 11, lineHeight: 1, color: '#666', padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
        {groups.map((g, i) => {
          const selected = g.id === selectedGroupId;
          return (
            <div
              key={g.id}
              onClick={() => onSelectGroup(g.id)}
              style={{
                border: selected ? '1.5px solid #6366f1' : '1px solid #e5e2dc',
                background: selected ? 'rgba(99,102,241,0.05)' : '#fff',
                borderRadius: 8, padding: 8, marginBottom: 8, cursor: 'pointer',
              }}
            >
              {/* 헤더 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                {editingId === g.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingId(null); }}
                    style={{ flex: 1, height: 24, padding: '0 6px', fontSize: 13, border: '1px solid #c7d2fe', borderRadius: 4, outline: 'none' }}
                  />
                ) : (
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#333', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.name} <span style={{ color: '#bbb', fontWeight: 400 }}>{g.symbolIds.length}</span>
                  </span>
                )}
                <button type="button" title="위로" style={iconBtn} onClick={(e) => { e.stopPropagation(); move(i, -1); }} disabled={i === 0}>▲</button>
                <button type="button" title="아래로" style={iconBtn} onClick={(e) => { e.stopPropagation(); move(i, 1); }} disabled={i === groups.length - 1}>▼</button>
                <button type="button" title="이름 변경" style={iconBtn} onClick={(e) => { e.stopPropagation(); setEditingId(g.id); setEditingName(g.name); }}>✎</button>
                <button type="button" title="그룹 삭제" style={{ ...iconBtn, color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); deleteGroup(g); }}>×</button>
              </div>

              {/* 기호 그리드 */}
              {g.symbolIds.length === 0 ? (
                <div style={{ fontSize: 11, color: '#bbb', padding: '6px 2px' }}>
                  오른쪽 카탈로그에서 기호를 클릭해 추가하세요.
                </div>
              ) : (
                <div onClick={(e) => e.stopPropagation()}>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleSymbolDragEnd(g.id, e)}>
                    <SortableContext items={g.symbolIds.map(String)} strategy={rectSortingStrategy}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 40px)', gap: 6 }}>
                        {g.symbolIds.map((id) => {
                          const sym = byId.get(id);
                          if (!sym) return null;
                          return <SortableSymbol key={id} id={String(id)} sym={sym} onRemove={(s) => removeSymbol(g.id, s.id)} />;
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={addGroup}
          disabled={groups.length >= MAX_GROUPS}
          style={{
            width: '100%', height: 34, marginTop: 2,
            border: '1px dashed #cbd5e1', borderRadius: 8, background: '#fafafa',
            cursor: groups.length >= MAX_GROUPS ? 'not-allowed' : 'pointer',
            color: groups.length >= MAX_GROUPS ? '#ccc' : '#555', fontSize: 13,
          }}
        >
          + 그룹 추가 {groups.length >= MAX_GROUPS && '(최대 12)'}
        </button>
      </div>

      {/* Undo 토스트 */}
      {deleted && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
          padding: '8px 12px', background: '#1f2937', color: '#fff', borderRadius: 8, fontSize: 12,
        }}>
          <span style={{ flex: 1 }}>'{deleted.group.name}' 그룹 삭제됨</span>
          <button type="button" onClick={undoDelete} style={{ border: 'none', background: 'none', color: '#93c5fd', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            실행취소
          </button>
        </div>
      )}
    </div>
  );
}
