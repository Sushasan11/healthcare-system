"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Inbox } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { OrderKindBadge } from "@/components/pharmacy/OrderKindBadge";

type KindFilter = "all" | "rx" | "otc";

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

function QueueStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={STATUS_COLORS[status] ?? "bg-gray-50 text-gray-700 border-gray-400"}
      aria-label={`Order status: ${status}`}
    >
      {status}
    </Badge>
  );
}

export default function PharmacistOrdersQueuePage() {
  const [orders, setOrders] = useState<PharmacyOrderOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch("/pharmacy/orders");
        if (!res.ok) {
          if (!cancelled) setError("Could not load the order queue. Please refresh the page.");
          return;
        }
        const data: PharmacyOrderOut[] = await res.json();
        if (!cancelled) setOrders(data);
      } catch {
        if (!cancelled) setError("Could not load the order queue. Please refresh the page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = orders.filter((o) =>
    kindFilter === "all"
      ? true
      : kindFilter === "rx"
        ? o.prescription_id !== null
        : o.prescription_id === null,
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold text-[#0F172A]">Order Queue</h1>
        <p className="text-sm text-[#64748B]">
          {filtered.length > 0
            ? `${filtered.length} orders pending`
            : "No pending orders"}
        </p>
      </div>

      <div className="flex gap-2" role="tablist" aria-label="Filter by order kind">
        {(["all", "rx", "otc"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kindFilter === k}
            onClick={() => setKindFilter(k)}
            className={`px-3 py-1 text-xs rounded-md font-semibold ${
              kindFilter === k
                ? "bg-[#0EA5E9] text-white"
                : "bg-slate-100 text-[#64748B] hover:bg-slate-200"
            }`}
          >
            {k === "all" ? "All" : k === "rx" ? "Rx" : "OTC"}
          </button>
        ))}
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!loading && error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="py-16 flex flex-col items-center text-center">
          <Inbox className="size-8 text-[#E2E8F0]" />
          <p className="text-sm font-semibold text-[#0F172A] mt-3">No pending orders</p>
          <p className="text-sm text-[#64748B] mt-1">
            New prescription orders will appear here.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div>
          <div className="grid grid-cols-[80px_60px_1fr_120px_140px_120px_80px] gap-4 border-b border-[#E2E8F0] pb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            <span>Order#</span>
            <span>Kind</span>
            <span>Patient</span>
            <span className="hidden md:block">Items</span>
            <span className="hidden md:block">Received</span>
            <span>Status</span>
            <span>Action</span>
          </div>
          {filtered.map((order) => (
            <Link href={`/pharmacist/orders/${order.id}`} key={order.id}>
              <div className="grid grid-cols-[80px_60px_1fr_120px_140px_120px_80px] gap-4 border-b border-[#E2E8F0] py-3 min-h-[56px] items-center hover:bg-[#F8FAFC] cursor-pointer">
                <span className="text-sm font-semibold text-[#0F172A]">
                  #{order.id}
                </span>
                <OrderKindBadge prescriptionId={order.prescription_id} />
                <span className="text-sm text-[#0F172A]">
                  {order.patient_name ?? "Unknown"}
                </span>
                <span className="hidden md:block text-sm text-[#64748B]">
                  {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </span>
                <span className="hidden md:block text-xs text-[#64748B]">
                  {new Date(order.created_at).toLocaleString()}
                </span>
                <QueueStatusBadge status={order.status} />
                <span className="text-sm font-semibold text-[#0EA5E9] hover:underline">
                  View
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
