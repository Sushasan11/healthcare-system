"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import WorkingHoursForm, {
  type AvailabilityEntry,
} from "./WorkingHoursForm";
import SlotCalendar from "./SlotCalendar";

export default function ScheduleManager() {
  const { user } = useAuth();
  const [schedule, setSchedule] = useState<AvailabilityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadSchedule() {
      try {
        const res = await apiFetch("/doctors/me/schedule");
        if (res.ok) {
          const data: AvailabilityEntry[] = await res.json();
          setSchedule(data);
        }
      } catch {
        // Leave empty — form shows empty state
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, []);

  async function handleSaveSchedule(entries: AvailabilityEntry[]) {
    setSaving(true);
    try {
      const res = await apiFetch("/doctors/me/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entries),
      });

      if (res.ok) {
        const updated: AvailabilityEntry[] = await res.json();
        setSchedule(updated);
        toast.success("Schedule saved");
      } else {
        const err = await res.json().catch(() => ({ detail: "Unknown error" }));
        toast.error(err.detail ?? "Failed to save schedule. Please try again.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-[#64748B]">Loading schedule...</div>;
  }

  const doctorId = user ? String(user.id) : "";

  return (
    <>
      <Toaster position="top-right" />
      <div className="space-y-6 max-w-4xl">
        <h1 className="text-xl font-semibold text-[#0F172A]">
          Schedule Management
        </h1>

        {/* Working Hours Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-[#0F172A]">
              Working Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <WorkingHoursForm
              schedule={schedule}
              onSave={handleSaveSchedule}
              saving={saving}
            />
          </CardContent>
        </Card>

        {/* Slot Calendar Card — only shown after schedule is saved */}
        {schedule.length > 0 && doctorId && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold text-[#0F172A]">
                Slot Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SlotCalendar doctorId={doctorId} />
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
