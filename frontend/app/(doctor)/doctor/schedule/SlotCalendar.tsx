"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

interface SlotOut {
  slot_datetime: string;
  is_available: boolean;
}

interface SlotCalendarProps {
  doctorId: string;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekRange(start: Date): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const endOpts: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
  };
  return `${start.toLocaleDateString("en-US", opts)} - ${end.toLocaleDateString("en-US", endOpts)}`;
}

function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function isSameDay(iso: string, day: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === day.getFullYear() &&
    d.getMonth() === day.getMonth() &&
    d.getDate() === day.getDate()
  );
}

export default function SlotCalendar({ doctorId }: SlotCalendarProps) {
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date())
  );
  const [slots, setSlots] = useState<SlotOut[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  const weekStartDate = weekStart.toISOString().split("T")[0];

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(
        `/doctors/${doctorId}/slots?start_date=${weekStartDate}&days=7`
      );
      if (res.ok) {
        const data: SlotOut[] = await res.json();
        setSlots(data);
        // Slots with is_available=false are considered blocked
        setBlockedSlots(
          new Set(
            data
              .filter((s) => !s.is_available)
              .map((s) => s.slot_datetime)
          )
        );
      }
    } catch {
      toast.error("Failed to load slots");
    } finally {
      setLoading(false);
    }
  }, [doctorId, weekStartDate]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  async function toggleSlot(slotIso: string) {
    if (toggling.has(slotIso)) return;

    const isBlocked = blockedSlots.has(slotIso);

    // Optimistic update
    setToggling((prev) => new Set(prev).add(slotIso));
    setBlockedSlots((prev) => {
      const next = new Set(prev);
      if (isBlocked) {
        next.delete(slotIso);
      } else {
        next.add(slotIso);
      }
      return next;
    });

    try {
      const res = await apiFetch("/doctors/me/schedule/blocks", {
        method: isBlocked ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot_datetime: slotIso }),
      });

      if (!res.ok) {
        // Revert on error
        setBlockedSlots((prev) => {
          const next = new Set(prev);
          if (isBlocked) {
            next.add(slotIso);
          } else {
            next.delete(slotIso);
          }
          return next;
        });
        toast.error("Failed to update slot. Please try again.");
      }
    } catch {
      // Revert on network error
      setBlockedSlots((prev) => {
        const next = new Set(prev);
        if (isBlocked) {
          next.add(slotIso);
        } else {
          next.delete(slotIso);
        }
        return next;
      });
      toast.error("Network error. Please try again.");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(slotIso);
        return next;
      });
    }
  }

  async function blockFullDay(day: Date) {
    const daySlots = slots.filter(
      (s) => isSameDay(s.slot_datetime, day) && !blockedSlots.has(s.slot_datetime)
    );
    for (const slot of daySlots) {
      await toggleSlot(slot.slot_datetime);
    }
  }

  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }

  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={prevWeek}
          aria-label="Previous week"
          className="flex items-center justify-center size-8 rounded-md border border-[#E2E8F0] hover:bg-slate-100 text-[#64748B]"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-medium text-[#0F172A]">
          {formatWeekRange(weekStart)}
        </span>
        <button
          onClick={nextWeek}
          aria-label="Next week"
          className="flex items-center justify-center size-8 rounded-md border border-[#E2E8F0] hover:bg-slate-100 text-[#64748B]"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-[#64748B] py-4 text-center">
          Loading slots...
        </div>
      ) : slots.length === 0 ? (
        <div className="text-sm text-[#64748B] py-4 text-center">
          No slots generated for this week. Save your working hours first.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {/* Day column headers with "Block full day" */}
            {weekDays.map((day) => {
              const daySlots = slots.filter((s) =>
                isSameDay(s.slot_datetime, day)
              );
              const allBlocked = daySlots.every((s) =>
                blockedSlots.has(s.slot_datetime)
              );
              return (
                <div key={day.toISOString()} className="text-center space-y-1">
                  <p className="text-xs font-semibold text-[#64748B]">
                    {formatDayHeader(day)}
                  </p>
                  {daySlots.length > 0 && (
                    <button
                      onClick={() => blockFullDay(day)}
                      disabled={allBlocked}
                      className="text-xs text-[#EF4444] hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Block
                    </button>
                  )}
                </div>
              );
            })}

            {/* Slot columns */}
            {weekDays.map((day) => {
              const daySlots = slots.filter((s) =>
                isSameDay(s.slot_datetime, day)
              );
              return (
                <div
                  key={day.toISOString()}
                  className="flex flex-col gap-1 mt-1"
                >
                  {daySlots.length === 0 ? (
                    <div className="min-h-[44px]" />
                  ) : (
                    daySlots.map((slot) => {
                      const isBlocked = blockedSlots.has(slot.slot_datetime);
                      const isToggling = toggling.has(slot.slot_datetime);
                      return (
                        <button
                          key={slot.slot_datetime}
                          onClick={() => toggleSlot(slot.slot_datetime)}
                          disabled={isToggling}
                          className={[
                            "min-h-[44px] py-2 px-3 text-sm rounded-md border transition-colors w-full",
                            isBlocked
                              ? "bg-[#FEF2F2] border-[#EF4444]/20 text-[#EF4444] line-through"
                              : "bg-white border-[#E2E8F0] text-[#0F172A] hover:border-[#0EA5E9]",
                            isToggling ? "opacity-50 cursor-not-allowed" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {formatTime(slot.slot_datetime)}
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
