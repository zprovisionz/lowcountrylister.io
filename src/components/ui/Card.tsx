import { ReactNode, HTMLAttributes } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'neon-cyan' | 'neon-magenta' | 'glass';
  hover?: boolean;
  className?: string;
}

const variantStyles = {
  default: 'bg-gray-800/50 border border-gray-700/50',
  'neon-cyan': 'bg-gray-800/50 border border-[#00f5ff]/30 neon-card-hover',
  'neon-magenta': 'bg-gray-800/50 border border-[#ff00ff]/30 hover:border-[#ff00ff]/50 hover:shadow-[0_0_20px_rgba(255,0,255,0.4)]',
  glass: 'glass',
};

export default function Card({
  children,
  variant = 'default',
  hover = false,
  className = '',
  ...props
}: CardProps) {
  const baseStyles = 'rounded-xl p-6 backdrop-blur-sm transition-all duration-300';
  const hoverStyle = hover ? 'card-hover' : '';
  const variantStyle = variantStyles[variant];
  
  return (
    <div
      className={`${baseStyles} ${variantStyle} ${hoverStyle} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

