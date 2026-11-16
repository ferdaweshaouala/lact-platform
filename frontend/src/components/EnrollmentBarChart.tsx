'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export interface EnrollmentChartRow {
  name: string;
  ongoing: number;
  completed: number;
  dropped: number;
}

interface Props {
  data: EnrollmentChartRow[];
  isRtl: boolean;
  labels: { ongoing: string; completed: string; dropped: string };
  /** Card title — only shown when `asCard` is true (default) */
  title?: string;
  /** Wrap in a .card div with title (default: true). Set false for inline use */
  asCard?: boolean;
  /** Bar size cap in px (default: 28) */
  maxBarSize?: number;
  /** Row height in px — height = rows * rowHeight (default: 52) */
  rowHeight?: number;
  /** Minimum chart height in px (default: 160) */
  minHeight?: number;
  /** Show the Recharts Legend (default: true) */
  showLegend?: boolean;
  /** Axis tick font size (default: 11) */
  tickFontSize?: number;
}

export default function EnrollmentBarChart({
  data, isRtl, labels, title,
  asCard = true,
  maxBarSize = 28,
  rowHeight = 52,
  minHeight = 160,
  showLegend = true,
  tickFontSize = 11,
}: Props) {
  if (data.length === 0) return null;

  const r = 4;

  // Round only the TIP end: RIGHT in LTR, LEFT in RTL
  const pill = (x: number, y: number, w: number, h: number) =>
    isRtl
      ? `M${x + r},${y} H${x + w} V${y + h} H${x + r} Q${x},${y + h} ${x},${y + h - r} V${y + r} Q${x},${y} ${x + r},${y} Z`
      : `M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z`;

  const flat = (x: number, y: number, w: number, h: number) =>
    `M${x},${y} H${x + w} V${y + h} H${x} Z`;

  type BarProps = { x: number; y: number; width: number; height: number; fill: string; payload?: { completed?: number; dropped?: number } };

 const OngoingBar = (p: any) => {
  const { x, y, width: w, height: h, fill, payload } = p as BarProps;
  if (!w || h <= 0) return <g />;
  const alone = !((payload?.completed ?? 0) > 0) && !((payload?.dropped ?? 0) > 0);
  return <path d={alone ? pill(x, y, w, h) : flat(x, y, w, h)} fill={fill} />;
};

const CompletedBar = (p: any) => {
  const { x, y, width: w, height: h, fill, payload } = p as BarProps;
  if (!w || h <= 0) return <g />;
  const isLast = !((payload?.dropped ?? 0) > 0);
  return <path d={isLast ? pill(x, y, w, h) : flat(x, y, w, h)} fill={fill} />;
};

const DroppedBar = (p: any) => {
  const { x, y, width: w, height: h, fill } = p as BarProps;
  if (!w || h <= 0) return <g />;
  return <path d={pill(x, y, w, h)} fill={fill} />;
};

  const chartHeight = Math.max(minHeight, data.length * rowHeight);

  const chart = (
    <div dir="ltr">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
          <XAxis type="number" tick={{ fontSize: tickFontSize, fill: 'var(--fg-2)' }} allowDecimals={false} reversed={isRtl} />
          <YAxis type="category" dataKey="name" orientation={isRtl ? 'right' : 'left'} tick={{ fontSize: tickFontSize, fill: 'var(--fg-2)' }} width={110} />
          <Tooltip contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)' }} />
          {showLegend && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 13 }} />}
          <Bar dataKey="ongoing"   name={labels.ongoing}   stackId="a" fill="#0EA5E9" shape={OngoingBar }   maxBarSize={maxBarSize} />
          <Bar dataKey="completed" name={labels.completed} stackId="a" fill="#10B981" shape={CompletedBar } maxBarSize={maxBarSize} />
          <Bar dataKey="dropped"   name={labels.dropped}   stackId="a" fill="#F87171" shape={DroppedBar }   maxBarSize={maxBarSize} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  if (!asCard) return chart;

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      {title && <h2 className="text-fg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{title}</h2>}
      {chart}
    </div>
  );
}
