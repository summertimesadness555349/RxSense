export function SkeletonLine({ width = 'w-full', height = 'h-4' }) {
  return (
    <div className={`${width} ${height} bg-gray-200 dark:bg-gray-800 rounded animate-pulse`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
      <SkeletonLine width="w-1/3" height="h-5" />
      <SkeletonLine />
      <SkeletonLine width="w-4/5" />
      <SkeletonLine width="w-2/3" />
    </div>
  );
}

export function SkeletonTable({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          <SkeletonLine width="w-1/4" />
          <SkeletonLine width="w-1/4" />
          <SkeletonLine width="w-1/4" />
          <SkeletonLine width="w-1/4" />
        </div>
      ))}
    </div>
  );
}

export default function LoadingSkeleton({ type = 'card', count = 1 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
