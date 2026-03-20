import { Suspense } from "react";
import ConsultationRoom from "@/components/consultation/ConsultationRoom";

export default async function DoctorConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading consultation...</div>}>
      <ConsultationRoom consultationId={parseInt(id, 10)} />
    </Suspense>
  );
}
