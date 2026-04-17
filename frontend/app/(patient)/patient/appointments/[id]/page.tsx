"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
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
  payment_status: string | null;
  payment_amount: string | null;
}

interface ReceiptOut {
  payment_id: number;
  date: string;
  doctor_name: string;
  specialty: string | null;
  amount: string;
  status: string;
  transaction_id: string | null;
}

function paymentBadgeClass(status: string): string {
  switch (status) {
    case "paid":
    case "completed":
      return "border-blue-400 text-blue-700 bg-blue-50";
    case "pending":
      return "border-yellow-400 text-yellow-700 bg-yellow-50";
    case "refunded":
      return "border-green-400 text-green-700 bg-green-50";
    case "failed":
      return "border-red-400 text-red-700 bg-red-50";
    default:
      return "border-gray-400 text-gray-700 bg-gray-50";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "confirmed":
      return "border-blue-400 text-blue-700 bg-blue-50";
    case "completed":
      return "border-green-400 text-green-700 bg-green-50";
    case "cancelled":
      return "border-red-400 text-red-700 bg-red-50";
    default:
      return "border-gray-400 text-gray-700 bg-gray-50";
  }
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const appointmentId = parseInt(id, 10);

  const [appointment, setAppointment] = useState<AppointmentOut | null>(null);
  const [receipt, setReceipt] = useState<ReceiptOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // No single-appointment GET endpoint — fetch list and find by id.
      // Fetch both upcoming and past so cancelled/completed also resolve.
      const [upcomingRes, pastRes] = await Promise.all([
        apiFetch("/appointments?tab=upcoming"),
        apiFetch("/appointments?tab=past"),
      ]);

      let found: AppointmentOut | null = null;
      if (upcomingRes.ok) {
        const list: AppointmentOut[] = await upcomingRes.json();
        found = list.find((a) => a.id === appointmentId) ?? null;
      }
      if (!found && pastRes.ok) {
        const list: AppointmentOut[] = await pastRes.json();
        found = list.find((a) => a.id === appointmentId) ?? null;
      }

      if (!found) {
        setError("Could not load appointment details. Refresh the page to try again.");
        setLoading(false);
        return;
      }
      setAppointment(found);

      // Fetch receipt — may 404 if not paid yet
      const receiptRes = await apiFetch(
        `/payments/consultation-receipt/${appointmentId}`
      );
      if (receiptRes.ok) {
        setReceipt(await receiptRes.json());
      } else {
        setReceipt(null);
      }
    } catch {
      setError("Could not load appointment details. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const withinRefundWindow =
    appointment != null &&
    new Date(appointment.slot_datetime).getTime() - Date.now() > 2 * 60 * 60 * 1000;

  async function handleConfirmCancel() {
    if (!appointment) return;
    setCancelling(true);
    setCancelError(null);
    try {
      const res = await apiFetch(`/appointments/${appointment.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCancelOpen(false);
        toast.success("Appointment cancelled");
        await loadData();
      } else {
        const err = await res
          .json()
          .catch(() => ({ detail: "Failed to cancel appointment." }));
        setCancelError(err.detail ?? "Failed to cancel appointment.");
      }
    } catch {
      setCancelError("Network error. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-[720px] mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="p-6 max-w-[720px] mx-auto">
        <Link
          href="/patient/appointments"
          className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline mb-4"
        >
          <ArrowLeft className="size-4" /> Back to Appointments
        </Link>
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? "Could not load appointment details. Refresh the page to try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canCancel =
    appointment.status !== "cancelled" && appointment.status !== "completed";

  return (
    <div className="p-6 max-w-[720px] mx-auto space-y-6">
      <Link
        href="/patient/appointments"
        className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to Appointments
      </Link>

      <h1 className="text-xl font-semibold text-[#0F172A]">
        Appointment Details
      </h1>

      {/* Appointment Info */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-base font-semibold text-[#0F172A]">
            Appointment Information
          </h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-[#64748B]">Doctor</span>
            <span className="text-[#0F172A] font-medium">
              {appointment.doctor_name ?? "Unknown"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">Date</span>
            <span className="text-[#0F172A] font-medium">
              {formatDateTime(appointment.slot_datetime)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">Status</span>
            <Badge variant="outline" className={statusBadgeClass(appointment.status)}>
              {appointment.status}
            </Badge>
          </div>
          {appointment.reason_for_visit && (
            <div className="flex justify-between gap-4">
              <span className="text-[#64748B] shrink-0">Reason</span>
              <span className="text-[#0F172A] font-medium text-right">
                {appointment.reason_for_visit}
              </span>
            </div>
          )}
          {appointment.payment_status && (
            <div className="flex justify-between items-center">
              <span className="text-[#64748B]">Payment</span>
              <Badge
                variant="outline"
                className={paymentBadgeClass(appointment.payment_status)}
              >
                {appointment.payment_status}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Payment Receipt */}
      <Card>
        <CardHeader className="pb-2">
          <h2 className="text-xl font-semibold text-[#0F172A]">
            Payment Receipt
          </h2>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {receipt ? (
            <>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Date</span>
                <span className="text-[#0F172A] font-medium">
                  {formatDate(receipt.date)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Doctor</span>
                <span className="text-[#0F172A] font-medium">
                  {receipt.doctor_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Specialty</span>
                <span className="text-[#0F172A] font-medium">
                  {receipt.specialty ?? "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#64748B]">Amount Charged</span>
                <span className="text-lg font-semibold text-[#0F172A]">
                  ${Number(receipt.amount).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Payment Status</span>
                <Badge variant="outline" className={paymentBadgeClass(receipt.status)}>
                  {receipt.status}
                </Badge>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#64748B] shrink-0">Transaction ID</span>
                <span className="text-sm text-[#64748B] font-mono text-right break-all">
                  {receipt.transaction_id ?? "—"}
                </span>
              </div>
            </>
          ) : (
            <p className="text-sm text-[#64748B]">
              Payment information will appear here once the booking is confirmed.
            </p>
          )}
        </CardContent>
      </Card>

      {canCancel && (
        <>
          <Separator />
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={() => {
                setCancelError(null);
                setCancelOpen(true);
              }}
            >
              Cancel Appointment
            </Button>
          </div>
        </>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Cancel appointment?</DialogTitle>
            <DialogDescription>
              {withinRefundWindow
                ? `You will receive a full refund of $${
                    appointment.payment_amount != null
                      ? Number(appointment.payment_amount).toFixed(2)
                      : "0.00"
                  }. This cannot be undone.`
                : "The 2-hour cancellation window has passed. No refund will be issued."}
            </DialogDescription>
          </DialogHeader>
          {cancelError && (
            <Alert variant="destructive">
              <AlertDescription>{cancelError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setCancelOpen(false)}
              disabled={cancelling}
            >
              Keep Appointment
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelling}
            >
              {withinRefundWindow ? "Cancel Appointment" : "Cancel Anyway"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
