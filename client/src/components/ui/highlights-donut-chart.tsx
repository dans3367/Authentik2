import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-xl px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{payload[0].name}</p>
        <p className="text-muted-foreground">{payload[0].value.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

interface DonutChartProps {
  chartData: { name: string; value: number; color: string }[];
  totalValue: number;
}

const EMPTY_DATA = [{ name: "empty", value: 1, color: "hsl(var(--muted))" }];

export default function HighlightsDonutChart({ chartData, totalValue }: DonutChartProps) {
  const hasData = totalValue > 0;
  const activeData = hasData ? chartData.filter((d) => d.value > 0) : EMPTY_DATA;

  return (
    <div className="relative flex items-center justify-center">
      <div className="w-40 h-40 relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={activeData}
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={72}
              paddingAngle={hasData ? 3 : 0}
              dataKey="value"
              strokeWidth={0}
              isAnimationActive={hasData}
              activeIndex={-1}
              style={{ cursor: "default", outline: "none" }}
            >
              {activeData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} opacity={hasData ? 0.85 : 0.3} />
              ))}
            </Pie>
            {hasData && <Tooltip content={<CustomTooltip />} />}
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-0">
        <span className="text-2xl font-extrabold tracking-tight leading-none">
          {totalValue.toLocaleString()}
        </span>
        <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider mt-0.5">
          Total
        </span>
      </div>
    </div>
  );
}
