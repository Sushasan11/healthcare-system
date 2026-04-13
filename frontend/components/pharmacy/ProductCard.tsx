import Link from "next/link";
import { StockBadge } from "./StockBadge";

type Props = {
  id: number;
  name: string;
  category: string;
  dosage: string | null;
  price: string;
  stockCount: number;
  lowStockThreshold: number;
};

export function ProductCard(p: Props) {
  return (
    <Link
      href={`/patient/pharmacy/medicines/${p.id}`}
      className="block p-4 border border-[#E2E8F0] rounded-md hover:bg-[#F8FAFC] transition"
    >
      <div className="text-sm font-semibold text-[#0F172A]">{p.name}</div>
      <div className="mt-1 text-xs text-[#64748B] flex items-center gap-2">
        <span className="px-2 py-0.5 rounded bg-slate-100 capitalize">
          {p.category.replace(/_/g, " ")}
        </span>
        {p.dosage && <span>· {p.dosage}</span>}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-medium text-[#0F172A]">${p.price}</span>
        <StockBadge stock={p.stockCount} threshold={p.lowStockThreshold} />
      </div>
    </Link>
  );
}
