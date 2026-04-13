export function OrderKindBadge({
  prescriptionId,
}: {
  prescriptionId: number | null;
}) {
  const isRx = prescriptionId !== null;
  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-0.5 rounded font-semibold ${
        isRx
          ? "bg-blue-50 text-blue-700 border border-blue-200"
          : "bg-slate-100 text-slate-700 border border-slate-200"
      }`}
      aria-label={`Order kind: ${isRx ? "Rx" : "OTC"}`}
    >
      {isRx ? "Rx" : "OTC"}
    </span>
  );
}
