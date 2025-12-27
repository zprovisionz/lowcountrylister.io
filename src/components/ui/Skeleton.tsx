interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string;
  height?: string;
}

export default function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const baseStyles = 'animate-pulse bg-gray-700/50 rounded';
  
  const variantStyles = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-lg',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton components for common use cases
export function SkeletonCard() {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-2xl p-6 space-y-4">
      <Skeleton variant="rectangular" height="24px" width="60%" />
      <Skeleton variant="text" width="100%" />
      <Skeleton variant="text" width="80%" />
      <Skeleton variant="rectangular" height="40px" width="120px" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4">
          <div className="flex items-start gap-4">
            <Skeleton variant="rectangular" width="120px" height="120px" className="rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton variant="rectangular" height="20px" width="40%" />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="70%" />
              <div className="flex gap-2 mt-4">
                <Skeleton variant="rectangular" height="32px" width="80px" />
                <Skeleton variant="rectangular" height="32px" width="80px" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

