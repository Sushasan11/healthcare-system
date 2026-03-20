import { Suspense } from "react";
import ScheduleManager from "./ScheduleManager";

export default function SchedulePage() {
  return (
    <Suspense fallback={<div className="p-6">Loading schedule...</div>}>
      <ScheduleManager />
    </Suspense>
  );
}
