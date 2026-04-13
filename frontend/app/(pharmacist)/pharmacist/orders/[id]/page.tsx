"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

interface OrderItemOut {
  id: number;
  medicine_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
}

interface PharmacyOrderOut {
  id: number;
  patient_id: number;
  patient_name: string | null;
  prescription_id: number | null;
  pharmacist_id: number | null;
  doctor_name: string | null;
  total_amount: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  rejected_at: string | null;
  items: OrderItemOut[];
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-400",
  verified: "bg-sky-50 text-sky-700 border-sky-400",
  dispatched: "bg-amber-50 text-amber-700 border-amber-400",
  delivered: "bg-green-50 text-green-700 border-green-400",
  rejected: "bg-red-50 text-red-700 border-red-400",
};

const STAGES = ["received", "verified", "dispatched", "delivered"] as const;
type Stage = (typeof STAGES)[number];

const ADVANCE_LABEL: Record<string, string> = {
  received: "Mark as Verified",
  verified: "Mark as Dispatched",
  dispatched: "Mark as Delivered",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }) + " at " + d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function LabelValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-[#64748B] shrink-0">{label}</span>
      <span className="text-sm font-semibold text-[#0F172A] text-right">{value}</span>
    </div>
  );
}

function StagePipeline({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STAGES.indexOf(currentStatus as Stage);
  return (
    <div className="flex items-start gap-1">
      {STAGES.map((s, idx) => {
        const filled = currentIdx >= 0 && idx <= currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-3 h-3 rounded-full ${
                filled ? "bg-[#0EA5E9]" : "bg-[#E2E8F0]"
              } ${isCurrent ? "" : filled ? "opacity-70" : ""}`}
            />
            <span className="text-[10px] text-[#64748B]">{s}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function PharmacistOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const orderId = parseInt(id, 10);

  const [order, setOrder] = useState<PharmacyOrderOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/pharmacy/orders/${orderId}`);
      if (!res.ok) {
        setError("Could not load this order. Please go back and try again.");
        return;
      }
      const data: PharmacyOrderOut = await res.json();
      setOrder(data);
    } catch {
      setError("Could not load this order. Please go back and try again.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function advance() {
    if (!order) return;
    setAdvancing(true);
    try {
      const res = await apiFetch(`/pharmacy/orders/${order.id}/advance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        toast.error("Something went wrong. Please try again.");
        return;
      }
      const data: PharmacyOrderOut = await res.json();
      setOrder(data);
      toast.success(`Order updated to ${data.status}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setAdvancing(false);
    }
  }

  async function submitReject() {
    if (!order) return;
    setRejecting(true);
    setRejectError(null);
    try {
      const body = rejectReason.trim()
        ? { reason: rejectReason.trim() }
        : { reason: null };
      const res = await apiFetch(`/pharmacy/orders/${order.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let code: string | undefined;
        try {
          const errBody = await res.json();
          code = errBody?.detail?.error;
        } catch {
          // ignore
        }
        const msg =
          code === "reject_not_allowed"
            ? "This order can no longer be rejected."
            : "Something went wrong. Please try again.";
        setRejectError(msg);
        return;
      }
      const data: PharmacyOrderOut = await res.json();
      setOrder(data);
      setRejectOpen(false);
      setRejectReason("");
      toast.success("Order rejected");
    } catch {
      setRejectError("Something went wrong. Please try again.");
    } finally {
      setRejecting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-4 space-y-4">
        <Link
          href="/pharmacist/orders"
          className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
        >
          <ArrowLeft className="size-4" /> Back to queue
        </Link>
        <Alert variant="destructive">
          <AlertDescription>
            {error ?? "Could not load this order. Please go back and try again."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const advanceLabel = ADVANCE_LABEL[order.status];
  const canReject = order.status === "received" || order.status === "verified";

  return (
    <div className="p-4 space-y-4">
      <Link
        href="/pharmacist/orders"
        className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
      >
        <ArrowLeft className="size-4" /> Back to queue
      </Link>

      <h1 className="text-xl font-semibold text-[#0F172A]">Order #{order.id}</h1>

      <div className="md:grid md:grid-cols-[1fr_320px] md:gap-6 space-y-6 md:space-y-0">
        {/* Left column — Rx + order details */}
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 space-y-4">
          <h2 className="text-base font-semibold text-[#0F172A]">Prescription</h2>
          <LabelValue
            label="Prescribing doctor"
            value={`Dr. ${order.doctor_name ?? "Unknown"}`}
          />
          <LabelValue label="Prescription date" value={formatDate(order.created_at)} />

          <Separator />

          <div>
            <p className="text-sm font-semibold text-[#0F172A] mb-2">Medicines</p>
            {order.items.map((item) => (
              <div key={item.id} className="border-t border-[#E2E8F0] py-2">
                <p className="text-sm font-semibold text-[#0F172A]">
                  {item.medicine_name}
                </p>
                <p className="text-sm text-[#64748B]">
                  {item.quantity} unit{item.quantity === 1 ? "" : "s"} · $
                  {Number(item.line_total).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <Separator />

          <h2 className="text-base font-semibold text-[#0F172A]">Patient</h2>
          <LabelValue label="Name" value={order.patient_name ?? "Unknown"} />
          <LabelValue label="Placed" value={formatDate(order.created_at)} />
        </div>

        {/* Right column — actions panel */}
        <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4 space-y-4 self-start">
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-[#0F172A]">Status</span>
            <Badge
              variant="outline"
              className={STATUS_COLORS[order.status] ?? ""}
              aria-label={`Order status: ${order.status}`}
            >
              {order.status}
            </Badge>
          </div>

          {order.status !== "rejected" && <StagePipeline currentStatus={order.status} />}

          {advanceLabel && (
            <Button
              onClick={advance}
              disabled={advancing}
              className="bg-[#0EA5E9] text-white hover:bg-[#0284C7] rounded-md w-full py-3 min-h-[44px] text-sm font-semibold"
            >
              {advancing ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Updating…
                </>
              ) : (
                advanceLabel
              )}
            </Button>
          )}

          {order.status === "delivered" && (
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="size-5" />
              <span className="text-sm font-semibold">Order complete</span>
            </div>
          )}

          {order.status === "rejected" && order.rejection_reason && (
            <div className="text-sm text-[#64748B]">
              <p className="font-semibold text-[#0F172A] mb-1">Rejection reason</p>
              <p>{order.rejection_reason}</p>
            </div>
          )}

          {canReject && (
            <Button
              variant="outline"
              onClick={() => {
                setRejectError(null);
                setRejectOpen(true);
              }}
              className="border border-[#EF4444] text-[#EF4444] bg-white hover:bg-red-50 rounded-md w-full py-3 min-h-[44px] text-sm font-semibold"
            >
              Reject Order
            </Button>
          )}
        </div>
      </div>

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-[#0F172A]">
              Reject this order?
            </DialogTitle>
            <DialogDescription className="text-sm text-[#64748B]">
              The patient will be notified. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label
              htmlFor="reject-reason"
              className="text-sm font-semibold text-[#0F172A]"
            >
              Reason for rejection
            </label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Medicine not in stock, prescription cannot be verified…"
              className="bg-white border border-[#E2E8F0] rounded-md p-3 w-full text-sm min-h-[90px]"
            />
          </div>
          {rejectError && (
            <Alert variant="destructive">
              <AlertDescription>{rejectError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setRejectOpen(false)}
              disabled={rejecting}
            >
              Keep Order
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={rejecting}>
              {rejecting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Rejecting…
                </>
              ) : (
                "Reject Order"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
