"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Video } from "lucide-react";
import { apiFetch } from "@/lib/api";

export interface AppointmentOut {
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

interface AppointmentCardProps {
  appointment: AppointmentOut;
  onCancel: (id: number) => void;
  isPast: boolean;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateTime(isoString: string): { date: string; time: string } {
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
  return { date, time };
}

function isCancelable(slotDatetime: string): boolean {
  return new Date(slotDatetime).getTime() - Date.now() > 2 * 60 * 60 * 1000;
}

function isJoinable(appointment: AppointmentOut): boolean {
  return (
    appointment.status === "confirmed" &&
    new Date(appointment.slot_datetime).getTime() <= Date.now()
  );
}

export default function AppointmentCard({
  appointment,
  onCancel,
  isPast,
}: AppointmentCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const { date, time } = formatDateTime(appointment.slot_datetime);

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
        router.push(`/patient/consultations/${data.id}`);
      } else {
        setJoining(false);
      }
    } catch {
      setJoining(false);
    }
  }

  const showCancel =
    !isPast &&
    appointment.status !== "cancelled" &&
    isCancelable(appointment.slot_datetime);

  return (
    <>
      <Card>
        <CardContent className="flex items-start gap-4 p-4">
          <Avatar className="size-10 shrink-0">
            <AvatarFallback>{getInitials(appointment.doctor_name)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-[#0F172A] truncate">
              {appointment.doctor_name ?? "Unknown Doctor"}
            </p>
            <p className="text-sm text-[#64748B]">General Practice</p>
            <p className="text-sm text-[#64748B] mt-1">
              {date} at {time}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <Badge
              variant={appointment.status === "cancelled" ? "destructive" : "outline"}
            >
              {appointment.status === "cancelled"
                ? "Cancelled"
                : "Confirmed"}
            </Badge>

            {isJoinable(appointment) && !isPast && (
              <Button
                size="sm"
                className="bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white text-sm"
                onClick={handleJoinConsultation}
                disabled={joining}
              >
                <Video className="size-4 mr-1" />
                {joining ? "Joining..." : "Join Consultation"}
              </Button>
            )}

            {showCancel && (
              <Button
                variant="destructive"
                size="sm"
                className="text-sm"
                onClick={() => setDialogOpen(true)}
              >
                Cancel Appointment
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancel this appointment?</DialogTitle>
            <DialogDescription>
              Your appointment with Dr. {appointment.doctor_name} on {date} at{" "}
              {time} will be cancelled. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDialogOpen(false);
                onCancel(appointment.id);
              }}
            >
              Cancel Appointment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
