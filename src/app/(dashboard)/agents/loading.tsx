import Skeleton from '@/components/Skeleton';

export default function AgentsLoading() {
  return (
    <div>
      <Skeleton w="w-24" h="h-7" className="mb-2" />
      <Skeleton w="w-80" h="h-4" className="mb-6" />

      {Array.from({ length: 3 }).map((_, gi) => (
        <section key={gi} className="mb-8">
          <Skeleton w="w-24" h="h-3" className="mb-3" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((__, i) => (
              <div key={i} className="bg-white rounded-xl p-4 border border-line flex gap-3">
                <Skeleton w="w-12" h="h-12" rounded="rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton w="w-16" h="h-2.5" />
                  <Skeleton w="w-3/4" h="h-4" />
                  <Skeleton w="w-1/2" h="h-3" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
