"use client";

export type CartStockDiff = {
  drug_id: number;
  requested: number;
  available: number;
  reason: "stock_insufficient" | "out_of_stock" | "price_changed";
  old_price?: string;
  new_price?: string;
};

export function CartStockChangedBanner({
  lines,
  onContinue,
}: {
  lines: CartStockDiff[];
  onContinue: () => void;
}) {
  return (
    <div className="p-6 border-2 border-amber-300 bg-amber-50 rounded-md space-y-3">
      <h2 className="text-base font-semibold text-amber-900">Your cart changed</h2>
      <p className="text-sm text-amber-800">
        Some items changed stock or price while you were browsing. Review and continue.
      </p>
      <ul className="text-sm space-y-1 text-amber-900">
        {lines.map((l) => (
          <li key={l.drug_id}>
            Drug #{l.drug_id}: requested {l.requested}, available {l.available}
            {l.reason === "price_changed" &&
              ` — price ${l.old_price} → ${l.new_price}`}
            {l.reason === "out_of_stock" && " — removed from cart"}
            {l.reason === "stock_insufficient" && " — quantity reduced"}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onContinue}
        className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
      >
        Continue to payment
      </button>
    </div>
  );
}
