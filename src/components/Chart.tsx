import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Empty } from './ui';
export default function Chart({
  data,
  label,
  unit = '',
}: {
  data: { date: string; value: number }[];
  label: string;
  unit?: string;
}) {
  if (!data.length)
    return (
      <Empty title="Your progress starts here">
        Complete a session to see {label.toLowerCase()}. Only your saved training appears here.
      </Empty>
    );
  return (
    <div className="chart-wrap">
      <div
        className="chart"
        role="img"
        aria-label={`${label}. ${data.length} records. Latest: ${data.at(-1)?.value.toFixed(1)} ${unit}.`}
      >
        <ResponsiveContainer width="100%" height={220} minWidth={0}>
          <AreaChart data={data} margin={{ top: 15, right: 12, bottom: 5, left: -15 }}>
            <defs>
              <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c8ed93" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#c8ed93" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#343b36" strokeDasharray="3 6" />
            <XAxis
              dataKey="date"
              tickFormatter={(s) => s.slice(5)}
              tick={{ fill: '#a0a7a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={35}
            />
            <YAxis
              tick={{ fill: '#a0a7a3', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={55}
            />
            <Tooltip
              contentStyle={{
                background: '#202623',
                border: '1px solid #46513e',
                borderRadius: 12,
                color: '#f3f6f1',
              }}
              formatter={(value) => [
                `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })} ${unit}`,
                label,
              ]}
            />
            <Area
              type="linear"
              dataKey="value"
              stroke="#c8ed93"
              fill="url(#chartFill)"
              strokeWidth={2}
              dot={{ r: 3, fill: '#c8ed93' }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="chart-table">
        <summary>View chart values</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>
                {label} {unit && `(${unit})`}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={`${d.date}-${i}`}>
                <td>{d.date}</td>
                <td>{d.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
