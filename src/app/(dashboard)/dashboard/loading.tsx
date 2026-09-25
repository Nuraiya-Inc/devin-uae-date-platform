/**
 * Dashboard loading skeleton.
 *
 * Shape mirrors the real dashboard so the transition feels seamless:
 * welcome banner → stat strip → 2-column main area → secondary strip.
 * Renders automatically while server components fetch (Next.js convention).
 */

import Skeleton from '@/components/Skeleton';

export default function DashboardLoading() {
  return (
    <div>
      {/* Welcome */}
      <div className="mb-8 space-y-3">
        <Skeleton w="w-72" h="h-8" />
        <Skeleton w="w-96" h="h-4" />
      </div>

      {/* This-week wins strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border border-line space-y-3">
            <Skeleton w="w-12" h="h-8" />
            <Skeleton w="w-24" h="h-3" />
            <Skeleton w="w-16" h="h-2.5" />
          </div>
        ))}
      </div>

      {/* Two-column: recent wins + velocity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        <section className="lg:col-span-2 bg-white rounded-xl shadow-card border border-line p-6 space-y-3">
          <Skeleton w="w-40" h="h-5" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-start py-1">
              <Skeleton w="w-6" h="h-6" rounded="rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton w="w-3/4" h="h-3.5" />
                <Skeleton w="w-1/2" h="h-2.5" />
              </div>
            </div>
          ))}
        </section>

        <section className="bg-white rounded-xl shadow-card border border-line p-6 space-y-4">
          <Skeleton w="w-36" h="h-5" />
          <Skeleton w="w-20" h="h-8" />
          <Skeleton w="w-full" h="h-24" />
        </section>
      </div>

      {/* Data room + contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {Array.from({ length: 2 }).map((_, i) => (
          <section key={i} className="bg-white rounded-xl shadow-card border border-line p-6 space-y-3">
            <Skeleton w="w-40" h="h-5" />
            <Skeleton w="w-24" h="h-8" />
            <Skeleton w="w-full" h="h-3" rounded="rounded-full" />
            {Array.from({ length: 4 }).map((__, j) => (
              <Skeleton key={j} w="w-full" h="h-3" />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
