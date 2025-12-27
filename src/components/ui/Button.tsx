import { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-600/50',
  secondary: 'bg-gray-700 text-white hover:bg-gray-600 focus:ring-gray-500 disabled:bg-gray-700/50',
  tertiary: 'bg-gray-800/50 text-gray-300 hover:bg-gray-800 border border-gray-600 hover:border-gray-500 focus:ring-gray-500 disabled:border-gray-700',
  ghost: 'text-gray-300 hover:text-white hover:bg-gray-800/50 focus:ring-gray-500 disabled:text-gray-600',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:bg-red-600/50',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-base',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  children,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50 min-h-[44px]';
  
  const widthStyle = fullWidth ? 'w-full' : '';
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  
  // For gradient primary buttons, use gradient instead of solid
  const gradientOverride = variant === 'primary' && className.includes('gradient') 
    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' 
    : '';

  return (
    <button
      type={props.type || 'button'}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${variantStyle} ${sizeStyle} ${widthStyle} ${gradientOverride} ${className}`}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />}
      {!isLoading && icon && iconPosition === 'left' && <span aria-hidden="true">{icon}</span>}
      <span>{children}</span>
      {!isLoading && icon && iconPosition === 'right' && <span aria-hidden="true">{icon}</span>}
    </button>
  );
}

