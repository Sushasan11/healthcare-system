import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { serverFetch } from "@/lib/serverFetch";
import { StockBadge } from "@/components/pharmacy/StockBadge";
import { AddToCartButton } from "@/components/pharmacy/AddToCartButton";

type Drug = {
  id: number;
  name: string;
  generic_name: string | null;
  category: string;
  description: string | null;
  dosage: string | null;
  price: string;
  stock_count: number;
  low_stock_threshold: number;
};

export default async function MedicineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let drug: Drug;
  try {
    drug = await serverFetch<Drug>(`/pharmacy/catalog/${id}`);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Link
        href="/patient/pharmacy"
        className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
      >
        <ChevronLeft className="size-4" />
        Back to catalog
      </Link>

      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">{drug.name}</h1>
        {drug.generic_name && (
          <p className="mt-1 text-sm text-[#64748B]">{drug.generic_name}</p>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-[#64748B]">
        <span className="px-2 py-0.5 rounded bg-slate-100 capitalize">
          {drug.category.replace(/_/g, " ")}
        </span>
        {drug.dosage && <span>{drug.dosage}</span>}
      </div>

      {drug.description && (
        <p className="text-sm text-[#0F172A] leading-relaxed">
          {drug.description}
        </p>
      )}

      <div className="flex items-center gap-4">
        <span className="text-lg font-semibold text-[#0F172A]">
          ${drug.price}
        </span>
        <StockBadge
          stock={drug.stock_count}
          threshold={drug.low_stock_threshold}
        />
      </div>

      <AddToCartButton
        drugId={drug.id}
        name={drug.name}
        unitPrice={drug.price}
        maxStock={drug.stock_count}
      />
    </div>
  );
}
