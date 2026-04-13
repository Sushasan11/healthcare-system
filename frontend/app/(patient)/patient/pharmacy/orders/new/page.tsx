"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { FileText, Loader2, ArrowLeft } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface OrderItemPreview {
  medicine_name: string;
  dosage_amount: string;
  dosage_unit: string;
  quantity: number;
  unit_price: string | number;
  price_is_fallback: boolean;
}

interface OrderPreview {
  prescription_id: number;
  doctor_name: string | null;
  issued_at: string;
  items: OrderItemPreview[];
  total_amount: string | number;
  has_fallback_prices: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function NewPharmacyOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prescriptionId = searchParams.get("prescription_id");

  const [preview, setPreview] = useState<OrderPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!prescriptionId) {
      setError("Could not load your order. Please go back and try again.");
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await apiFetch(`/pharmacy/orders/preview?prescription_id=${prescriptionId}`);
        if (!res.ok) throw new Error();
        setPreview(await res.json());
      } catch {
        setError("Could not load your order. Please go back and try again.");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [prescriptionId]);

  async function handlePlaceOrder() {
    if (!prescriptionId) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/pharmacy/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prescription_id: Number(prescriptionId) }),
      });
      if (res.status === 409) {
        const body = await res.json().catch(() => ({}));
        if (body?.detail?.error === "prescription_already_used") {
          toast.error("This prescription has already been used.");
          router.push(`/patient/prescriptions/${prescriptionId}`);
          return;
        }
        toast.error("Something went wrong. Please try again.");
        return;
      }
      if (!res.ok) throw new Error();
      const data = await res.json();
      toast.success("Order placed successfully");
      router.push(`/patient/pharmacy/orders/${data.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-[640px] mx-auto space-y-6 py-12">
      <h1 className="text-xl font-semibold text-[#0F172A]">Review Your Order</h1>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {error && !isLoading && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && preview && (
        <>
          {/* Source card */}
          <div className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <FileText className="size-4" />
              <span>
                From prescription by Dr. {preview.doctor_name ?? "—"} on {formatDate(preview.issued_at)}
              </span>
            </div>
          </div>

          {/* Medicines list */}
          <div className="bg-white border border-[#E2E8F0] rounded-lg">
            <div className="p-4 border-b border-[#E2E8F0]">
              <h2 className="text-base font-semibold text-[#0F172A]">Prescribed Medicines</h2>
            </div>
            {preview.items.map((item, idx) => (
              <div
                key={idx}
                className="p-4 border-b border-[#E2E8F0] last:border-b-0 flex items-start justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">{item.medicine_name}</p>
                  <p className="text-sm text-[#64748B]">
                    {item.dosage_amount} {item.dosage_unit} · {item.quantity} unit
                    {item.quantity === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-[#0F172A] tabular-nums">
                  ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
            <div className="p-4 border-t border-[#E2E8F0] flex items-center justify-between">
              <span className="text-sm text-[#64748B]">Total</span>
              <span className="text-base font-semibold text-[#0F172A] tabular-nums">
                ${Number(preview.total_amount).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Place order */}
          <div className="space-y-2">
            <Button
              onClick={handlePlaceOrder}
              disabled={submitting}
              className="bg-[#0EA5E9] text-white hover:bg-[#0284C7] rounded-md w-full py-3 text-sm font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Placing order…
                </>
              ) : (
                "Place Order"
              )}
            </Button>
            <Link
              href={`/patient/prescriptions/${prescriptionId}`}
              className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
            >
              <ArrowLeft className="size-4" /> Back
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
