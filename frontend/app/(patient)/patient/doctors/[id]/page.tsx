import { Suspense } from "react";
import DoctorProfileInner from "./DoctorProfileInner";
import DoctorProfileSkeleton from "./DoctorProfileSkeleton";

export default async function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<DoctorProfileSkeleton />}>
      <DoctorProfileInner doctorId={id} />
    </Suspense>
  );
}
