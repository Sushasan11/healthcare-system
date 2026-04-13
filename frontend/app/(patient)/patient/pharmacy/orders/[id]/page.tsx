"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { Check, XCircle, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrderItem {
  id: number;
  medicine_name: string;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
}

interface PharmacyOrderOut {
  id: number;
  patient_id: number;
  patient_name: string | null;
  prescription_id: number | null;
  pharmacist_id: number | null;
  doctor_name: string | null;
  total_amount: string | number;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  verified_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  rejected_at: string | null;
  items: OrderItem[];
}

const STAGES = ["received", "verified", "dispatched", "delivered"] as const;
const STAGE_LABELS: Record<string, string> = {
  received: "Received",
  verified: "Verified",
  dispatched: "Dispatched",
  delivered: "Delivered",
};
const STAGE_TIMESTAMP_KEYS: Record<string, keyof PharmacyOrderOut> = {
  received: "created_at",
  verified: "verified_at",
  dispatched: "dispatched_at",
  delivered: "delivered_at",
};

function OrderTracker({ order }: { order: PharmacyOrderOut }) {
  const currentIdx = STAGES.indexOf(order.status as (typeof STAGES)[number]);
  return (
    <ol role="list" className="space-y-4 bg-white border border-[#E2E8F0] rounded-lg p-6">
      {STAGES.map((stage, idx) => {
        const isCompleted = idx < currentIdx;
        const isActive = idx === currentIdx;
        const tsKey = STAGE_TIMESTAMP_KEYS[stage];
        const ts = order[tsKey] as string | null | undefined;
        return (
          <li role="listitem" key={stage} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <div className="w-4 h-4 rounded-full bg-[#0EA5E9] flex items-center justify-center">
                  <Check className="size-2.5 text-white" />
                </div>
              ) : isActive ? (
                <div className="w-4 h-4 rounded-full bg-[#0EA5E9]" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-[#E2E8F0]" />
              )}
              {idx < STAGES.length - 1 && (
                <div
                  className={`w-0.5 h-8 mt-1 ${
                    isCompleted ? "bg-[#0EA5E9]" : "bg-[#E2E8F0]"
                  }`}
                />
              )}
            </div>
            <div>
              <p
                className={`text-sm font-semibold ${
                  isActive || isCompleted ? "text-[#0F172A]" : "text-[#64748B]"
                }`}
              >
                {STAGE_LABELS[stage]}
              </p>
              {ts && (
                <p className="text-xs text-[#64748B]">
                  {new Date(ts).toLocaleString()}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default function PatientOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [order, setOrder] = useState<PharmacyOrderOut | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch(`/pharmacy/orders/${id}`);
        if (!res.ok) throw new Error();
        setOrder(await res.json());
      } catch {
        setError("Could not load this order. Please go back and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [id]);

  return (
    <div className="p-6 max-w-[640px] mx-auto space-y-6">
      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && order && (
        <>
          <div>
            <h1 className="text-xl font-semibold text-[#0F172A]">Order Status</h1>
            <p className="text-sm text-[#64748B]">Order #{order.id}</p>
          </div>

          {order.status === "rejected" ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <XCircle className="size-5 text-[#EF4444]" />
                <p className="text-sm font-semibold text-[#EF4444]">Order Rejected</p>
              </div>
              <p className="text-sm text-[#64748B] mt-2">
                {order.rejection_reason || "The pharmacist did not provide a reason."}
              </p>
            </div>
          ) : (
            <OrderTracker order={order} />
          )}

          {order.prescription_id === null && (
            <div className="p-4 border border-[#E2E8F0] rounded-lg bg-slate-50">
              <h3 className="text-sm font-semibold text-[#0F172A]">Self-service order</h3>
              <p className="text-xs text-[#64748B] mt-1">
                This order was placed from the OTC medicine store.
              </p>
            </div>
          )}

          <div className="bg-white border border-[#E2E8F0] rounded-lg">
            <div className="p-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">
                {order.prescription_id !== null ? "Prescribed Medicines" : "Order Items"}
              </h2>
            </div>
            {order.items.map((item) => (
              <div
                key={item.id}
                className="p-4 border-b border-[#E2E8F0] last:border-b-0 flex items-start justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {item.medicine_name}
                  </p>
                  <p className="text-sm text-[#64748B]">
                    {item.quantity} unit{item.quantity === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#0F172A] tabular-nums">
                  ${Number(item.line_total).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          <Link
            href="/patient/pharmacy/orders"
            className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
          >
            <ArrowLeft className="size-4" /> Back to orders
          </Link>
        </>
      )}
    </div>
  );
}
