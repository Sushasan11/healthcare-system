import { Suspense } from "react";
import DoctorProfileEdit from "./DoctorProfileEdit";
import { Skeleton } from "@/components/ui/skeleton";

function DoctorProfileEditSkeleton() {
  return (
    <div className="space-y-4 max-w-lg">
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}

export default function DoctorProfilePage() {
  return (
    <Suspense fallback={<DoctorProfileEditSkeleton />}>
      <DoctorProfileEdit />
    </Suspense>
  );
}
