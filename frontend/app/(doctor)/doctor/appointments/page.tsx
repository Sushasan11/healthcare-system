import { Suspense } from "react";
import DoctorAppointments from "./DoctorAppointments";

export default function DoctorAppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading appointments...</div>}>
      <DoctorAppointments />
    </Suspense>
  );
}
