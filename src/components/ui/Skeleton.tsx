interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'button' | 'card' | 'circle' | 'custom';
  width?: string | number;
  height?: string | number;
}

export default function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-4 w-full',
    title: 'h-6 w-3/5',
    button: 'h-10 w-28',
    card: 'h-48 w-full',
    circle: 'h-12 w-12 rounded-full',
    custom: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`skeleton ${variantClasses[variant]} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton layouts for common use cases
export function SkeletonCard() {
  return (
    <div className="glass rounded-xl p-6 space-y-4">
      <Skeleton variant="title" />
      <Skeleton />
      <Skeleton width="80%" />
      <div className="flex gap-2">
        <Skeleton variant="button" />
        <Skeleton variant="button" />
      </div>
    </div>
  );
}

export function SkeletonDescription() {
  return (
    <div className="space-y-3">
      <Skeleton />
      <Skeleton width="95%" />
      <Skeleton width="88%" />
      <Skeleton />
      <Skeleton width="72%" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton variant="circle" width={32} height={32} />
          <Skeleton width={60} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
