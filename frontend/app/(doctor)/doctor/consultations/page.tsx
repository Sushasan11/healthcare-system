import { Suspense } from "react";
import ConsultationListPage from "@/components/consultation/ConsultationListPage";

export default function DoctorConsultationsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConsultationListPage />
    </Suspense>
  );
}
