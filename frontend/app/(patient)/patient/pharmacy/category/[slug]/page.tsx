import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { serverFetch } from "@/lib/serverFetch";
import { ProductCard } from "@/components/pharmacy/ProductCard";

type CatalogItem = {
  id: number;
  name: string;
  category: string;
  dosage: string | null;
  price: string;
  stock_count: number;
  low_stock_threshold: number;
};
type CatalogList = {
  items: CatalogItem[];
  total: number;
  page: number;
  page_size: number;
};

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { slug } = await params;
  const { q: qParam, page: pageParam } = await searchParams;
  const q = qParam ?? "";
  const page = Number(pageParam ?? 1);
  const categoryLabel = slug.replace(/_/g, " ");

  let list: CatalogList = { items: [], total: 0, page: 1, page_size: 24 };
  let loadError: string | null = null;
  try {
    list = await serverFetch<CatalogList>(
      `/pharmacy/catalog?category=${encodeURIComponent(
        slug,
      )}&page=${page}&page_size=24${q ? `&q=${encodeURIComponent(q)}` : ""}`,
    );
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "Failed to load catalog category";
  }

  return (
    <div className="space-y-6">
      <Link
        href="/patient/pharmacy"
        className="inline-flex items-center gap-1 text-sm text-[#0EA5E9] hover:underline"
      >
        <ChevronLeft className="size-4" />
        Back to pharmacy
      </Link>
      <h1 className="text-2xl font-semibold text-[#0F172A] capitalize">
        {categoryLabel}
      </h1>

      <form method="GET" className="max-w-md">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search in this category"
          className="w-full px-4 py-2 border border-[#E2E8F0] rounded-md text-sm focus:outline-none focus:border-[#0EA5E9]"
        />
      </form>

      {loadError && (
        <div className="p-4 border border-red-200 bg-red-50 text-red-700 rounded-md text-sm">
          Couldn&apos;t load this category. Please try again in a moment.
        </div>
      )}

      {list.items.length === 0 ? (
        <div className="p-6 text-center text-sm text-[#64748B] border border-[#E2E8F0] rounded-md">
          {q
            ? `No medicines found for '${q}'`
            : `No medicines in ${categoryLabel} yet.`}
        </div>
      ) : (
        <>
          <div className="text-xs text-[#64748B]">
            {list.total} {list.total === 1 ? "item" : "items"}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {list.items.map((it) => (
              <ProductCard
                key={it.id}
                id={it.id}
                name={it.name}
                category={it.category}
                dosage={it.dosage}
                price={it.price}
                stockCount={it.stock_count}
                lowStockThreshold={it.low_stock_threshold}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
