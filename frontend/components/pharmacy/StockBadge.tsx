export function StockBadge({
  stock,
  threshold,
}: {
  stock: number;
  threshold: number;
}) {
  if (stock <= 0) {
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-700">
        Out of stock
      </span>
    );
  }
  const low = stock <= threshold;
  return (
    <span
      className={`text-xs px-2 py-0.5 rounded ${
        low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
      }`}
    >
      {low ? "Low Stock" : "In Stock"}
    </span>
  );
}
