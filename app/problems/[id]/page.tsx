"use client";

import { useState } from "react";

type Block = {
  id: number;
  type: string;
  content: string;
};

export default function ProblemDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;

  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, type: "Insight", content: "대칭을 의심한다." },
  ]);

  const addBlock = () => {
    const newBlock: Block = {
      id: Date.now(),
      type: "Claim",
      content: "",
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateContent = (blockId: number, value: string) => {
    setBlocks(
      blocks.map((b) =>
        b.id === blockId ? { ...b, content: value } : b
      )
    );
  };

  return (
    <main style={{ padding: 32 }}>
      <a href="/problems">← Back</a>
      <h1>Problem {id}</h1>

      <button onClick={addBlock} style={{ marginBottom: 16 }}>
        + Add Block
      </button>

      {blocks.map((block) => (
        <div
          key={block.id}
          style={{
            border: "1px solid #ddd",
            padding: 12,
            borderRadius: 8,
            marginBottom: 12,
          }}
        >
          <strong>{block.type}</strong>
          <textarea
            value={block.content}
            onChange={(e) => updateContent(block.id, e.target.value)}
            style={{ width: "100%", marginTop: 8 }}
          />
        </div>
      ))}
    </main>
  );
}
