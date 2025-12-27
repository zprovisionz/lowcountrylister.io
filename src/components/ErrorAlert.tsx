import { ReactNode } from 'react';
import Alert from './ui/Alert';
import Button from './ui/Button';
import { AlertCircle } from 'lucide-react';

interface ErrorAlertProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export default function ErrorAlert({
  title,
  message,
  onRetry,
  onDismiss,
  className = '',
}: ErrorAlertProps) {
  return (
    <div className={className}>
      <Alert
        variant="error"
        title={title || 'Error'}
        onClose={onDismiss}
      >
        <div className="space-y-3">
          <p>{message}</p>
          {onRetry && (
            <Button
              variant="primary"
              size="sm"
              onClick={onRetry}
              icon={<AlertCircle className="w-4 h-4" />}
              iconPosition="left"
            >
              Try Again
            </Button>
          )}
        </div>
      </Alert>
    </div>
  );
}

