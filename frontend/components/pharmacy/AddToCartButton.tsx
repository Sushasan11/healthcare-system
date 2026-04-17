"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/lib/stores/cart";
import { QuantityStepper } from "./QuantityStepper";

type Props = {
  drugId: number;
  name: string;
  unitPrice: string;
  maxStock: number;
};

export function AddToCartButton({ drugId, name, unitPrice, maxStock }: Props) {
  const [qty, setQty] = useState(1);
  const addItem = useCart((s) => s.addItem);
  const cap = Math.min(10, Math.max(1, maxStock));
  const disabled = maxStock <= 0;

  return (
    <div className="flex items-center gap-3">
      <QuantityStepper value={qty} onChange={setQty} min={1} max={cap} />
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          addItem({ drugId, name, unitPrice, quantity: qty });
          toast.success(`Added ${qty} × ${name} to cart`);
        }}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none"
      >
        {disabled ? "Out of stock" : "Add to cart"}
      </button>
    </div>
  );
}
