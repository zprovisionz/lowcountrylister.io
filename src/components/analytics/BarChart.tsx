import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface BarChartProps {
  data: Array<{ [key: string]: string | number }>;
  dataKey: string;
  fillColor?: string;
  showGrid?: boolean;
  height?: number;
}

export default function BarChart({
  data,
  dataKey,
  fillColor = '#ff00ff',
  showGrid = true,
  height = 300
}: BarChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800/95 backdrop-blur-sm border border-[#ff00ff]/30 rounded-lg p-3 shadow-xl">
          <p className="text-gray-300 text-sm mb-1">{label}</p>
          <p className="text-[#ff00ff] font-semibold">
            {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
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
        <Bar
          dataKey={dataKey}
          fill={fillColor}
          radius={[4, 4, 0, 0]}
          style={{
            filter: `drop-shadow(0 0 6px ${fillColor})`,
          }}
        />
      </RechartsBarChart>
    </ResponsiveContainer>
  );
}

