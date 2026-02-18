"use client";

import { useMemo, useState } from "react";

const BLOCK_TYPES = ["Insight", "Strategy", "Trap", "Claim", "Derive", "Conclude"] as const;
type BlockType = (typeof BLOCK_TYPES)[number];

type Block = {
  id: number;
  type: BlockType;
  content: string;
};

export default function ProblemDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, type: "Insight", content: "대칭을 의심한다." },
    { id: 2, type: "Claim", content: "어떤 성질을 보이자." },
  ]);

  const canMoveUp = useMemo(
    () => new Set(blocks.slice(1).map((b) => b.id)),
    [blocks]
  );
  const canMoveDown = useMemo(
    () => new Set(blocks.slice(0, -1).map((b) => b.id)),
    [blocks]
  );

  const addBlock = () => {
    const newBlock: Block = {
      id: Date.now(),
      type: "Claim",
      content: "",
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const updateType = (blockId: number, type: BlockType) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, type } : b)));
  };

  const updateContent = (blockId: number, content: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? { ...b, content } : b)));
  };

  const removeBlock = (blockId: number) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  const moveBlock = (blockId: number, dir: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === blockId);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };

  return (
    <main style={{ padding: 32, maxWidth: 900, margin: "0 auto" }}>
      <a href="/problems">← Back</a>
      <h1 style={{ marginTop: 12 }}>Problem {id}</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={addBlock}>+ Add Block</button>
        <a href="/" style={{ alignSelf: "center" }}>Home</a>
      </div>

      {blocks.map((block) => (
        <div
          key={block.id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <select
              value={block.type}
              onChange={(e) => updateType(block.id, e.target.value as BlockType)}
            >
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button
                onClick={() => moveBlock(block.id, -1)}
                disabled={!canMoveUp.has(block.id)}
                title="Move up"
              >
                ↑
              </button>
              <button
                onClick={() => moveBlock(block.id, 1)}
                disabled={!canMoveDown.has(block.id)}
                title="Move down"
              >
                ↓
              </button>
              <button onClick={() => removeBlock(block.id)} title="Delete">
                Delete
              </button>
            </div>
          </div>

          <textarea
            value={block.content}
            onChange={(e) => updateContent(block.id, e.target.value)}
            placeholder="Markdown + LaTeX 입력…"
            style={{
              width: "100%",
              marginTop: 10,
              minHeight: 80,
              padding: 10,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          />
        </div>
      ))}
    </main>
  );
}
