"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface AvailabilityEntry {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface WorkingHoursFormProps {
  schedule: AvailabilityEntry[];
  onSave: (entries: AvailabilityEntry[]) => Promise<void>;
  saving: boolean;
}

function buildDefaultEntries(): AvailabilityEntry[] {
  return DAY_NAMES.map((_, i) => ({
    day_of_week: i,
    start_time: "09:00",
    end_time: "17:00",
    is_active: i < 5, // Mon-Fri active by default
  }));
}

export default function WorkingHoursForm({
  schedule,
  onSave,
  saving,
}: WorkingHoursFormProps) {
  const [entries, setEntries] = useState<AvailabilityEntry[]>(() => {
    if (schedule.length === 0) return buildDefaultEntries();
    // Merge provided schedule with defaults for any missing days
    const defaults = buildDefaultEntries();
    return defaults.map((def) => {
      const found = schedule.find((s) => s.day_of_week === def.day_of_week);
      return found ?? def;
    });
  });

  function toggleDay(dayIndex: number) {
    setEntries((prev) =>
      prev.map((e) =>
        e.day_of_week === dayIndex ? { ...e, is_active: !e.is_active } : e
      )
    );
  }

  function updateTime(
    dayIndex: number,
    field: "start_time" | "end_time",
    value: string
  ) {
    setEntries((prev) =>
      prev.map((e) =>
        e.day_of_week === dayIndex ? { ...e, [field]: value } : e
      )
    );
  }

  if (schedule.length === 0 && entries.every((e) => !e.is_active)) {
    // Show empty state when no schedule has been configured
  }

  const hasSchedule = schedule.length > 0;

  return (
    <div className="space-y-4">
      {!hasSchedule && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Clock className="size-12 text-[#64748B] mb-3" />
          <p className="text-base font-semibold text-[#0F172A]">
            Your schedule is not set up yet
          </p>
          <p className="text-sm text-[#64748B] mt-1 max-w-xs">
            Set your working hours so patients can book appointments with you.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {entries.map((entry) => {
          const dayName = DAY_NAMES[entry.day_of_week];
          return (
            <div
              key={entry.day_of_week}
              className="flex items-center gap-3 py-2"
            >
              {/* Day label — fixed 48px-ish width via w-24 */}
              <span className="w-24 shrink-0 text-sm font-medium text-[#0F172A]">
                {dayName}
              </span>

              {/* Toggle button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => toggleDay(entry.day_of_week)}
                className={
                  entry.is_active
                    ? "w-16 bg-[#0EA5E9]/10 border-[#0EA5E9] text-[#0EA5E9] hover:bg-[#0EA5E9]/20"
                    : "w-16 text-[#64748B]"
                }
              >
                {entry.is_active ? "On" : "Off"}
              </Button>

              {/* Start time */}
              <Input
                type="time"
                value={entry.start_time}
                onChange={(e) =>
                  updateTime(entry.day_of_week, "start_time", e.target.value)
                }
                disabled={!entry.is_active}
                className={`w-32 ${!entry.is_active ? "opacity-40" : ""}`}
              />

              <span className="text-sm text-[#64748B]">to</span>

              {/* End time */}
              <Input
                type="time"
                value={entry.end_time}
                onChange={(e) =>
                  updateTime(entry.day_of_week, "end_time", e.target.value)
                }
                disabled={!entry.is_active}
                className={`w-32 ${!entry.is_active ? "opacity-40" : ""}`}
              />
            </div>
          );
        })}
      </div>

      <Button
        onClick={() => onSave(entries)}
        disabled={saving}
        className="mt-4 bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/90"
      >
        {saving ? "Saving..." : "Save Schedule"}
      </Button>
    </div>
  );
}
