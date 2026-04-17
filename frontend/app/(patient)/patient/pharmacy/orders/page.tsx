"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface OrderItem {
  id: number;
  medicine_name: string;
  quantity: number;
  unit_price: string | number;
  line_total: string | number;
}

interface PharmacyOrder {
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

const STATUS_COLORS: Record<string, string> = {
  received: "bg-blue-50 text-blue-700 border-blue-400",
  verified: "bg-sky-50 text-sky-700 border-sky-400",
  dispatched: "bg-amber-50 text-amber-700 border-amber-400",
  delivered: "bg-green-50 text-green-700 border-green-400",
  rejected: "bg-red-50 text-red-700 border-red-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_COLORS[status] ?? "bg-gray-50 text-gray-700 border-gray-400";
  return (
    <Badge
      variant="outline"
      aria-label={`Order status: ${status}`}
      className={`${cls} text-xs font-semibold capitalize`}
    >
      {status}
    </Badge>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function PatientPharmacyOrdersPage() {
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch("/pharmacy/orders");
        if (!res.ok) throw new Error();
        setOrders(await res.json());
      } catch {
        setError("Could not load your orders. Please refresh the page.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold text-[#0F172A]">My Orders</h1>

      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && orders.length === 0 && (
        <div className="py-12 flex flex-col items-center text-center">
          <ShoppingCart className="size-8 text-[#E2E8F0]" />
          <p className="text-sm font-semibold text-[#0F172A] mt-3">No orders yet</p>
          <p className="text-sm text-[#64748B] mt-1">
            Orders from your prescriptions will appear here.
          </p>
        </div>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link href={`/patient/pharmacy/orders/${order.id}`} key={order.id}>
              <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 hover:shadow-sm cursor-pointer">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#0F172A]">
                    Order #{order.id}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="text-sm text-[#64748B] mt-1">
                  Dr. {order.doctor_name ?? "—"} prescription · {order.items.length} item
                  {order.items.length === 1 ? "" : "s"}
                </p>
                <p className="text-xs text-[#64748B] mt-1">
                  Ordered {formatDate(order.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
