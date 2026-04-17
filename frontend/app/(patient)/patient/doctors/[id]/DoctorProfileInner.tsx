"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DoctorProfileSkeleton from "./DoctorProfileSkeleton";

interface DoctorProfileData {
  id: number;
  full_name: string;
  email: string;
  specialty: string | null;
  years_of_experience: number | null;
  profile: {
    id: number;
    user_id: number;
    bio: string | null;
    qualifications: string | null;
    consultation_fee: number | null;
    avatar_url: string | null;
    rating: number | null;
    review_count: number;
  } | null;
}

interface SlotOut {
  slot_datetime: string;
  is_available: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StarRating({
  rating,
  reviewCount,
}: {
  rating: number | null;
  reviewCount: number;
}) {
  const filled = Math.round(rating ?? 0);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={
            i < filled
              ? "size-4 fill-yellow-400 text-yellow-400"
              : "size-4 text-gray-300"
          }
        />
      ))}
      <span className="text-sm text-[#64748B] ml-1">
        ({reviewCount} reviews)
      </span>
    </div>
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDayLabel(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

function getDateLabel(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isSameDay(iso: string, dayStart: Date): boolean {
  const d = new Date(iso);
  return (
    d.getFullYear() === dayStart.getFullYear() &&
    d.getMonth() === dayStart.getMonth() &&
    d.getDate() === dayStart.getDate()
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface DoctorProfileInnerProps {
  doctorId: string;
}

export default function DoctorProfileInner({
  doctorId,
}: DoctorProfileInnerProps) {
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorProfileData | null>(null);
  const [slots, setSlots] = useState<SlotOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStart(new Date())
  );

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [doctorRes, slotsRes] = await Promise.all([
          apiFetch(`/doctors/${doctorId}`),
          apiFetch(
            `/doctors/${doctorId}/slots?start_date=${
              weekStart.toISOString().split("T")[0]
            }&days=7`
          ),
        ]);
        if (!doctorRes.ok) {
          throw new Error(`Failed to load doctor (${doctorRes.status})`);
        }
        const doctorData: DoctorProfileData = await doctorRes.json();
        const slotsData: SlotOut[] = slotsRes.ok ? await slotsRes.json() : [];
        if (!cancelled) {
          setDoctor(doctorData);
          setSlots(slotsData);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Something went wrong"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [doctorId, weekStart]);

  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    setSelectedSlot(null);
  }

  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    setSelectedSlot(null);
  }

  function handleBookAppointment() {
    if (!selectedSlot) return;
    router.push(
      `/patient/doctors/${doctorId}/book?slot=${encodeURIComponent(selectedSlot)}`
    );
  }

  if (loading) return <DoctorProfileSkeleton />;

  if (error || !doctor) {
    return (
      <Alert className="border-destructive">
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{error ?? "Doctor not found"}</span>
          <button
            onClick={() => setError(null)}
            className="text-sm font-semibold text-[#0EA5E9] hover:underline shrink-0"
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const profile = doctor.profile;
  const fee = profile?.consultation_fee;
  const rating = profile?.rating ?? null;
  const reviewCount = profile?.review_count ?? 0;

  // Build week days
  const weekDays: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekEnd = weekDays[6];
  const weekRangeLabel = `${formatDate(weekStart)} – ${formatDate(weekEnd)}`;

  // Available slots for this week
  const availableSlots = slots.filter((s) => s.is_available);

  return (
    <div className="flex flex-col lg:flex-row gap-8">
      {/* Left column */}
      <div className="lg:w-[280px] lg:shrink-0 flex flex-col gap-4">
        <Avatar className="w-[120px] h-[120px] text-2xl">
          {profile?.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={doctor.full_name} />
          ) : null}
          <AvatarFallback className="text-2xl font-semibold">
            {getInitials(doctor.full_name)}
          </AvatarFallback>
        </Avatar>

        <h1 className="text-[28px] font-semibold text-[#0F172A] leading-tight">
          {doctor.full_name}
        </h1>

        {doctor.specialty && (
          <Badge variant="secondary" className="w-fit">
            {doctor.specialty}
          </Badge>
        )}

        <StarRating rating={rating} reviewCount={reviewCount} />

        {doctor.years_of_experience != null && (
          <p className="text-sm text-[#64748B]">
            {doctor.years_of_experience} years experience
          </p>
        )}

        {fee != null && (
          <div>
            <p className="text-xl font-semibold text-[#0F172A]">
              ${Number(fee).toFixed(2)}
            </p>
            <p className="text-sm text-[#64748B]">per consultation</p>
          </div>
        )}

        <Button
          className="w-full mt-4 bg-[#0EA5E9] hover:bg-[#0EA5E9]/90 text-white sticky top-4"
          onClick={handleBookAppointment}
          disabled={!selectedSlot}
        >
          Book Appointment
        </Button>
      </div>

      {/* Right column */}
      <div className="flex-1 space-y-8">
        {/* About */}
        <section>
          <h2 className="text-xl font-semibold text-[#0F172A] mb-3">About</h2>
          <Separator className="mb-4" />
          <p className="text-sm text-[#64748B]">
            {profile?.bio || "No bio available."}
          </p>
        </section>

        {/* Qualifications */}
        <section>
          <h2 className="text-xl font-semibold text-[#0F172A] mb-3">
            Qualifications
          </h2>
          <Separator className="mb-4" />
          <p className="text-sm text-[#64748B] whitespace-pre-line">
            {profile?.qualifications || "No qualifications listed."}
          </p>
        </section>

        {/* Available Slots */}
        <section>
          <h2 className="text-xl font-semibold text-[#0F172A] mb-3">
            Available Slots
          </h2>
          <Separator className="mb-4" />

          {/* Week navigation */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={prevWeek}
              aria-label="Previous week"
              className="flex items-center justify-center size-8 rounded-md border border-[#E2E8F0] hover:bg-slate-100 text-[#64748B]"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium text-[#0F172A]">
              {weekRangeLabel}
            </span>
            <button
              onClick={nextWeek}
              aria-label="Next week"
              className="flex items-center justify-center size-8 rounded-md border border-[#E2E8F0] hover:bg-slate-100 text-[#64748B]"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {availableSlots.length === 0 ? (
            <p className="text-sm text-[#64748B]">
              No available slots this week.
            </p>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {weekDays.map((day) => (
                <div key={day.toISOString()} className="text-center">
                  <p className="text-xs font-semibold text-[#64748B]">
                    {getDayLabel(day.toISOString())}
                  </p>
                  <p className="text-xs text-[#64748B]">
                    {getDateLabel(day.toISOString())}
                  </p>
                </div>
              ))}

              {/* Slot columns */}
              {weekDays.map((day) => {
                const daySlots = availableSlots.filter((s) =>
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
                        const isSelected = selectedSlot === slot.slot_datetime;
                        return (
                          <button
                            key={slot.slot_datetime}
                            onClick={() =>
                              setSelectedSlot(
                                isSelected ? null : slot.slot_datetime
                              )
                            }
                            className={[
                              "min-h-[44px] py-2 px-1 text-xs border rounded-md transition-colors text-center",
                              isSelected
                                ? "bg-[#0EA5E9]/10 border-[#0EA5E9] text-[#0EA5E9]"
                                : "bg-white border-[#E2E8F0] hover:border-[#0EA5E9] cursor-pointer text-[#0F172A]",
                            ].join(" ")}
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
          )}
        </section>
      </div>
    </div>
  );
}
