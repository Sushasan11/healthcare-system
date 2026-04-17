"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorListingSkeleton() {
  return (
    <div>
      {/* Page title skeleton */}
      <Skeleton className="h-7 w-40 mb-6" />

      {/* Filter bar skeleton */}
      <div className="flex gap-4 bg-[#F8FAFC] py-4 px-6 rounded-lg">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-8 w-60" />
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl ring-1 ring-foreground/10 bg-card p-4 flex flex-col gap-3"
          >
            <div className="flex items-start gap-3">
              {/* Avatar circle */}
              <Skeleton className="size-16 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            {/* Badge line */}
            <Skeleton className="h-4 w-24" />
            {/* Button line */}
            <Skeleton className="h-8 w-full mt-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
