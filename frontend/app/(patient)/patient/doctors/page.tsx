import { Suspense } from "react";
import DoctorListingInner from "./DoctorListingInner";
import DoctorListingSkeleton from "./DoctorListingSkeleton";

export default function DoctorsPage() {
  return (
    <Suspense fallback={<DoctorListingSkeleton />}>
      <DoctorListingInner />
    </Suspense>
  );
}
