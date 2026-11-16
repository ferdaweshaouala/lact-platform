"use client";

function Block({ w, h, r = 6 }: { w?: string | number; h: number; r?: number }) {
  return <div className="sk" style={{ width: w ?? "100%", height: h, borderRadius: r, flexShrink: 0 }} />;
}

export function SkeletonKPIs({ count = 4, cols }: { count?: number; cols?: number }) {
  const c = cols ?? count;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${c}, 1fr)`, gap: 16, marginBottom: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
          <Block h={11} w="55%" />
          <div style={{ marginTop: 14 }}><Block h={34} w="45%" r={4} /></div>
          <div style={{ marginTop: 8 }}><Block h={10} w="50%" /></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  const widths = ["70%", "80%", "50%", "40%", "35%", "60%"];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        {Array.from({ length: cols }).map((_, i) => <Block key={i} h={10} w="55%" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12, padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
          {Array.from({ length: cols }).map((_, c) => (
            <Block key={c} h={14} w={widths[(r + c) % widths.length]} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ lines = 4, header = true }: { lines?: number; header?: boolean }) {
  const lineWidths = ["40%", "70%", "55%", "80%", "60%"];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 16, padding: 24 }}>
      {header && (
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <Block h={16} w="35%" r={6} />
          <Block h={14} w="15%" r={6} />
        </div>
      )}
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} style={{ padding: "12px 0", borderBottom: i < lines - 1 ? "1px solid var(--border-soft)" : "none" }}>
          <Block h={13} w={lineWidths[i % lineWidths.length]} />
          <div style={{ marginTop: 6 }}><Block h={10} w="30%" /></div>
        </div>
      ))}
    </div>
  );
}
