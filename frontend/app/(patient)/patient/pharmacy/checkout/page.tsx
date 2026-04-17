"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCart, useCartTotal } from "@/lib/stores/cart";
import { apiFetch } from "@/lib/api";
import {
  CartStockChangedBanner,
  type CartStockDiff,
} from "@/components/pharmacy/CartStockChangedBanner";

export default function CheckoutPage() {
  const router = useRouter();
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const clear = useCart((s) => s.clear);
  const updateQty = useCart((s) => s.updateQty);
  const remove = useCart((s) => s.remove);
  const total = useCartTotal();
  const [diffs, setDiffs] = useState<CartStockDiff[] | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hydrated && lines.length === 0 && !diffs) {
      router.replace("/patient/pharmacy/cart");
    }
  }, [hydrated, lines.length, diffs, router]);

  if (!hydrated) return null;
  if (lines.length === 0 && !diffs) return null; // redirecting

  async function pay() {
    setSubmitting(true);
    try {
      const res = await apiFetch("/pharmacy/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({
            drug_id: l.drugId,
            quantity: l.quantity,
            expected_price: l.unitPrice,
          })),
        }),
      });

      if (res.status === 409) {
        let body: { error?: string; lines?: CartStockDiff[] } | null = null;
        try {
          const parsed = await res.json();
          body = parsed?.detail ?? parsed;
        } catch {
          body = null;
        }
        if (body?.error === "cart_stock_changed" && Array.isArray(body.lines)) {
          const changedLines = body.lines;
          changedLines.forEach((d) => {
            if (d.reason === "out_of_stock") remove(d.drug_id);
            else if (d.reason === "stock_insufficient")
              updateQty(d.drug_id, d.available);
          });
          setDiffs(changedLines);
          return;
        }
        toast.error("Checkout failed. Try again.");
        return;
      }

      if (!res.ok) {
        toast.error("Checkout failed. Try again.");
        return;
      }

      const data: { id: number } = await res.json();
      clear();
      toast.success("Order placed");
      router.push(`/patient/pharmacy/orders/${data.id}`);
    } catch {
      toast.error("Checkout failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (diffs) {
    return (
      <div className="p-6 max-w-2xl">
        <CartStockChangedBanner
          lines={diffs}
          onContinue={() => {
            setDiffs(null);
            void pay();
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-[#0F172A]">Checkout</h1>
      <ul className="border border-[#E2E8F0] rounded-md divide-y divide-[#E2E8F0] bg-white">
        {lines.map((l) => (
          <li
            key={l.drugId}
            className="p-4 flex items-center justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[#0F172A] truncate">
                {l.name}
              </div>
              <div className="text-xs text-[#64748B]">
                {l.quantity} × ${l.unitPrice}
              </div>
            </div>
            <div className="text-sm font-semibold text-[#0F172A] tabular-nums">
              ${(Number(l.unitPrice) * l.quantity).toFixed(2)}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#64748B]">Total</span>
        <span className="text-base font-semibold text-[#0F172A] tabular-nums">
          ${total.toFixed(2)}
        </span>
      </div>
      <button
        type="button"
        disabled={submitting}
        onClick={() => void pay()}
        className="px-4 py-2 rounded-md bg-[#0EA5E9] text-white text-sm font-semibold hover:bg-[#0284C7] disabled:opacity-50 disabled:pointer-events-none"
      >
        {submitting ? "Processing…" : `Pay $${total.toFixed(2)}`}
      </button>
    </div>
  );
}
