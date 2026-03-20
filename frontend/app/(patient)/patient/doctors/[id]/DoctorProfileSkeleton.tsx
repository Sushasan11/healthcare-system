"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorProfileSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left column */}
      <div className="lg:w-[280px] lg:shrink-0 flex flex-col gap-4">
        <Skeleton className="size-[120px] rounded-full" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-9 w-full mt-2" />
      </div>
      {/* Right column */}
      <div className="flex-1 space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-px w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-px w-full" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }).map((_, i) => (
              <Skeleton key={i} className="h-11 rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
