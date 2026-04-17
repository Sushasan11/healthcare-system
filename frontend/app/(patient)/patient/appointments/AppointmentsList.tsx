"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarX } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import AppointmentCard, { type AppointmentOut } from "./AppointmentCard";

export default function AppointmentsList() {
  const [appointments, setAppointments] = useState<AppointmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upcoming");

  useEffect(() => {
    let cancelled = false;

    async function fetchAppointments() {
      setLoading(true);
      try {
        const res = await apiFetch(`/appointments?tab=${activeTab}`);
        if (res.ok) {
          const data: AppointmentOut[] = await res.json();
          if (!cancelled) setAppointments(data);
        }
      } catch {
        // Silent failure — appointments list shows empty state
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAppointments();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  async function handleCancel(id: number) {
    try {
      const res = await apiFetch(`/appointments/${id}`, { method: "DELETE" });
      if (res.ok) {
        setAppointments((prev) => prev.filter((a) => a.id !== id));
        toast("Your appointment has been cancelled.");
      } else if (res.status === 400) {
        toast.error("Cannot cancel within 2 hours of appointment.");
      } else {
        toast.error("Failed to cancel appointment. Please try again.");
      }
    } catch {
      toast.error("Failed to cancel appointment. Please try again.");
    }
  }

  const isPast = activeTab === "past";

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        My Appointments
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-12 gap-3">
              <CalendarX className="size-12 text-[#64748B]" />
              <p className="text-base font-semibold text-[#0F172A]">
                No upcoming appointments
              </p>
              <p className="text-sm text-[#64748B] text-center max-w-sm">
                Book an appointment with a doctor to get started.
              </p>
              <Link
                href="/patient/doctors"
                className="text-sm font-semibold text-[#0EA5E9] hover:underline"
              >
                Find a Doctor
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {appointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  onCancel={handleCancel}
                  isPast={isPast}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="past" className="mt-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-12 gap-3">
              <CalendarX className="size-12 text-[#64748B]" />
              <p className="text-base font-semibold text-[#0F172A]">
                No past appointments
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {appointments.map((appt) => (
                <AppointmentCard
                  key={appt.id}
                  appointment={appt}
                  onCancel={handleCancel}
                  isPast={isPast}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
