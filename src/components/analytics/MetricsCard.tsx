import { ReactNode } from 'react';
import Card from '../ui/Card';

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  variant?: 'default' | 'neon-cyan' | 'neon-magenta';
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
}

export default function MetricsCard({
  title,
  value,
  subtitle,
  icon,
  variant = 'default',
  trend
}: MetricsCardProps) {
  const variantColors = {
    default: 'text-blue-400',
    'neon-cyan': 'text-[#00f5ff]',
    'neon-magenta': 'text-[#ff00ff]'
  };

  return (
    <Card variant={variant} hover>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${variantColors[variant]}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {trend && (
              <span className={`text-sm ${trend.positive !== false ? 'text-green-400' : 'text-red-400'}`}>
                {trend.positive !== false ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className="text-xs text-gray-500 mt-1">{trend.label}</p>
          )}
        </div>
        {icon && (
          <div className={`${variantColors[variant]} opacity-70`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

