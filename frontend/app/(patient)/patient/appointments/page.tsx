import { Suspense } from "react";
import AppointmentsList from "./AppointmentsList";

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading appointments...</div>}>
      <AppointmentsList />
    </Suspense>
  );
}
