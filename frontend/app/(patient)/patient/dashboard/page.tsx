"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Video,
  FileText,
  MessageSquare,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface MeProfile {
  allergies?: string | null;
  current_medications?: string | null;
  chronic_conditions?: string | null;
  blood_type?: string | null;
}

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

function formatDateTime(isoString: string): string {
  const d = new Date(isoString);
  const date = d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${date} at ${time}`;
}

const PLACEHOLDER_CARDS = [
  {
    icon: Video,
    title: "Consultations",
    description: "Available in a later phase",
  },
  {
    icon: FileText,
    title: "Prescriptions",
    description: "Available in a later phase",
  },
  {
    icon: MessageSquare,
    title: "Messages",
    description: "Available in a later phase",
  },
];

export default function PatientDashboard() {
  const { user } = useAuth();
  const [profileLoading, setProfileLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const [nextAppointment, setNextAppointment] = useState<AppointmentOut | null>(null);
  const [appointmentLoading, setAppointmentLoading] = useState(true);

  useEffect(() => {
    async function checkProfile() {
      try {
        const res = await apiFetch("/me");
        if (res.ok) {
          const data: MeProfile = await res.json();
          const incomplete =
            !data.allergies && !data.current_medications && !data.chronic_conditions;
          setShowPrompt(incomplete);
        }
      } catch {
        // Silent — don't show prompt on error
      } finally {
        setProfileLoading(false);
      }
    }
    checkProfile();
  }, []);

  useEffect(() => {
    async function fetchNextAppointment() {
      try {
        const res = await apiFetch("/appointments?tab=upcoming");
        if (res.ok) {
          const data: AppointmentOut[] = await res.json();
          setNextAppointment(data.length > 0 ? data[0] : null);
        }
      } catch {
        // Silent
      } finally {
        setAppointmentLoading(false);
      }
    }
    fetchNextAppointment();
  }, []);

  const firstName = user?.full_name?.split(" ")[0] ?? "there";

  return (
    <div>
      {/* Greeting */}
      <h1 className="text-xl font-semibold text-[#0F172A]">
        {getGreeting()}, {firstName}
      </h1>

      {/* Profile completion prompt */}
      {!profileLoading && showPrompt && (
        <Alert className="mt-4 border-[#0EA5E9] bg-sky-50">
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="text-[#0F172A]">
              Complete your profile to get the most out of HealthConnect.
            </span>
            <Link
              href="/patient/profile"
              className="shrink-0 text-sm font-semibold text-[#0EA5E9] hover:underline"
            >
              Complete profile
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {/* Next Appointment Card */}
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Next Appointment
            </CardTitle>
            {!appointmentLoading && nextAppointment && (
              <Link
                href="/patient/appointments"
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
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
          ) : nextAppointment ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-[#0F172A]">
                  {nextAppointment.doctor_name ?? "Unknown Doctor"}
                </p>
                <p className="text-sm text-[#64748B] mt-1">
                  {formatDateTime(nextAppointment.slot_datetime)}
                </p>
              </div>
              <Badge variant="outline">Confirmed</Badge>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-[#64748B]">No upcoming appointments</p>
              <Link
                href="/patient/doctors"
                className="text-sm font-semibold text-[#0EA5E9] hover:underline shrink-0"
              >
                Find a Doctor
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Placeholder card grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {/* Appointments card — links to appointments page */}
        <Link href="/patient/appointments">
          <Card className="hover:shadow-sm transition-shadow cursor-pointer">
            <CardHeader>
              <Calendar className="size-5 text-[#64748B]" />
              <CardTitle className="text-base font-semibold text-[#0F172A]">
                Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-sm text-[#64748B]">
                View and manage your appointments
              </CardDescription>
            </CardContent>
          </Card>
        </Link>

        {profileLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-5 mb-2" />
                  <Skeleton className="h-4 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-3 w-40" />
                </CardContent>
              </Card>
            ))
          : PLACEHOLDER_CARDS.map((card) => {
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
