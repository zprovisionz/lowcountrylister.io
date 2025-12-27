import { ReactNode } from 'react';
import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

interface AlertProps {
  variant: AlertVariant;
  title?: string;
  children: ReactNode;
  onClose?: () => void;
  className?: string;
  showIcon?: boolean;
}

const variantStyles: Record<AlertVariant, { container: string; icon: string; text: string }> = {
  success: {
    container: 'bg-green-500/10 border-green-500/20 text-green-300',
    icon: 'text-green-400',
    text: 'text-green-300',
  },
  error: {
    container: 'bg-red-500/10 border-red-500/20 text-red-300',
    icon: 'text-red-400',
    text: 'text-red-300',
  },
  warning: {
    container: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300',
    icon: 'text-yellow-400',
    text: 'text-yellow-300',
  },
  info: {
    container: 'bg-blue-500/10 border-blue-500/20 text-blue-300',
    icon: 'text-blue-400',
    text: 'text-blue-300',
  },
};

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function Alert({
  variant,
  title,
  children,
  onClose,
  className = '',
  showIcon = true,
}: AlertProps) {
  const styles = variantStyles[variant];
  const Icon = icons[variant];

  return (
    <div
      className={`rounded-lg border p-4 ${styles.container} ${className}`}
      role="alert"
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
    >
      <div className="flex items-start gap-3">
        {showIcon && (
          <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${styles.icon}`} aria-hidden="true" />
        )}
        <div className="flex-1">
          {title && (
            <h4 className={`font-semibold mb-1 ${styles.text}`}>
              {title}
            </h4>
          )}
          <div className={`text-sm ${styles.text}`}>
            {children}
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`flex-shrink-0 p-1 rounded hover:bg-black/10 transition ${styles.text}`}
            aria-label="Close alert"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

