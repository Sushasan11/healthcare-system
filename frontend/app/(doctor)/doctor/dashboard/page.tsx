"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Video,
  Users,
  FileText,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const PLACEHOLDER_CARDS = [
  {
    icon: Video,
    title: "Consultations",
    description: "Available in a later phase",
  },
  {
    icon: Users,
    title: "Patients",
    description: "Available in a later phase",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    description: "Available in a later phase",
  },
];

export default function DoctorDashboard() {
  const { user } = useAuth();
  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  const [todayAppointments, setTodayAppointments] = useState<AppointmentOut[]>([]);
  const [appointmentLoading, setAppointmentLoading] = useState(true);

  useEffect(() => {
    async function fetchTodayAppointments() {
      try {
        const res = await apiFetch("/appointments?tab=today");
        if (res.ok) {
          const data: AppointmentOut[] = await res.json();
          setTodayAppointments(data);
        }
      } catch {
        // Silent
      } finally {
        setAppointmentLoading(false);
      }
    }
    fetchTodayAppointments();
  }, []);

  const count = todayAppointments.length;
  const previewEntries = todayAppointments.slice(0, 3);

  return (
    <div>
      <h1 className="text-xl font-semibold text-[#0F172A]">
        {getGreeting()}, {firstName}
      </h1>

      {/* Today's Appointments summary card */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Today&apos;s Appointments
            </CardTitle>
            {!appointmentLoading && count > 0 && (
              <Link
                href="/doctor/appointments"
                className="text-sm font-semibold text-[#0EA5E9] hover:underline"
              >
                View All
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {appointmentLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-40" />
            </div>
          ) : count === 0 ? (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[#64748B]">No appointments today</p>
              <Link
                href="/doctor/schedule"
                className="text-sm font-semibold text-[#0EA5E9] hover:underline shrink-0"
              >
                Manage schedule
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-sm text-[#64748B] mb-3">
                {count} {count === 1 ? "appointment" : "appointments"} today
              </p>
              <div className="flex flex-col gap-2">
                {previewEntries.map((appt) => (
                  <div key={appt.id} className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-[#0F172A]">
                      {appt.patient_name ?? "Unknown Patient"}
                    </p>
                    <span className="text-sm text-[#64748B] shrink-0">
                      {formatTime(appt.slot_datetime)}
                    </span>
                  </div>
                ))}
                {count > 3 && (
                  <Link
                    href="/doctor/appointments"
                    className="text-sm font-semibold text-[#0EA5E9] hover:underline mt-1"
                  >
                    View All
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Appointments card — links to appointments page */}
        <Link href="/doctor/appointments">
          <Card className="hover:shadow-sm transition-shadow cursor-pointer">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[#0F172A]">
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-[#64748B]">
                View today&apos;s and upcoming patient appointments
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {PLACEHOLDER_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader>
                <Icon className="size-5 text-[#64748B]" />
                <CardTitle className="text-base font-semibold text-[#0F172A]">
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-sm text-[#64748B]">
                  {card.description}
                </CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
