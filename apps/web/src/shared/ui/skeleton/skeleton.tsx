import './skeleton.scss';

interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect';
  lines?: number;
}

export function Skeleton({ variant = 'text', lines = 1 }: SkeletonProps) {
  if (variant === 'text') {
    return (
      <div className="skeleton-group" aria-hidden="true">
        {Array.from({ length: lines }, (_, index) => (
          <span key={index} className="skeleton skeleton--text" />
        ))}
      </div>
    );
  }
  return (
    <span className={`skeleton skeleton--${variant}`} aria-hidden="true" />
  );
}
