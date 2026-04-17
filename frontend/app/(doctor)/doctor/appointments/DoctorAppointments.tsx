"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Video } from "lucide-react";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

interface AppointmentOut {
  id: number;
  patient_id: number;
  doctor_id: number;
  slot_datetime: string;
  status: string;
  reason_for_visit: string | null;
  created_at: string;
  doctor_name: string | null;
  patient_name: string | null;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} at ${time}`;
}

interface AppointmentEntryProps {
  appointment: AppointmentOut;
  showDate?: boolean;
  isPast?: boolean;
}

function AppointmentEntry({ appointment, showDate = false, isPast = false }: AppointmentEntryProps) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);

  const isJoinable =
    appointment.status === "confirmed" &&
    new Date(appointment.slot_datetime).getTime() <= Date.now() &&
    !isPast;

  async function handleJoinConsultation() {
    setJoining(true);
    try {
      const res = await apiFetch("/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointment_id: appointment.id }),
      });
      if (res.ok) {
        const data = await res.json();
        router.push(`/doctor/consultations/${data.id}`);
      } else {
        setJoining(false);
      }
    } catch {
      setJoining(false);
    }
  }

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="w-12 shrink-0 text-right">
        <span className="text-sm font-semibold text-[#0F172A]">
          {showDate
            ? formatDateTime(appointment.slot_datetime)
            : formatTime(appointment.slot_datetime)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-[#0F172A] truncate">
          {appointment.patient_name ?? "Unknown Patient"}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {appointment.status === "pending" ? (
          <Badge className="bg-amber-100 text-amber-800 border border-amber-200">
            Pending
          </Badge>
        ) : (
          <Badge variant="outline">Confirmed</Badge>
        )}
        {isJoinable && (
          <Button
            size="sm"
            className="bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white text-sm ml-2"
            onClick={handleJoinConsultation}
            disabled={joining}
          >
            <Video className="size-4 mr-1" />
            {joining ? "Joining..." : "Join Consultation"}
          </Button>
        )}
      </div>
    </div>
  );
}

function AppointmentList({
  appointments,
  loading,
  emptyHeading,
  emptyBody,
  showDate = false,
  isPast = false,
}: {
  appointments: AppointmentOut[];
  loading: boolean;
  emptyHeading: string;
  emptyBody?: string;
  showDate?: boolean;
  isPast?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center mt-12 gap-3">
        <p className="text-base font-semibold text-[#0F172A]">{emptyHeading}</p>
        {emptyBody && (
          <p className="text-sm text-[#64748B] text-center max-w-sm">{emptyBody}</p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4">
      {appointments.map((appt, idx) => (
        <div key={appt.id}>
          <AppointmentEntry appointment={appt} showDate={showDate} isPast={isPast} />
          {idx < appointments.length - 1 && <Separator />}
        </div>
      ))}
    </div>
  );
}

export default function DoctorAppointments() {
  const [appointments, setAppointments] = useState<AppointmentOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("today");

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
        // Silent failure
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAppointments();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A] mb-6">
        Appointments
      </h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <AppointmentList
            appointments={appointments}
            loading={loading}
            emptyHeading="No appointments today"
            emptyBody="You have no scheduled appointments for today. Check your upcoming schedule below."
            isPast={activeTab === "past"}
          />
        </TabsContent>

        <TabsContent value="upcoming">
          <AppointmentList
            appointments={appointments}
            loading={loading}
            emptyHeading="No upcoming appointments"
            showDate={true}
            isPast={activeTab === "past"}
          />
        </TabsContent>

        <TabsContent value="past">
          <AppointmentList
            appointments={appointments}
            loading={loading}
            emptyHeading="No past appointments"
            showDate={true}
            isPast={activeTab === "past"}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
