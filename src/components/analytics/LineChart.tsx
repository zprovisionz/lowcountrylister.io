import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface LineChartProps {
  data: Array<{ [key: string]: string | number }>;
  dataKey: string;
  strokeColor?: string;
  showGrid?: boolean;
  height?: number;
}

export default function LineChart({
  data,
  dataKey,
  strokeColor = '#00f5ff',
  showGrid = true,
  height = 300
}: LineChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800/95 backdrop-blur-sm border border-[#00f5ff]/30 rounded-lg p-3 shadow-xl">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-[#00f5ff] font-semibold">
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsLineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        {showGrid && (
          <CartesianGrid 
            strokeDasharray="3 3" 
            stroke="rgba(107, 114, 128, 0.3)" 
            opacity={0.5}
          />
        )}
        <XAxis 
          dataKey="name" 
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(107, 114, 128, 0.5)' }}
        />
        <YAxis 
          stroke="#9ca3af"
          tick={{ fill: '#9ca3af', fontSize: 12 }}
          axisLine={{ stroke: 'rgba(107, 114, 128, 0.5)' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={strokeColor}
          strokeWidth={2}
          dot={{ fill: strokeColor, r: 4 }}
          activeDot={{ r: 6, fill: strokeColor }}
          style={{
            filter: `drop-shadow(0 0 6px ${strokeColor})`,
          }}
        />
      </RechartsLineChart>
    </ResponsiveContainer>
  );
}

