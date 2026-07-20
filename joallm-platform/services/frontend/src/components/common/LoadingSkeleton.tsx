import React from 'react';

interface LoadingSkeletonProps {
  variant?: 'text' | 'circle' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
  count?: number;
}

export function LoadingSkeleton({
  variant = 'text',
  width,
  height,
  className = '',
  count = 1,
}: LoadingSkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const variantClasses = {
    text: 'rounded h-4',
    circle: 'rounded-full',
    rectangular: 'rounded-md',
  };

  const style = {
    width: width || (variant === 'circle' ? '40px' : '100%'),
    height: height || (variant === 'text' ? '16px' : variant === 'circle' ? '40px' : '100px'),
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  ));

  return count > 1 ? <div className="space-y-3">{skeletons}</div> : skeletons[0];
}

// Common skeleton patterns
export function ChatMessageSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-start space-x-3">
        <LoadingSkeleton variant="circle" width={32} height={32} />
        <div className="flex-1 space-y-2">
          <LoadingSkeleton width="60%" />
          <LoadingSkeleton width="80%" />
          <LoadingSkeleton width="40%" />
        </div>
      </div>
    </div>
  );
}

export function DocumentListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
          <LoadingSkeleton variant="rectangular" width={40} height={40} />
          <div className="flex-1 space-y-2">
            <LoadingSkeleton width="70%" />
            <LoadingSkeleton width="40%" height={12} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorkflowCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="p-4 border border-gray-200 rounded-lg space-y-3">
          <LoadingSkeleton width="60%" height={20} />
          <LoadingSkeleton count={2} />
          <div className="flex gap-2 pt-2">
            <LoadingSkeleton width={80} height={32} />
            <LoadingSkeleton width={80} height={32} />
          </div>
        </div>
      ))}
    </div>
  );
}


