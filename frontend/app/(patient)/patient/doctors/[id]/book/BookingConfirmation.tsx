"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";

interface DoctorData {
  id: number;
  full_name: string;
  specialty: string | null;
  profile: {
    consultation_fee: number | string | null;
    avatar_url: string | null;
  } | null;
}

interface AppointmentBookedResponse {
  id: number;
  payment_status?: string | null;
  payment_amount?: string | null;
}

interface BookingConfirmationProps {
  doctorId: string;
  slotIso: string;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatAppointmentDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function formatAppointmentTime(isoString: string): string {
  const start = new Date(isoString);
  const end = new Date(start.getTime() + 30 * 60 * 1000); // add 30 minutes
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };
  return `${start.toLocaleTimeString("en-US", opts)} - ${end.toLocaleTimeString("en-US", opts)}`;
}

export default function BookingConfirmation({
  doctorId,
  slotIso,
}: BookingConfirmationProps) {
  const router = useRouter();

  const [doctor, setDoctor] = useState<DoctorData | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [holdAcquired, setHoldAcquired] = useState(false);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    if (!slotIso) {
      setLoadError("No slot selected. Please go back and choose a time slot.");
      setInitializing(false);
      return;
    }

    async function init() {
      try {
        // Fetch doctor details
        const doctorRes = await apiFetch(`/doctors/${doctorId}`);
        if (!doctorRes.ok) {
          setLoadError("Failed to load doctor details.");
          return;
        }
        const doctorData: DoctorData = await doctorRes.json();
        setDoctor(doctorData);

        // Acquire slot hold
        const holdRes = await apiFetch("/appointments/hold", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctor_id: parseInt(doctorId),
            slot_datetime: slotIso,
          }),
        });

        if (holdRes.status === 201) {
          setHoldAcquired(true);
        } else {
          const err = await holdRes
            .json()
            .catch(() => ({ detail: "Could not hold this slot." }));
          setHoldError(err.detail ?? "Could not hold this slot.");
        }
      } catch {
        setLoadError("Network error. Please try again.");
      } finally {
        setInitializing(false);
      }
    }

    init();
  }, [doctorId, slotIso]);

  // Countdown timer
  useEffect(() => {
    if (!holdAcquired || secondsLeft <= 0) return;
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [holdAcquired, secondsLeft]);

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timerDisplay = `${minutes}:${String(seconds).padStart(2, "0")}`;

  async function handleConfirm() {
    if (!doctor) return;
    const currentFee = doctor.profile?.consultation_fee ?? null;
    setConfirming(true);
    setBookingError(null);
    try {
      const body: { doctor_id: number; slot_datetime: string; reason_for_visit?: string } = {
        doctor_id: parseInt(doctorId),
        slot_datetime: slotIso,
      };
      if (reason.trim()) {
        body.reason_for_visit = reason.trim();
      }

      const res = await apiFetch("/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.status === 201) {
        const data: AppointmentBookedResponse = await res
          .json()
          .catch(() => ({ id: 0 }));
        const feeStr =
          data.payment_amount != null
            ? Number(data.payment_amount).toFixed(2)
            : currentFee != null
              ? Number(currentFee).toFixed(2)
              : "0.00";
        toast.success(
          `Appointment booked. Payment of $${feeStr} confirmed.`
        );
        if (data.id) {
          router.push(`/patient/appointments/${data.id}`);
        } else {
          router.push("/patient/appointments");
        }
      } else if (res.status === 422) {
        setBookingError(
          "This doctor has not set a consultation fee. Please try again later."
        );
      } else if (res.status === 502) {
        setBookingError(
          "Payment could not be processed. Try again or contact support if the problem persists."
        );
      } else {
        const err = await res
          .json()
          .catch(() => ({ detail: "Booking failed. Please try again." }));
        setBookingError(
          err.detail ?? "Booking failed. Please try again or choose a different time slot."
        );
      }
    } catch {
      setBookingError("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (initializing) {
    return (
      <div className="flex justify-center p-12 text-sm text-[#64748B]">
        Setting up your booking...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-[480px] mx-auto p-4">
        <Alert variant="destructive">
          <AlertDescription>
            {loadError}{" "}
            <button
              onClick={() => router.back()}
              className="font-semibold text-[#0EA5E9] hover:underline"
            >
              Go back
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Hold failed state
  if (holdError) {
    return (
      <div className="max-w-[480px] mx-auto p-4">
        <Alert variant="destructive">
          <AlertDescription>
            {holdError}{" "}
            <button
              onClick={() => router.back()}
              className="font-semibold text-[#0EA5E9] hover:underline"
            >
              Go back
            </button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const fee = doctor?.profile?.consultation_fee;
  const avatarUrl = doctor?.profile?.avatar_url;

  return (
    <>
      <Toaster position="top-right" />
      <div className="max-w-[480px] mx-auto p-4">
        <Card className="p-8">
          <CardHeader className="p-0 pb-4">
            {/* Timer expired state */}
            {secondsLeft === 0 ? (
              <div className="text-center space-y-2 py-4">
                <p className="text-base font-semibold text-[#0F172A]">
                  Your hold has expired
                </p>
                <p className="text-sm text-[#64748B]">
                  This slot was released after 5 minutes. Choose another time
                  to continue.
                </p>
                <button
                  onClick={() => router.push(`/patient/doctors/${doctorId}`)}
                  className="text-sm font-semibold text-[#0EA5E9] hover:underline mt-2 block mx-auto"
                >
                  Choose another slot
                </button>
              </div>
            ) : (
              <>
                {/* Countdown badge */}
                <div className="flex justify-center mb-4">
                  <Badge
                    className={
                      secondsLeft <= 60
                        ? "bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444] h-auto px-3 py-1 text-sm"
                        : "bg-[#0EA5E9]/10 text-[#0EA5E9] border-[#0EA5E9] h-auto px-3 py-1 text-sm"
                    }
                  >
                    Slot held for {timerDisplay}
                  </Badge>
                </div>

                {/* Doctor info */}
                {doctor && (
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="size-12">
                      {avatarUrl ? (
                        <AvatarImage
                          src={avatarUrl}
                          alt={doctor.full_name}
                        />
                      ) : null}
                      <AvatarFallback className="text-sm font-semibold">
                        {getInitials(doctor.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">
                        Dr. {doctor.full_name}
                      </p>
                      {doctor.specialty && (
                        <p className="text-xs text-[#64748B]">
                          {doctor.specialty}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardHeader>

          {/* Card body — only shown when timer hasn't expired */}
          {secondsLeft > 0 && (
            <CardContent className="p-0 space-y-4">
              {/* Appointment details */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Date</span>
                  <span className="text-[#0F172A] font-medium">
                    {formatAppointmentDate(slotIso)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#64748B]">Time</span>
                  <span className="text-[#0F172A] font-medium">
                    {formatAppointmentTime(slotIso)}
                  </span>
                </div>
              </div>

              {/* Reason for visit */}
              <div className="space-y-1.5">
                <p className="text-sm text-[#64748B]">Reason for visit</p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe your symptoms or reason for visit (optional)"
                  rows={3}
                />
              </div>

              {/* Consultation fee summary card */}
              {fee != null && (
                <Card className="border-[#0EA5E9]/20 bg-[#0EA5E9]/5 p-4">
                  <CardContent className="p-0 flex items-center justify-between">
                    <span className="text-sm text-[#64748B]">
                      Consultation Fee
                    </span>
                    <span className="text-3xl font-semibold text-[#0EA5E9]">
                      ${Number(fee).toFixed(2)}
                    </span>
                  </CardContent>
                </Card>
              )}

              {/* Booking error */}
              {bookingError && (
                <Alert variant="destructive">
                  <AlertDescription>{bookingError}</AlertDescription>
                </Alert>
              )}

              {/* Confirm button */}
              <Button
                onClick={handleConfirm}
                disabled={confirming}
                className="w-full h-11 bg-[#0EA5E9] text-white hover:bg-[#0EA5E9]/90"
              >
                {confirming ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Processing...
                  </>
                ) : fee != null ? (
                  `Confirm Booking & Pay $${Number(fee).toFixed(2)}`
                ) : (
                  "Confirm Booking & Pay"
                )}
              </Button>

              {/* Go back link */}
              <p className="text-[#64748B] text-sm text-center mt-3">
                <button
                  onClick={() => router.back()}
                  className="hover:underline cursor-pointer"
                >
                  Go back
                </button>
              </p>
            </CardContent>
          )}
        </Card>
      </div>
    </>
  );
}
