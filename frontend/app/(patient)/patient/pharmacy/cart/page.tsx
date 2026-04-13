"use client";

import Link from "next/link";
import { useCart, useCartTotal } from "@/lib/stores/cart";
import { QuantityStepper } from "@/components/pharmacy/QuantityStepper";

export default function CartPage() {
  const lines = useCart((s) => s.lines);
  const hydrated = useCart((s) => s.hydrated);
  const updateQty = useCart((s) => s.updateQty);
  const remove = useCart((s) => s.remove);
  const total = useCartTotal();

  if (!hydrated) return null;

  if (lines.length === 0) {
    return (
      <div className="p-6 space-y-4 max-w-3xl">
        <h1 className="text-lg font-semibold text-[#0F172A]">Your cart</h1>
        <div className="p-6 text-center text-sm text-[#64748B] border border-[#E2E8F0] rounded-md bg-white">
          Your cart is empty.
          <div className="mt-3">
            <Link
              href="/patient/pharmacy"
              className="text-[#0EA5E9] font-medium hover:underline"
            >
              Browse medicines
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <h1 className="text-lg font-semibold text-[#0F172A]">Your cart</h1>
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
              <div className="text-xs text-[#64748B]">${l.unitPrice} each</div>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <QuantityStepper
                value={l.quantity}
                onChange={(q) => updateQty(l.drugId, q)}
              />
              <button
                type="button"
                onClick={() => remove(l.drugId)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between">
        <span className="text-sm text-[#64748B]">Subtotal</span>
        <span className="text-base font-semibold text-[#0F172A] tabular-nums">
          ${total.toFixed(2)}
        </span>
      </div>
      <Link
        href="/patient/pharmacy/checkout"
        className="inline-block px-4 py-2 rounded-md bg-[#0EA5E9] text-white text-sm font-semibold hover:bg-[#0284C7]"
      >
        Proceed to checkout
      </Link>
    </div>
  );
}
