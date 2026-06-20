'use client'

/**
 * Skeleton loading screens.
 * Used while wallet loads, balance fetches, notes hydrate, etc.
 */

function Bone({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-gray-200 rounded-lg animate-pulse ${className}`} />
  )
}

/** Dashboard stats row skeleton */
export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="card p-5 flex flex-col gap-2">
          <Bone className="h-3 w-20" />
          <Bone className="h-7 w-28" />
        </div>
      ))}
    </div>
  )
}

/** Note list skeleton */
export function NoteListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <Bone className="h-4 w-24" />
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Bone className="w-2 h-2 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Bone className="h-4 w-24" />
                <Bone className="h-3 w-36" />
              </div>
            </div>
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Single card skeleton — generic */
export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="card p-6 flex flex-col gap-3">
      <Bone className="h-5 w-40" />
      {[...Array(lines)].map((_, i) => (
        <Bone key={i} className={`h-3 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
      ))}
    </div>
  )
}

/** Full page loading screen */
export function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="mb-8 flex flex-col gap-3">
        <Bone className="h-5 w-24 rounded-full" />
        <Bone className="h-9 w-56" />
        <Bone className="h-4 w-80" />
      </div>
      <StatsSkeleton />
      <NoteListSkeleton rows={4} />
    </div>
  )
}
