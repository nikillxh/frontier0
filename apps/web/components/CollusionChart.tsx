'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function TooltipCard({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-panel/95 px-3 py-2 text-xs">
      <div className="text-faint">epoch {label}</div>
      <div className="mt-1 text-accent">{payload[0].value}% cabal share</div>
    </div>
  );
}

export function CollusionChart({ series }: { series: number[] }) {
  const data = series.map((v, i) => ({ epoch: i + 1, share: +(v * 100).toFixed(2) }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id="crimsonFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e5484d" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#e5484d" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#322830" strokeDasharray="3 3" />
          <XAxis
            dataKey="epoch"
            stroke="#685c62"
            tick={{ fill: '#998d92', fontSize: 11 }}
            tickLine={false}
          />
          <YAxis
            stroke="#685c62"
            domain={[0, 60]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fill: '#998d92', fontSize: 11 }}
            tickLine={false}
          />
          <Tooltip content={<TooltipCard />} />
          {/* danger zone: a cabal above kappa would be able to capture consensus */}
          <ReferenceArea y1={50} y2={60} fill="#ff9d5c" fillOpacity={0.07} />
          <ReferenceLine
            y={50}
            stroke="#6b4a2a"
            strokeDasharray="4 4"
            label={{ value: 'kappa 50%', fill: '#998d92', fontSize: 10, position: 'insideTopRight' }}
          />
          <Area
            type="monotone"
            dataKey="share"
            stroke="#e5484d"
            strokeWidth={2}
            fill="url(#crimsonFill)"
            dot={{ r: 3, fill: '#e5484d' }}
            activeDot={{ r: 5 }}
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
